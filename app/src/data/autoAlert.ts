// Automatic emergency alerts (CONTRACTS section 9, "Automatic alerts"). Two watchers can start a
// 10 second countdown: a fall seen by this device's motion sensor, and a vital sign that stays far
// out of range. If nobody answers "I'm OK" before it runs out, an emergency alert is raised the
// normal way, so the relay, the banners and the watch all follow it with nothing extra.
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
// against any fall-detection data set. Every number the watchers use is here.
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
  fall: {
    /** Below this total acceleration (in g) the device is close to weightless. */
    freeFallG: 0.5,
    /** Weightlessness must last at least this long. A fall from standing gives a few hundred ms. */
    freeFallMinMs: 100,
    /** The impact that follows, in g. */
    impactG: 2.5,
    /** The impact must come this soon after the weightless stretch ends. */
    impactWithinMs: 800,
    /** Stillness is checked starting this long after the impact... */
    stillAfterMs: 1000,
    /** ...for this long... */
    stillForMs: 2000,
    /** ...and every reading in it must stay this close to 1 g. */
    stillToleranceG: 0.25,
    /** The device must end up turned at least this much from how it was held before. */
    orientationChangeDeg: 45,
    /** How much motion history is kept. */
    bufferMs: 6000,
  },
} as const

const STANDARD_GRAVITY = 9.80665
const SETTINGS_KEY = `${STORAGE_PREFIX}autoAlert`
const TICK_MS = 250
const MOTION_PROBE_MS = 5000
const DETECT_EVERY_MS = 200

// ---------------------------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------------------------

export type AutoAlertCause = 'fall' | 'heart-rate' | 'oxygen'

export type PendingAutoAlert = { cause: AutoAlertCause; secondsLeft: number }

export type AutoAlertState = {
  /** The running countdown, or null. */
  pending: PendingAutoAlert | null
  fallDetection: boolean
  vitalsWatch: boolean
  /** False when this device has no motion sensor the browser can read, or access was refused. */
  motionAvailable: boolean
}

/** One reading of the motion sensor, acceleration including gravity, in m/s². `t` in ms. */
export type MotionSample = { t: number; x: number; y: number; z: number }

/** One vital reading for the watcher. `t` in ms. */
export type VitalReading = { t: number; heartRate?: number; spo2?: number }

export type VitalTrigger = { cause: 'heart-rate' | 'oxygen'; value: number }

// ---------------------------------------------------------------------------------------------
// Fall detection: a pure function over samples, oldest first
// ---------------------------------------------------------------------------------------------

const inG = (s: MotionSample) => Math.hypot(s.x, s.y, s.z) / STANDARD_GRAVITY

function meanVector(samples: readonly MotionSample[]): [number, number, number] {
  let x = 0
  let y = 0
  let z = 0
  for (const s of samples) {
    x += s.x
    y += s.y
    z += s.z
  }
  const n = Math.max(1, samples.length)
  return [x / n, y / n, z / n]
}

function angleDeg(a: [number, number, number], b: [number, number, number]): number {
  const la = Math.hypot(...a)
  const lb = Math.hypot(...b)
  if (la === 0 || lb === 0) return 0
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb)
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI
}

/** After a weightless stretch: an impact, then stillness in a new orientation. */
function impactThenStill(
  samples: readonly MotionSample[],
  stretchStart: number,
  stretchEnd: number,
): boolean {
  const L = AUTO_ALERT_LIMITS.fall
  const startT = samples[stretchStart]!.t
  const endT = samples[stretchEnd]!.t
  let impactT: number | null = null
  for (let k = stretchEnd + 1; k < samples.length; k++) {
    const s = samples[k]!
    if (s.t - endT > L.impactWithinMs) break
    if (inG(s) >= L.impactG) {
      impactT = s.t
      break
    }
  }
  if (impactT === null) return false
  const from = impactT + L.stillAfterMs
  const to = from + L.stillForMs
  const last = samples.at(-1)
  if (!last || last.t < to) return false
  const still = samples.filter((s) => s.t >= from && s.t <= to)
  if (still.length < 5) return false
  if (!still.every((s) => Math.abs(inG(s) - 1) <= L.stillToleranceG)) return false
  const before = samples.filter((s) => s.t >= startT - 1000 && s.t < startT)
  // With no history before the fall we cannot compare orientation, so we do not require it.
  if (before.length === 0) return true
  return angleDeg(meanVector(before), meanVector(still)) >= L.orientationChangeDeg
}

/**
 * True when the samples hold a fall: a short stretch of near weightlessness, then a hard impact,
 * then stillness with the device turned to a new position. A jump fails the stillness or the
 * orientation test, a phone put down gently has no weightless stretch, walking has neither.
 */
export function detectFall(samples: readonly MotionSample[]): boolean {
  const L = AUTO_ALERT_LIMITS.fall
  let i = 0
  while (i < samples.length) {
    if (inG(samples[i]!) >= L.freeFallG) {
      i++
      continue
    }
    let j = i
    while (j + 1 < samples.length && inG(samples[j + 1]!) < L.freeFallG) j++
    if (samples[j]!.t - samples[i]!.t >= L.freeFallMinMs && impactThenStill(samples, i, j)) {
      return true
    }
    i = j + 1
  }
  return false
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

/** The alert text for a cause. `value` is the reading for heart rate and oxygen. */
export function autoAlertMessage(
  cause: AutoAlertCause,
  value: number | null,
  role: string,
  test: boolean,
): string {
  const seconds = AUTO_ALERT_LIMITS.sustainMs / 1000
  const base =
    cause === 'fall'
      ? 'Fall detected, no response'
      : cause === 'heart-rate'
        ? `Heart rate ${value ?? '?'} bpm for ${seconds} seconds, no response`
        : `Blood oxygen ${value ?? '?'}% for ${seconds} seconds, no response`
  const trimmedRole = role.trim()
  return `${base}${trimmedRole ? ` · ${trimmedRole}` : ''}${test ? ' (test)' : ''}`
}

/** Example readings used by `simulateAutoAlert`. They are not measured. */
const SIMULATED_VALUE: Record<'fall' | 'heart-rate', number | null> = {
  fall: null,
  'heart-rate': 182,
}

// ---------------------------------------------------------------------------------------------
// Settings on this device
// ---------------------------------------------------------------------------------------------

type Settings = { fallDetection: boolean; vitalsWatch: boolean }

function loadSettings(): Settings {
  const fallback: Settings = { fallDetection: false, vitalsWatch: true }
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
    }
  } catch {
    return fallback
  }
}

function saveSettings() {
  const { fallDetection, vitalsWatch } = useAutoAlertStore.getState()
  void safeStorage.setItem(SETTINGS_KEY, JSON.stringify({ fallDetection, vitalsWatch }))
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

const useAutoAlertStore = create<AutoAlertState>()(() => ({
  pending: null,
  ...loadSettings(),
  motionAvailable: motionLikelyAvailable(),
}))

/** The countdown, if any, and the two switches. */
export function useAutoAlert(): AutoAlertState {
  return useAutoAlertStore()
}

/** The same state outside React. For the data folder and tests. */
export function getAutoAlertState(): AutoAlertState {
  return useAutoAlertStore.getState()
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

function startCountdown(cause: AutoAlertCause, value: number | null, test: boolean) {
  if (useAutoAlertStore.getState().pending) return
  // A real detection while an emergency alert is already open adds nothing: help is already asked for.
  if (!test && hasOpenEmergency()) return
  const seconds = AUTO_ALERT_LIMITS.countdownSeconds
  countdownMessage = autoAlertMessage(cause, value, getActiveProfile().role ?? '', test)
  countdownDeadline = Date.now() + seconds * 1000
  useAutoAlertStore.setState({ pending: { cause, secondsLeft: seconds } })
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

/** Starts the same countdown as a real detection, for demonstration. The message ends "(test)". */
export function simulateAutoAlert(cause: 'fall' | 'heart-rate'): void {
  if (cause !== 'fall' && cause !== 'heart-rate') return
  startCountdown(cause, SIMULATED_VALUE[cause], true)
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
  if (trigger) startCountdown(trigger.cause, trigger.value, false)
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

let installed = false
let listening = false
let motionBuffer: MotionSample[] = []
let lastDetectAt = 0
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
  // A page in the background is not the one the person is holding.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  const t = event.timeStamp || performance.now()
  motionBuffer.push({ t, x: a.x, y: a.y, z: a.z })
  const oldest = t - AUTO_ALERT_LIMITS.fall.bufferMs
  while (motionBuffer.length > 0 && motionBuffer[0]!.t < oldest) motionBuffer.shift()
  if (t - lastDetectAt < DETECT_EVERY_MS) return
  lastDetectAt = t
  if (detectFall(motionBuffer)) {
    motionBuffer = []
    startCountdown('fall', null, false)
  }
}

function startListening() {
  if (listening || typeof window === 'undefined') return
  listening = true
  sawMotionData = false
  motionBuffer = []
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
  motionBuffer = []
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

/** Switches fall detection on this device. Turning it on asks for motion access where needed. */
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
  useAutoAlertStore.setState({
    pending: null,
    fallDetection: false,
    vitalsWatch: true,
    motionAvailable: motionLikelyAvailable(),
  })
}
