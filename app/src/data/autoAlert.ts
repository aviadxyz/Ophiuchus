// Automatic emergency alerts (CONTRACTS section 9, "Automatic alerts"). Two watchers can start a
// 10 second countdown: this device's motion sensor (a sudden hard movement, or no movement at all
// while the person should be awake), and a vital sign that stays far out of range. If nobody
// answers "I'm OK" before it runs out, an emergency alert is raised the normal way, so the relay,
// the banners and the watch all follow it with nothing extra.
//
// In orbit there is no gravity, so there is no fall to look for. The motion check works the same
// with or without gravity: it follows the steady part of the reading (gravity on Earth, nothing in
// orbit) and only looks at what changes on top of it. The cause is still called `fall`, the
// contract's name for "something is wrong with movement"; the alert message says which one.
//
// The countdown and the switches live only on this device. Nothing here sends data anywhere.

import { create } from 'zustand'
import { safeStorage, STORAGE_PREFIX } from './persistence'
import { useRuntime } from './runtime'
import { DEMO_PROFILE_ID } from './seed'
import { getActiveProfile, raiseAlert, useDataStore } from './store'
import type { VitalSample } from './types'

// ---------------------------------------------------------------------------------------------
// Limits. ILLUSTRATIVE ONLY: chosen for a demonstration, not clinical limits and not validated
// against any data set. Every number the watchers use is here.
// ---------------------------------------------------------------------------------------------

export const AUTO_ALERT_LIMITS = {
  /** Seconds the person has to answer "I'm OK". */
  countdownSeconds: 10,
  /** Heart rate at or above this, in bpm. */
  heartRateHigh: 170,
  /** Heart rate at or below this, in bpm. */
  heartRateLow: 35,
  /** Blood oxygen at or below this, in %. */
  spo2Low: 88,
  /** A vital sign must stay out of range this long before the countdown starts. */
  sustainMs: 20_000,
  /** After a trigger, the value must be back in range this long before it can trigger again. */
  recoverMs: 60_000,
  /** A longer silence between readings breaks a run: we do not assume what happened in between. */
  maxSampleGapMs: 15_000,
  motion: {
    /** A change of at least this much (in g) in one reading is a sudden hard movement: a blow or a collision. */
    suddenG: 3,
    /** A change smaller than this (in g) is sensor noise, not movement. */
    stillG: 0.04,
    /** No movement for this long, while awake, starts the countdown. */
    stillMs: 120_000,
    /** How quickly the steady part of the reading follows a slow change, in ms. */
    baselineMs: 1000,
    /** The steady part needs this much data before a sudden movement can be judged. */
    warmUpMs: 500,
    /** A longer silence from the sensor (page hidden, sensor paused) starts the stillness count again. */
    maxGapMs: 5000,
  },
  /** The crew day. Outside it the person is assumed asleep and no-movement never triggers. */
  awakeFromHour: 7,
  awakeUntilHour: 23,
} as const

const STANDARD_GRAVITY = 9.80665
const SETTINGS_KEY = `${STORAGE_PREFIX}autoAlert`
const TICK_MS = 250
const MOTION_PROBE_MS = 5000
const SLEEP_CHECK_MS = 30_000

// ---------------------------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------------------------

export type AutoAlertCause = 'fall' | 'heart-rate' | 'oxygen'

export type PendingAutoAlert = { cause: AutoAlertCause; secondsLeft: number }

export type AutoAlertState = {
  /** The running countdown, or null. */
  pending: PendingAutoAlert | null
  /** The motion check on this device: sudden movement or no movement. Named by the contract. */
  fallDetection: boolean
  vitalsWatch: boolean
  /** False when this device has no motion sensor the browser can read, or access was refused. */
  motionAvailable: boolean
  /** The person said they are asleep (a nap). Turns itself off at the start of the next crew day. */
  sleepingNow: boolean
}

/** One reading of the motion sensor, acceleration including gravity, in m/s². `t` in ms. */
export type MotionSample = { t: number; x: number; y: number; z: number }

/** What the motion check found: a sudden hard movement, or no movement for two minutes. */
export type MotionTrigger = 'sudden' | 'still'

/** One vital reading for the watcher. `t` in ms. */
export type VitalReading = { t: number; heartRate?: number; spo2?: number }

export type VitalTrigger = { cause: 'heart-rate' | 'oxygen'; value: number }

type Detection =
  | { cause: 'fall'; motion: MotionTrigger }
  | { cause: 'heart-rate' | 'oxygen'; value: number | null }

// ---------------------------------------------------------------------------------------------
// The motion check: pure apart from its own memory, so it can be tested with made-up samples
// ---------------------------------------------------------------------------------------------

/**
 * Feed it readings, oldest first. It answers `sudden` for one reading that jumps far from the
 * steady part, and `still` once nothing has moved for two minutes while the person is awake.
 * `still` fires once per episode: it can fire again only after the device has moved.
 */
export function createMotionWatch() {
  const L = AUTO_ALERT_LIMITS.motion
  let baseline: [number, number, number] | null = null
  let firstT = 0
  let lastT: number | null = null
  let lastMoveT = 0
  let stillFired = false

  return {
    push(sample: MotionSample, asleep: boolean): MotionTrigger | null {
      const { t } = sample
      if (lastT !== null && t <= lastT) return null
      if (baseline === null || lastT === null || t - lastT > L.maxGapMs) {
        baseline = [sample.x, sample.y, sample.z]
        firstT = t
        lastT = t
        lastMoveT = t
        return null
      }
      const dt = t - lastT
      lastT = t
      const change =
        Math.hypot(sample.x - baseline[0], sample.y - baseline[1], sample.z - baseline[2]) /
        STANDARD_GRAVITY
      const k = Math.min(1, dt / L.baselineMs)
      baseline = [
        baseline[0] + (sample.x - baseline[0]) * k,
        baseline[1] + (sample.y - baseline[1]) * k,
        baseline[2] + (sample.z - baseline[2]) * k,
      ]

      if (change >= L.stillG) {
        lastMoveT = t
        stillFired = false
      }
      if (change >= L.suddenG && t - firstT >= L.warmUpMs) return 'sudden'
      // Asleep, stillness is expected: the count starts again when the person should be awake.
      if (asleep) {
        lastMoveT = t
        return null
      }
      if (!stillFired && t - lastMoveT >= L.stillMs) {
        stillFired = true
        return 'still'
      }
      return null
    },
    reset() {
      baseline = null
      lastT = null
      stillFired = false
    },
  }
}

/** True outside the crew day (07:00 to 23:00, local time). */
export function outsideCrewDay(now: Date): boolean {
  const hour = now.getHours()
  return hour < AUTO_ALERT_LIMITS.awakeFromHour || hour >= AUTO_ALERT_LIMITS.awakeUntilHour
}

/** The next start of the crew day after `from`. A "Sleeping now" switch lasts until then. */
export function nextCrewDayStart(from: Date): Date {
  const next = new Date(from)
  next.setHours(AUTO_ALERT_LIMITS.awakeFromHour, 0, 0, 0)
  if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1)
  return next
}

// ---------------------------------------------------------------------------------------------
// Vital-sign watch: 20 seconds out of range triggers once per episode
// ---------------------------------------------------------------------------------------------

type Tracker = {
  outSince: number | null
  inRangeSince: number | null
  lastT: number | null
  fired: boolean
}

const freshTracker = (): Tracker => ({
  outSince: null,
  inRangeSince: null,
  lastT: null,
  fired: false,
})

/** Feeds one reading to a tracker. True when this reading completes a 20 second run. */
function track(tracker: Tracker, t: number, out: boolean): boolean {
  const L = AUTO_ALERT_LIMITS
  if (tracker.lastT !== null && t <= tracker.lastT) return false
  if (tracker.lastT !== null && t - tracker.lastT > L.maxSampleGapMs) {
    tracker.outSince = null
    tracker.inRangeSince = null
  }
  tracker.lastT = t
  if (out) {
    tracker.inRangeSince = null
    if (tracker.fired) return false
    tracker.outSince ??= t
    if (t - tracker.outSince < L.sustainMs) return false
    tracker.fired = true
    tracker.outSince = null
    return true
  }
  tracker.outSince = null
  if (tracker.fired) {
    tracker.inRangeSince ??= t
    if (t - tracker.inRangeSince >= L.recoverMs) {
      tracker.fired = false
      tracker.inRangeSince = null
    }
  }
  return false
}

/** A watcher over a stream of readings. Pure apart from its own memory, so it can be tested. */
export function createVitalsWatch() {
  let heart = freshTracker()
  let oxygen = freshTracker()
  const L = AUTO_ALERT_LIMITS
  return {
    push(reading: VitalReading): VitalTrigger | null {
      let trigger: VitalTrigger | null = null
      const hr = reading.heartRate
      if (typeof hr === 'number' && Number.isFinite(hr)) {
        const out = hr >= L.heartRateHigh || hr <= L.heartRateLow
        if (track(heart, reading.t, out)) trigger = { cause: 'heart-rate', value: Math.round(hr) }
      }
      const spo2 = reading.spo2
      if (typeof spo2 === 'number' && Number.isFinite(spo2)) {
        const out = spo2 <= L.spo2Low
        if (track(oxygen, reading.t, out) && !trigger)
          trigger = { cause: 'oxygen', value: Math.round(spo2) }
      }
      return trigger
    },
    reset() {
      heart = freshTracker()
      oxygen = freshTracker()
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Messages: what was measured, never a conclusion, never a name
// ---------------------------------------------------------------------------------------------

/** The alert text for a detection, then the role, then " (test)" for a simulation. */
export function autoAlertMessage(detection: Detection, role: string, test: boolean): string {
  const seconds = AUTO_ALERT_LIMITS.sustainMs / 1000
  const stillMinutes = AUTO_ALERT_LIMITS.motion.stillMs / 60_000
  let base: string
  if (detection.cause === 'fall') {
    base =
      detection.motion === 'sudden'
        ? 'Sudden hard movement detected, no response'
        : `No movement for ${stillMinutes} minutes, no response`
  } else if (detection.cause === 'heart-rate') {
    base = `Heart rate ${detection.value ?? '?'} bpm for ${seconds} seconds, no response`
  } else {
    base = `Blood oxygen ${detection.value ?? '?'}% for ${seconds} seconds, no response`
  }
  const trimmedRole = role.trim()
  return `${base}${trimmedRole ? ` · ${trimmedRole}` : ''}${test ? ' (test)' : ''}`
}

/** What `simulateAutoAlert` pretends to have seen. The heart-rate value is an example, not measured. */
const SIMULATED: Record<'fall' | 'heart-rate', Detection> = {
  fall: { cause: 'fall', motion: 'still' },
  'heart-rate': { cause: 'heart-rate', value: 182 },
}

// ---------------------------------------------------------------------------------------------
// Settings on this device
// ---------------------------------------------------------------------------------------------

type Settings = { fallDetection: boolean; vitalsWatch: boolean; sleepingUntil: number }

let sleepingUntil = 0

function loadSettings(): Settings {
  const fallback: Settings = { fallDetection: false, vitalsWatch: true, sleepingUntil: 0 }
  const raw = safeStorage.getItem(SETTINGS_KEY)
  if (typeof raw !== 'string') return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return fallback
    const p = parsed as Record<string, unknown>
    return {
      fallDetection:
        typeof p.fallDetection === 'boolean' ? p.fallDetection : fallback.fallDetection,
      vitalsWatch: typeof p.vitalsWatch === 'boolean' ? p.vitalsWatch : fallback.vitalsWatch,
      sleepingUntil:
        typeof p.sleepingUntil === 'number' && Number.isFinite(p.sleepingUntil)
          ? p.sleepingUntil
          : 0,
    }
  } catch {
    return fallback
  }
}

function saveSettings() {
  const { fallDetection, vitalsWatch } = useAutoAlertStore.getState()
  void safeStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ fallDetection, vitalsWatch, sleepingUntil }),
  )
}

type MotionPermission = () => Promise<'granted' | 'denied' | string>

/** iOS Safari asks before giving motion readings. Elsewhere this is null. */
function motionPermissionRequest(): MotionPermission | null {
  if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') return null
  const request = (window.DeviceMotionEvent as unknown as { requestPermission?: MotionPermission })
    .requestPermission
  return typeof request === 'function' ? request.bind(window.DeviceMotionEvent) : null
}

/** A first guess. A device that turns out to have no sensor is marked unavailable once we listen. */
function motionLikelyAvailable(): boolean {
  if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') return false
  return typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0
}

// ---------------------------------------------------------------------------------------------
// The state screens read
// ---------------------------------------------------------------------------------------------

const initialSettings = loadSettings()
sleepingUntil = initialSettings.sleepingUntil

const useAutoAlertStore = create<AutoAlertState>()(() => ({
  pending: null,
  fallDetection: initialSettings.fallDetection,
  vitalsWatch: initialSettings.vitalsWatch,
  motionAvailable: motionLikelyAvailable(),
  sleepingNow: sleepingUntil > Date.now(),
}))

/** The countdown, if any, and the switches. */
export function useAutoAlert(): AutoAlertState {
  return useAutoAlertStore()
}

/** The same state outside React. For the data folder and tests. */
export function getAutoAlertState(): AutoAlertState {
  return useAutoAlertStore.getState()
}

/** True when stillness is expected: outside the crew day, or "Sleeping now" is on. */
function isAsleep(now: Date = new Date()): boolean {
  return outsideCrewDay(now) || sleepingUntil > now.getTime()
}

/** Turns "Sleeping now" off once the crew day starts again. */
function refreshSleeping() {
  const sleeping = sleepingUntil > Date.now()
  if (useAutoAlertStore.getState().sleepingNow !== sleeping) {
    useAutoAlertStore.setState({ sleepingNow: sleeping })
  }
}

/**
 * The person is going to sleep (a nap) or has woken up. While on, no-movement never triggers; a
 * sudden hard movement still does. It turns itself off at the start of the next crew day.
 */
export function setSleepingNow(on: boolean): void {
  sleepingUntil = on ? nextCrewDayStart(new Date()).getTime() : 0
  useAutoAlertStore.setState({ sleepingNow: on })
  saveSettings()
}

// ---------------------------------------------------------------------------------------------
// The countdown
// ---------------------------------------------------------------------------------------------

let countdownTimer: ReturnType<typeof setInterval> | undefined
let countdownDeadline = 0
let countdownMessage = ''

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch {
    // Vibration is a nicety. Nothing to do.
  }
}

/** `watch` on the watch view (`/w`), `console` everywhere else. */
function currentOrigin(): 'console' | 'watch' {
  if (typeof window === 'undefined') return 'console'
  const path = window.location.pathname
  return path === '/w' || path.startsWith('/w/') ? 'watch' : 'console'
}

function stopCountdown() {
  if (countdownTimer !== undefined) clearInterval(countdownTimer)
  countdownTimer = undefined
}

function tick() {
  const left = Math.ceil((countdownDeadline - Date.now()) / 1000)
  const { pending } = useAutoAlertStore.getState()
  if (!pending) {
    stopCountdown()
    return
  }
  if (left <= 0) {
    stopCountdown()
    useAutoAlertStore.setState({ pending: null })
    raiseAlert('emergency', currentOrigin(), countdownMessage, 'emergency')
    return
  }
  if (left !== pending.secondsLeft) {
    useAutoAlertStore.setState({ pending: { cause: pending.cause, secondsLeft: left } })
    vibrate(200)
  }
}

function hasOpenEmergency(): boolean {
  const profileId = getActiveProfile().id
  return useDataStore
    .getState()
    .alerts.some((a) => a.profileId === profileId && a.kind === 'emergency' && a.status === 'open')
}

function startCountdown(detection: Detection, test: boolean) {
  if (useAutoAlertStore.getState().pending) return
  // A real detection while an emergency alert is already open adds nothing: help is already asked for.
  if (!test && hasOpenEmergency()) return
  const seconds = AUTO_ALERT_LIMITS.countdownSeconds
  countdownMessage = autoAlertMessage(detection, getActiveProfile().role ?? '', test)
  countdownDeadline = Date.now() + seconds * 1000
  useAutoAlertStore.setState({ pending: { cause: detection.cause, secondsLeft: seconds } })
  vibrate(200)
  stopCountdown()
  countdownTimer = setInterval(tick, TICK_MS)
}

/** The person answered "I'm OK". Nothing is raised. */
export function cancelAutoAlert(): void {
  stopCountdown()
  if (useAutoAlertStore.getState().pending) {
    useAutoAlertStore.setState({ pending: null })
    vibrate(0)
  }
}

/**
 * Starts the same countdown as a real detection, for demonstration. The message ends "(test)".
 * `fall` shows the no-movement case, the one that takes two minutes to see for real.
 */
export function simulateAutoAlert(cause: 'fall' | 'heart-rate'): void {
  if (cause !== 'fall' && cause !== 'heart-rate') return
  startCountdown(SIMULATED[cause], true)
}

// ---------------------------------------------------------------------------------------------
// The vital-sign watcher, fed by whatever writes the latest reading
// ---------------------------------------------------------------------------------------------

const vitalsWatch = createVitalsWatch()

/** Feeds one stored reading to the watcher. Simulated readings and the demo profile never trigger. */
export function considerVital(sample: VitalSample): void {
  const profile = getActiveProfile()
  if (!useAutoAlertStore.getState().vitalsWatch) return
  if (sample.profileId !== profile.id) return
  if (profile.id === DEMO_PROFILE_ID || profile.kind === 'demo' || sample.source === 'simulated')
    return
  const t = new Date(sample.at).getTime()
  if (Number.isNaN(t)) return
  const reading: VitalReading = { t }
  if (sample.heartRate !== undefined) reading.heartRate = sample.heartRate
  if (sample.spo2 !== undefined) reading.spo2 = sample.spo2
  const trigger = vitalsWatch.push(reading)
  if (trigger) startCountdown(trigger, false)
}

/** Switches the vital-sign watch on this device. */
export function setVitalsWatch(on: boolean): void {
  if (useAutoAlertStore.getState().vitalsWatch === on) return
  vitalsWatch.reset()
  useAutoAlertStore.setState({ vitalsWatch: on })
  saveSettings()
}

// ---------------------------------------------------------------------------------------------
// The motion listener
// ---------------------------------------------------------------------------------------------

const motionWatch = createMotionWatch()
let installed = false
let listening = false
let sawMotionData = false
let probeTimer: ReturnType<typeof setTimeout> | undefined
let removePermissionRetry: (() => void) | undefined

function onMotion(event: DeviceMotionEvent) {
  const a = event.accelerationIncludingGravity
  if (!a || a.x === null || a.y === null || a.z === null) {
    // Some desktop browsers send one empty reading to say there is no sensor.
    if (!sawMotionData) useAutoAlertStore.setState({ motionAvailable: false })
    return
  }
  sawMotionData = true
  if (!useAutoAlertStore.getState().motionAvailable)
    useAutoAlertStore.setState({ motionAvailable: true })
  // A page in the background is not the one the person is holding. The gap rule restarts the count.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  const t = event.timeStamp || performance.now()
  const found = motionWatch.push({ t, x: a.x, y: a.y, z: a.z }, isAsleep())
  if (found) startCountdown({ cause: 'fall', motion: found }, false)
}

function startListening() {
  if (listening || typeof window === 'undefined') return
  listening = true
  sawMotionData = false
  motionWatch.reset()
  window.addEventListener('devicemotion', onMotion)
  probeTimer = setTimeout(() => {
    probeTimer = undefined
    if (!sawMotionData) useAutoAlertStore.setState({ motionAvailable: false })
  }, MOTION_PROBE_MS)
  // After a reload, iOS needs a tap before it gives readings again. Ask on the first one.
  const request = motionPermissionRequest()
  if (request && !removePermissionRetry) {
    const ask = () => {
      removePermissionRetry?.()
      request()
        .then((answer) => {
          if (answer === 'granted') useAutoAlertStore.setState({ motionAvailable: true })
        })
        .catch(() => undefined)
    }
    window.addEventListener('click', ask)
    window.addEventListener('touchend', ask)
    removePermissionRetry = () => {
      window.removeEventListener('click', ask)
      window.removeEventListener('touchend', ask)
      removePermissionRetry = undefined
    }
  }
}

function stopListening() {
  if (!listening) return
  listening = false
  window.removeEventListener('devicemotion', onMotion)
  if (probeTimer !== undefined) clearTimeout(probeTimer)
  probeTimer = undefined
  removePermissionRetry?.()
  motionWatch.reset()
}

function syncMotion() {
  if (installed && useAutoAlertStore.getState().fallDetection) startListening()
  else stopListening()
}

function enableFallDetection() {
  useAutoAlertStore.setState({ fallDetection: true })
  saveSettings()
  syncMotion()
}

/** Switches the motion check on this device. Turning it on asks for motion access where needed. */
export function setFallDetection(on: boolean): void {
  if (!on) {
    useAutoAlertStore.setState({ fallDetection: false })
    saveSettings()
    syncMotion()
    return
  }
  const request = motionPermissionRequest()
  if (!request) {
    if (useAutoAlertStore.getState().motionAvailable) enableFallDetection()
    return
  }
  // Called straight from the tap, so the browser shows its question.
  request()
    .then((answer) => {
      if (answer === 'granted') {
        useAutoAlertStore.setState({ motionAvailable: true })
        enableFallDetection()
      } else {
        useAutoAlertStore.setState({ motionAvailable: false })
      }
    })
    .catch(() => useAutoAlertStore.setState({ motionAvailable: false }))
}

// ---------------------------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------------------------

/** Starts both watchers in the browser. Returns a function that stops them. */
export function installAutoAlert(): () => void {
  installed = true
  syncMotion()
  refreshSleeping()
  const sleepTimer = setInterval(refreshSleeping, SLEEP_CHECK_MS)
  const stopVitals = useRuntime.subscribe((state, previous) => {
    const id = getActiveProfile().id
    const sample = state.latestVital[id]
    if (sample && sample !== previous.latestVital[id]) considerVital(sample)
  })
  const stopProfile = useDataStore.subscribe((state, previous) => {
    if (state.activeProfileId === previous.activeProfileId) return
    // A countdown belongs to the person it was started for.
    vitalsWatch.reset()
    cancelAutoAlert()
  })
  return () => {
    clearInterval(sleepTimer)
    stopVitals()
    stopProfile()
    installed = false
    syncMotion()
    cancelAutoAlert()
  }
}

/** Puts everything back to the start. For tests only. */
export function resetAutoAlertForTests(): void {
  stopCountdown()
  vitalsWatch.reset()
  motionWatch.reset()
  sleepingUntil = 0
  useAutoAlertStore.setState({
    pending: null,
    fallDetection: false,
    vitalsWatch: true,
    motionAvailable: motionLikelyAvailable(),
    sleepingNow: false,
  })
}
