import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AUTO_ALERT_LIMITS,
  autoAlertMessage,
  cancelAutoAlert,
  considerVital,
  createVitalsWatch,
  detectFall,
  getAutoAlertState,
  resetAutoAlertForTests,
  setVitalsWatch,
  simulateAutoAlert,
  type MotionSample,
} from './autoAlert'
import {
  createProfile,
  getActiveProfile,
  resetStoreForTests,
  setActiveProfile,
  useDataStore,
} from './store'
import type { VitalSample } from './types'

const G = 9.80665
const STEP_MS = 20 // 50 readings a second

/** Builds samples from segments: each holds `ms` of a vector (in g) produced per time step. */
function samples(...segments: { ms: number; at: (t: number) => [number, number, number] }[]) {
  const out: MotionSample[] = []
  let t = 0
  for (const segment of segments) {
    const end = t + segment.ms
    for (; t < end; t += STEP_MS) {
      const [x, y, z] = segment.at(t)
      out.push({ t, x: x * G, y: y * G, z: z * G })
    }
  }
  return out
}

const upright = { ms: 1500, at: (): [number, number, number] => [0, 1, 0] }
const weightless = (ms: number) => ({ ms, at: (): [number, number, number] => [0, 0.1, 0.05] })
const impact = { ms: 60, at: (): [number, number, number] => [1.5, 3, 1] }
const lyingStill = { ms: 3500, at: (): [number, number, number] => [0.02, 0.05, 1] }
const standingStill = { ms: 3500, at: (): [number, number, number] => [0.02, 1, 0.03] }

describe('detectFall', () => {
  it('finds a fall: weightless, impact, then still in a new position', () => {
    expect(detectFall(samples(upright, weightless(300), impact, lyingStill))).toBe(true)
  })

  it('needs the stillness to be complete before deciding', () => {
    const shortStill = { ...lyingStill, ms: 1500 }
    expect(detectFall(samples(upright, weightless(300), impact, shortStill))).toBe(false)
  })

  it('ignores a jump: the person lands and stands, held the same way', () => {
    expect(detectFall(samples(upright, weightless(350), impact, standingStill))).toBe(false)
  })

  it('ignores a jump followed by walking away', () => {
    const walking = {
      ms: 3500,
      at: (t: number): [number, number, number] => [0.1, 1 + 0.35 * Math.sin(t / 80), 0.1],
    }
    expect(detectFall(samples(upright, weightless(350), impact, walking))).toBe(false)
  })

  it('ignores a phone put down on a table', () => {
    // It turns from upright to flat over half a second with a small bump, never weightless.
    const turning = {
      ms: 500,
      at: (t: number): [number, number, number] => {
        const k = Math.min(1, (t - 1500) / 500)
        return [0, Math.cos((k * Math.PI) / 2), Math.sin((k * Math.PI) / 2)]
      },
    }
    const bump = { ms: 40, at: (): [number, number, number] => [0, 0.1, 1.3] }
    expect(detectFall(samples(upright, turning, bump, lyingStill))).toBe(false)
  })

  it('ignores walking', () => {
    const walking = {
      ms: 6000,
      at: (t: number): [number, number, number] => [
        0.15 * Math.sin(t / 160),
        1 + 0.4 * Math.sin(t / 80),
        0.1,
      ],
    }
    expect(detectFall(samples(walking))).toBe(false)
  })

  it('ignores a weightless moment too short to be a fall', () => {
    expect(detectFall(samples(upright, weightless(40), impact, lyingStill))).toBe(false)
  })
})

describe('the vital-sign watch', () => {
  const second = 1000

  it('triggers when heart rate stays high for 20 seconds, not before', () => {
    const watch = createVitalsWatch()
    for (let s = 0; s < 20; s++) expect(watch.push({ t: s * second, heartRate: 182 })).toBeNull()
    expect(watch.push({ t: 20 * second, heartRate: 182 })).toEqual({
      cause: 'heart-rate',
      value: 182,
    })
  })

  it('triggers on a low heart rate and on low blood oxygen', () => {
    const low = createVitalsWatch()
    let fired = null
    for (let s = 0; s <= 20; s++) fired = low.push({ t: s * second, heartRate: 34 }) ?? fired
    expect(fired).toEqual({ cause: 'heart-rate', value: 34 })

    const oxygen = createVitalsWatch()
    fired = null
    for (let s = 0; s <= 20; s++) fired = oxygen.push({ t: s * second, spo2: 86 }) ?? fired
    expect(fired).toEqual({ cause: 'oxygen', value: 86 })
  })

  it('starts the 20 seconds again when the value comes back in range', () => {
    const watch = createVitalsWatch()
    for (let s = 0; s < 15; s++) watch.push({ t: s * second, heartRate: 175 })
    watch.push({ t: 15 * second, heartRate: 120 })
    for (let s = 16; s < 35; s++) expect(watch.push({ t: s * second, heartRate: 175 })).toBeNull()
    expect(watch.push({ t: 36 * second, heartRate: 175 })).not.toBeNull()
  })

  it('does not bridge a long silence between readings', () => {
    const watch = createVitalsWatch()
    watch.push({ t: 0, heartRate: 180 })
    expect(watch.push({ t: 25 * second, heartRate: 180 })).toBeNull()
  })

  it('fires once per episode, and again only after a minute back in range', () => {
    const watch = createVitalsWatch()
    let t = 0
    const feed = (value: number, seconds: number) => {
      let count = 0
      for (let s = 0; s < seconds; s++, t += second) {
        if (watch.push({ t, heartRate: value })) count++
      }
      return count
    }
    expect(feed(180, 60)).toBe(1) // one trigger, however long it lasts
    expect(feed(90, 30)).toBe(0) // in range for only half a minute
    expect(feed(180, 40)).toBe(0) // still the same episode
    expect(feed(90, 61)).toBe(0) // a full minute back in range ends the episode
    expect(feed(180, 25)).toBe(1) // a new episode
  })
})

describe('the message', () => {
  it('uses the exact forms, with and without a role', () => {
    expect(autoAlertMessage('fall', null, '', false)).toBe('Fall detected, no response')
    expect(autoAlertMessage('fall', null, 'Flight engineer', false)).toBe(
      'Fall detected, no response · Flight engineer',
    )
    expect(autoAlertMessage('heart-rate', 182, '', false)).toBe(
      'Heart rate 182 bpm for 20 seconds, no response',
    )
    expect(autoAlertMessage('oxygen', 86, 'Commander', false)).toBe(
      'Blood oxygen 86% for 20 seconds, no response · Commander',
    )
    expect(autoAlertMessage('fall', null, 'Flight engineer', true)).toBe(
      'Fall detected, no response · Flight engineer (test)',
    )
  })
})

describe('the countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetStoreForTests()
    resetAutoAlertForTests()
  })

  afterEach(() => {
    cancelAutoAlert()
    vi.useRealTimers()
  })

  const emergencies = () => useDataStore.getState().alerts.filter((a) => a.kind === 'emergency')

  it('counts down from 10 and raises the alert when it runs out', () => {
    simulateAutoAlert('fall')
    expect(getAutoAlertState().pending).toEqual({ cause: 'fall', secondsLeft: 10 })
    vi.advanceTimersByTime(3000)
    expect(getAutoAlertState().pending?.secondsLeft).toBe(7)
    expect(emergencies()).toHaveLength(0)
    vi.advanceTimersByTime(7000)
    expect(getAutoAlertState().pending).toBeNull()
    const [alert] = emergencies()
    expect(alert).toMatchObject({
      kind: 'emergency',
      origin: 'console',
      status: 'open',
      screenId: 'emergency',
    })
    const role = getActiveProfile().role
    expect(alert?.message).toBe(`Fall detected, no response${role ? ` · ${role}` : ''} (test)`)
    expect(alert?.message).not.toContain(getActiveProfile().displayName)
  })

  it('raises nothing when the person answers in time', () => {
    simulateAutoAlert('heart-rate')
    vi.advanceTimersByTime(6000)
    cancelAutoAlert()
    expect(getAutoAlertState().pending).toBeNull()
    vi.advanceTimersByTime(20_000)
    expect(emergencies()).toHaveLength(0)
  })

  it('says the simulated heart-rate value and marks it as a test', () => {
    simulateAutoAlert('heart-rate')
    vi.advanceTimersByTime(AUTO_ALERT_LIMITS.countdownSeconds * 1000)
    expect(emergencies()[0]?.message).toMatch(
      /^Heart rate 182 bpm for 20 seconds, no response( · .+)? \(test\)$/,
    )
  })

  it('never starts a countdown from simulated readings', () => {
    expect(getActiveProfile().id).toBe('demo')
    setVitalsWatch(true)
    const start = Date.now()
    for (let s = 0; s <= 40; s++) {
      const sample: VitalSample = {
        id: `v${s}`,
        profileId: 'demo',
        at: new Date(start + s * 1000).toISOString(),
        heartRate: 190,
        spo2: 80,
        source: 'simulated',
      }
      considerVital(sample)
    }
    expect(getAutoAlertState().pending).toBeNull()
  })

  it('starts from live readings on a member profile and names the role, never the name', () => {
    const id = createProfile({ displayName: 'Test member', role: 'Commander' })
    setActiveProfile(id)
    const start = Date.now()
    for (let s = 0; s <= 20; s++) {
      considerVital({
        id: `v${s}`,
        profileId: id,
        at: new Date(start + s * 1000).toISOString(),
        heartRate: 182,
        source: 'live',
      })
    }
    expect(getAutoAlertState().pending).toEqual({ cause: 'heart-rate', secondsLeft: 10 })
    vi.advanceTimersByTime(10_000)
    const [alert] = emergencies()
    expect(alert?.message).toBe('Heart rate 182 bpm for 20 seconds, no response · Commander')
    expect(alert?.message).not.toContain('Test member')
  })

  it('stays quiet when the vital-sign watch is off', () => {
    const id = createProfile({ displayName: 'Test member' })
    setActiveProfile(id)
    setVitalsWatch(false)
    const start = Date.now()
    for (let s = 0; s <= 30; s++) {
      considerVital({
        id: `v${s}`,
        profileId: id,
        at: new Date(start + s * 1000).toISOString(),
        spo2: 80,
        source: 'live',
      })
    }
    expect(getAutoAlertState().pending).toBeNull()
  })
})
