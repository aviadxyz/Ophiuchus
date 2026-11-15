// The link between this console and a watch (CONTRACTS section 10), paired by a six-character
// room code. Two transports behind one small interface:
//   1. Between views in the same browser (BroadcastChannel). Always on while a room is joined.
//   2. The events endpoint, by polling every two seconds. Used only when VITE_EVENTS_URL is set
//      and the active profile has switched "Share live readings" on.
// Messages carry no name and no profile details. The room code is the only link between devices.

import { useMemo } from 'react'
import { config } from '@/config'
import { currentHealthSummary } from '../snapshot'
import { onMinuteTick } from '../clock'
import { summaryFingerprint } from '../compute'
import { newId } from '../dates'
import { setRuntime, useRuntime, type RoomConnection } from '../runtime'
import {
  acknowledgeAlert,
  cancelAlert,
  getActiveProfile,
  pushVital,
  raiseAlert,
  setStoredRoom,
  useDataStore,
} from '../store'
import type { AlertStatus, Source } from '../types'

export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_LENGTH = 6
const CHANNEL_NAME = 'ophiuchus:v1:relay'
const POLL_MS = 2000
const SUMMARY_MIN_GAP_MS = 10_000
const MAX_SEEN = 500

export type RelayType =
  | 'emergency.raised'
  | 'emergency.cancelled'
  | 'emergency.acknowledged'
  | 'vitals.sample'
  | 'summary.updated'

export type RelayMessage = {
  id: string
  room: string
  type: RelayType
  at: string
  origin: 'console' | 'watch'
  payload: Record<string, unknown>
}

export type RoomState = { code: string | null; connection: RoomConnection }

// ---------------------------------------------------------------------------------------------
// Room codes
// ---------------------------------------------------------------------------------------------

/** A valid code in upper case, or null. Spaces and dashes are ignored. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, '').toUpperCase()
  if (code.length !== ROOM_LENGTH) return null
  return [...code].every((c) => ROOM_ALPHABET.includes(c)) ? code : null
}

function randomCode(): string {
  const bytes = new Uint8Array(ROOM_LENGTH)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < ROOM_LENGTH; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return [...bytes].map((b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('')
}

// ---------------------------------------------------------------------------------------------
// Reading incoming messages: anything that does not fit is dropped
// ---------------------------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const RELAY_TYPES: readonly string[] = [
  'emergency.raised',
  'emergency.cancelled',
  'emergency.acknowledged',
  'vitals.sample',
  'summary.updated',
]

export function parseRelayMessage(raw: unknown): RelayMessage | null {
  if (!isObject(raw)) return null
  const { id, room, type, at, origin, payload } = raw
  if (typeof id !== 'string' || id.length === 0 || id.length > 100) return null
  if (typeof room !== 'string' || normalizeRoomCode(room) === null) return null
  if (typeof type !== 'string' || !RELAY_TYPES.includes(type)) return null
  if (typeof at !== 'string' || Number.isNaN(new Date(at).getTime())) return null
  if (origin !== 'console' && origin !== 'watch') return null
  if (!isObject(payload)) return null
  return { id, room, type: type as RelayType, at, origin, payload }
}

const asSource = (v: unknown): Source | null =>
  v === 'live' || v === 'entered' || v === 'imported' || v === 'simulated' ? v : null
const asNumber = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

// ---------------------------------------------------------------------------------------------
// State of the running relay
// ---------------------------------------------------------------------------------------------

type Transport = {
  send: (message: RelayMessage) => void
  stop: () => void
}

let room: string | null = null
let transports: Transport[] = []
let httpActive = false
const seen = new Set<string>()
/** The alert status the other side already knows about, so a change is sent once and never echoed. */
const relayed = new Map<string, AlertStatus>()
let lastSummaryPrint = ''
let lastSummaryAt = 0
let summaryTimer: ReturnType<typeof setTimeout> | undefined

function remember(id: string) {
  seen.add(id)
  if (seen.size > MAX_SEEN) {
    const first = seen.values().next().value
    if (first !== undefined) seen.delete(first)
  }
}

function applyIncoming(message: RelayMessage) {
  const profile = getActiveProfile()
  const { payload } = message
  switch (message.type) {
    case 'emergency.raised': {
      const alertId = payload.alertId
      const text = payload.message
      if (typeof alertId !== 'string' || alertId.length > 100 || typeof text !== 'string') return
      const exists = useDataStore.getState().alerts.some((a) => a.id === alertId)
      if (exists) return
      relayed.set(alertId, 'open')
      raiseAlert('emergency', message.origin, text, undefined, { id: alertId, at: message.at })
      return
    }
    case 'emergency.cancelled':
    case 'emergency.acknowledged': {
      const alertId = payload.alertId
      if (typeof alertId !== 'string') return
      const known = useDataStore.getState().alerts.find((a) => a.id === alertId)
      if (!known || known.status !== 'open') return
      if (message.type === 'emergency.cancelled') {
        relayed.set(alertId, 'cancelled')
        cancelAlert(alertId)
      } else {
        relayed.set(alertId, 'acknowledged')
        acknowledgeAlert(alertId)
      }
      return
    }
    case 'vitals.sample': {
      const source = asSource(payload.source)
      if (!source) return
      // The demo profile takes only simulated readings. A member never takes simulated ones.
      if ((profile.kind === 'demo') !== (source === 'simulated')) return
      const heartRate = asNumber(payload.heartRate)
      const spo2 = asNumber(payload.spo2)
      const skinTempC = asNumber(payload.skinTempC)
      pushVital({
        source,
        at: message.at,
        ...(heartRate !== undefined ? { heartRate } : {}),
        ...(spo2 !== undefined ? { spo2 } : {}),
        ...(skinTempC !== undefined ? { skinTempC } : {}),
      })
      return
    }
    case 'summary.updated':
      // The console sends this one. It is not acted on here.
      return
  }
}

function receive(raw: unknown) {
  const message = parseRelayMessage(raw)
  if (!message || message.room !== room || seen.has(message.id)) return
  remember(message.id)
  applyIncoming(message)
}

function send(type: RelayType, origin: 'console', payload: Record<string, unknown>) {
  if (!room || transports.length === 0) return
  const message: RelayMessage = {
    id: newId('msg'),
    room,
    type,
    at: new Date().toISOString(),
    origin,
    payload,
  }
  remember(message.id)
  for (const transport of transports) transport.send(message)
}

// ---------------------------------------------------------------------------------------------
// Transport 1: between views in the same browser
// ---------------------------------------------------------------------------------------------

function startLocalTransport(): Transport | null {
  if (typeof BroadcastChannel === 'undefined') return null
  const channel = new BroadcastChannel(CHANNEL_NAME)
  channel.onmessage = (event: MessageEvent) => receive(event.data)
  return {
    send: (message) => channel.postMessage(message),
    stop: () => {
      channel.onmessage = null
      channel.close()
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Transport 2: the events endpoint, by polling
// ---------------------------------------------------------------------------------------------

function eventsEndpoint(): string {
  const base = config.eventsUrl
  return base.endsWith('/api/events') ? base : `${base}/api/events`
}

function startPollingTransport(code: string): Transport {
  const endpoint = eventsEndpoint()
  let cursor: string | undefined
  let busy = false
  let stopped = false

  const poll = async () => {
    if (busy || stopped) return
    busy = true
    try {
      const query = `room=${encodeURIComponent(code)}${cursor ? `&after=${encodeURIComponent(cursor)}` : ''}`
      const response = await fetch(`${endpoint}?${query}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('events request failed')
      const body: unknown = await response.json()
      if (stopped) return
      if (isObject(body)) {
        if (Array.isArray(body.events)) body.events.forEach(receive)
        if (typeof body.cursor === 'string' || typeof body.cursor === 'number')
          cursor = String(body.cursor)
      }
      setRuntime({ roomConnection: 'online' })
    } catch {
      if (!stopped) setRuntime({ roomConnection: 'error' })
    } finally {
      busy = false
    }
  }

  const timer = setInterval(() => void poll(), POLL_MS)
  void poll()
  return {
    send: (message) => {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      }).catch(() => setRuntime({ roomConnection: 'error' }))
    },
    stop: () => {
      stopped = true
      clearInterval(timer)
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Sending what changes
// ---------------------------------------------------------------------------------------------

function sendAlertChanges() {
  if (!room) return
  const { alerts } = useDataStore.getState()
  const profileId = getActiveProfile().id
  for (const alert of alerts) {
    if (alert.profileId !== profileId || alert.kind !== 'emergency') continue
    if (relayed.get(alert.id) === alert.status) continue
    relayed.set(alert.id, alert.status)
    const type =
      alert.status === 'open'
        ? 'emergency.raised'
        : alert.status === 'cancelled'
          ? 'emergency.cancelled'
          : 'emergency.acknowledged'
    send(
      type,
      'console',
      type === 'emergency.raised'
        ? { alertId: alert.id, message: alert.message }
        : { alertId: alert.id },
    )
  }
}

function sendSummaryIfChanged() {
  if (!room) return
  const summary = currentHealthSummary()
  const print = summaryFingerprint(summary)
  if (print === lastSummaryPrint) return
  const wait = lastSummaryAt + SUMMARY_MIN_GAP_MS - Date.now()
  if (wait > 0) {
    // At most one every ten seconds: send the newest state once the gap is over.
    summaryTimer ??= setTimeout(() => {
      summaryTimer = undefined
      sendSummaryIfChanged()
    }, wait)
    return
  }
  lastSummaryPrint = print
  lastSummaryAt = Date.now()
  send('summary.updated', 'console', { ...summary })
}

// ---------------------------------------------------------------------------------------------
// Joining and leaving
// ---------------------------------------------------------------------------------------------

function stopTransports() {
  for (const transport of transports) transport.stop()
  transports = []
  httpActive = false
  if (summaryTimer !== undefined) clearTimeout(summaryTimer)
  summaryTimer = undefined
}

/** Starts or stops transports to match the stored room, the settings and the active profile's consent. */
export function syncRelay(): void {
  const code = useDataStore.getState().room
  const wantHttp = code !== null && config.eventsUrl !== '' && getActiveProfile().consent.relay
  if (code === room && wantHttp === httpActive) return
  stopTransports()
  room = code
  if (code === null) {
    setRuntime({ roomConnection: 'off' })
    return
  }
  relayed.clear()
  for (const alert of useDataStore.getState().alerts) relayed.set(alert.id, alert.status)
  lastSummaryPrint = ''
  lastSummaryAt = 0
  const local = startLocalTransport()
  if (local) transports.push(local)
  if (wantHttp) {
    transports.push(startPollingTransport(code))
    httpActive = true
  }
  setRuntime({ roomConnection: 'local' })
  sendSummaryIfChanged()
}

/** Pairs this browser with a watch. Returns false if the code is not a valid six-character code. */
export function joinRoom(code: string): boolean {
  const valid = normalizeRoomCode(code)
  if (!valid) return false
  setStoredRoom(valid)
  syncRelay()
  return true
}

/** Makes a new code, joins it and returns it. */
export function createRoom(): string {
  const code = randomCode()
  joinRoom(code)
  return code
}

export function leaveRoom(): void {
  setStoredRoom(null)
  syncRelay()
}

/** The current pairing code (or null) and the state of the link. */
export function useRoom(): RoomState {
  const code = useDataStore((state) => state.room)
  const connection = useRuntime((state) => state.roomConnection)
  return useMemo(
    () => ({ code, connection: code === null ? 'off' : connection }),
    [code, connection],
  )
}

/** Keeps the relay following the store. Returns a function that stops it. */
export function installRelay(): () => void {
  syncRelay()
  const unsubscribe = useDataStore.subscribe((state, previous) => {
    const consentChanged =
      getActiveProfile(state).consent.relay !== getActiveProfile(previous).consent.relay
    if (
      state.room !== previous.room ||
      state.activeProfileId !== previous.activeProfileId ||
      consentChanged
    ) {
      syncRelay()
    }
    sendAlertChanges()
    sendSummaryIfChanged()
  })
  const stopTick = onMinuteTick(sendSummaryIfChanged)
  return () => {
    unsubscribe()
    stopTick()
    stopTransports()
    room = null
    setRuntime({ roomConnection: 'off' })
  }
}
