import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  autoAlertMessage,
  AUTO_ALERT_LIMITS,
  cancelAutoAlert,
  considerVital,
  createMotionWatch,
  createVitalsWatch,
  getAutoAlertState,
  nextCrewDayStart,
  outsideCrewDay,
  resetAutoAlertForTests,
  setSleepingNow,
  setVitalsWatch,
  simulateAutoAlert,
  type MotionTrigger,
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
type Vec = [number, number, number]

/** Feeds `ms` of readings (vectors in g, produced per time step) and returns what was found, with when. */
function feed(
  watch: ReturnType<typeof createMotionWatch>,
  from: number,
  ms: number,
  at: (t: number) => Vec,
  asleep = false,
) {
  const found: { t: number; what: MotionTrigger }[] = []
  for (let t = from; t < from + ms; t += STEP_MS) {
    const [x, y, z] = at(t)
    const what = watch.push({ t, x: x * G, y: y * G, z: z * G }, asleep)
    if (what) found.push({ t, what })
  }
  return found
}

/** Sensor noise of a few thousandths of a g. */
const noise = (t: number) => 0.004 * Math.sin(t * 0.37)
/** Floating in orbit: no gravity, the device reads almost nothing. */
const floating = (t: number): Vec => [noise(t), noise(t + 1), noise(t + 2)]
/** Lying on a table on Earth: 1 g, always the same way. */
const onTable = (t: number): Vec => [noise(t), noise(t + 1), 1 + noise(t + 2)]
/** Ordinary work with the arms: changes of up to about 1.5 g. */
const working = (t: number): Vec => [0.8 * Math.sin(t / 150), 0.6 * Math.sin(t / 90), 0.3]

const minute = 60_000
const still = AUTO_ALERT_LIMITS.motion.stillMs

describe('the motion check', () => {
  it('finds a sudden hard movement while floating in orbit', () => {
    const watch = createMotionWatch()
    expect(feed(watch, 0, 1000, floating)).toEqual([])
    expect(watch.push({ t: 1000, x: 2.5 * G, y: 2 * G, z: 1 * G }, false)).toBe('sudden')
  })

  it('finds the same blow on Earth, on top of gravity', () => {
    const watch = createMotionWatch()
    feed(watch, 0, 1000, onTable)
    expect(watch.push({ t: 1000, x: 0, y: 3.5 * G, z: 1 * G }, false)).toBe('sudden')
  })

  it('ignores ordinary movement', () => {
    expect(feed(createMotionWatch(), 0, 3 * minute, working)).toEqual([])
  })

  it('finds no movement for two minutes, once, while awake', () => {
    const found = feed(createMotionWatch(), 0, 5 * minute, floating)
    expect(found).toHaveLength(1)
    expect(found[0]?.what).toBe('still')
    expect(found[0]?.t).toBeGreaterThanOrEqual(still)
    expect(found[0]?.t).toBeLessThan(still + 1000)
  })

  it('counts a device lying still on Earth as no movement too', () => {
    const found = feed(createMotionWatch(), 0, 3 * minute, onTable)
    expect(found.map((f) => f.what)).toEqual(['still'])
  })

  it('never reports no movement while the person is asleep, but still reports a blow', () => {
    const watch = createMotionWatch()
    expect(feed(watch, 0, 10 * minute, floating, true)).toEqual([])
    expect(watch.push({ t: 10 * minute, x: 3.5 * G, y: 0, z: 0 }, true)).toBe('sudden')
  })

  it('starts the two minutes when the person should be awake, not from when they fell asleep', () => {
    const watch = createMotionWatch()
    feed(watch, 0, 10 * minute, floating, true)
    const found = feed(watch, 10 * minute, 3 * minute, floating, false)
    expect(found).toHaveLength(1)
    expect(found[0]!.t - 10 * minute).toBeGreaterThanOrEqual(still - STEP_MS)
  })

  it('fires again only after the device has moved', () => {
    const watch = createMotionWatch()
    let t = 0
    expect(feed(watch, t, 4 * minute, floating)).toHaveLength(1)
    t += 4 * minute
    feed(watch, t, 1000, (u) => [0.3 * Math.sin(u / 50), 0, 0]) // a small movement
    t += 1000
    expect(feed(watch, t, 3 * minute, floating)).toHaveLength(1)
  })

  it('stays quiet when the person moves a little every minute', () => {
    const watch = createMotionWatch()
    let found: unknown[] = []
    for (let t = 0; t < 10 * minute; t += minute) {
      found = found.concat(feed(watch, t, minute - 1000, floating))
      found = found.concat(
        feed(watch, t + minute - 1000, 1000, (u) => [0.2 * Math.sin(u / 40), 0, 0]),
      )
    }
    expect(found).toEqual([])
  })

  it('does not count a silent sensor as stillness', () => {
    const watch = createMotionWatch()
    feed(watch, 0, 100_000, floating)
    // Ten seconds with no readings at all (page hidden, sensor paused), then more stillness.
    expect(feed(watch, 110_000, 100_000, floating)).toEqual([])
  })
})

describe('the crew day', () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 15, h, m)

  it('is 07:00 to 23:00', () => {
    expect(outsideCrewDay(at(6, 59))).toBe(true)
    expect(outsideCrewDay(at(7, 0))).toBe(false)
    expect(outsideCrewDay(at(22, 59))).toBe(false)
    expect(outsideCrewDay(at(23, 0))).toBe(true)
  })

  it('ends a nap switch at the next 07:00', () => {
    expect(nextCrewDayStart(at(14, 0))).toEqual(new Date(2026, 10, 16, 7, 0))
    expect(nextCrewDayStart(at(5, 0))).toEqual(new Date(2026, 10, 15, 7, 0))
  })

  it('remembers the switch on this device', () => {
    resetAutoAlertForTests()
    setSleepingNow(true)
    expect(getAutoAlertState().sleepingNow).toBe(true)
    setSleepingNow(false)
    expect(getAutoAlertState().sleepingNow).toBe(false)
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
    const sudden = { cause: 'fall', motion: 'sudden' } as const
    const stillness = { cause: 'fall', motion: 'still' } as const
    expect(autoAlertMessage(sudden, '', false)).toBe('Sudden hard movement detected, no response')
    expect(autoAlertMessage(stillness, 'Flight engineer', false)).toBe(
      'No movement for 2 minutes, no response · Flight engineer',
    )
    expect(autoAlertMessage({ cause: 'heart-rate', value: 182 }, '', false)).toBe(
      'Heart rate 182 bpm for 20 seconds, no response',
    )
    expect(autoAlertMessage({ cause: 'oxygen', value: 86 }, 'Commander', false)).toBe(
      'Blood oxygen 86% for 20 seconds, no response · Commander',
    )
    expect(autoAlertMessage(stillness, 'Flight engineer', true)).toBe(
      'No movement for 2 minutes, no response · Flight engineer (test)',
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
    expect(alert?.message).toBe(
      `No movement for 2 minutes, no response${role ? ` · ${role}` : ''} (test)`,
    )
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
