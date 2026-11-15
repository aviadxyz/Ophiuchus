// Simulated vitals for the demo profile: a believable heart rate and blood oxygen every few
// seconds, source `simulated`. It runs only while the active profile is `demo`, and it never
// writes to a member profile.

import { setRuntime } from './runtime'
import { DEMO_PROFILE_ID } from './seed'
import { getActiveProfile, pushVital, useDataStore } from './store'

const INTERVAL_MS = 4000

let timer: ReturnType<typeof setInterval> | undefined
let heartRate = 66
let skinTemp = 33.8
let step = 0

function emit() {
  // Check on every beat of the timer: the simulator must stop the moment the profile changes.
  if (getActiveProfile().id !== DEMO_PROFILE_ID) {
    stopSimulator()
    return
  }
  step += 1
  // A slow swell around a resting rate, smoothed so it never jumps.
  const target = 66 + 6 * Math.sin(step / 9) + (Math.random() - 0.5) * 5
  heartRate = heartRate * 0.7 + target * 0.3
  skinTemp = Math.min(34.6, Math.max(33.2, skinTemp + (Math.random() - 0.5) * 0.1))
  const spo2 = Math.random() < 0.8 ? 97 : Math.random() < 0.5 ? 96 : 98
  pushVital({
    profileId: DEMO_PROFILE_ID,
    heartRate: Math.round(heartRate),
    spo2,
    skinTempC: Math.round(skinTemp * 10) / 10,
    source: 'simulated',
  })
}

/** Starts simulated vitals. Does nothing unless the active profile is the demo profile. */
export function startSimulator(): void {
  if (timer !== undefined || getActiveProfile().id !== DEMO_PROFILE_ID) return
  setRuntime({ simulatorOn: true })
  emit()
  timer = setInterval(emit, INTERVAL_MS)
}

export function stopSimulator(): void {
  if (timer !== undefined) clearInterval(timer)
  timer = undefined
  setRuntime({ simulatorOn: false })
}

/** Runs the simulator while the demo profile is active, and stops it on any other profile. */
export function installSimulator(): () => void {
  const sync = () =>
    getActiveProfile().id === DEMO_PROFILE_ID ? startSimulator() : stopSimulator()
  sync()
  const unsubscribe = useDataStore.subscribe((state, previous) => {
    if (state.activeProfileId !== previous.activeProfileId) sync()
  })
  return () => {
    unsubscribe()
    stopSimulator()
  }
}
