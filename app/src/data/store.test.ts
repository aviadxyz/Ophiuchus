import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMemoryStorage, STORAGE_PREFIX, STORE_KEY } from './persistence'
import { useRuntime } from './runtime'
import { startSimulator, stopSimulator } from './simulator'
import {
  acknowledgeAlert,
  addBodyMass,
  addMeal,
  addMoodCheckin,
  addSleep,
  addWater,
  cancelAlert,
  createProfile,
  deleteProfileData,
  initializeStore,
  logGameMinutes,
  pushVital,
  raiseAlert,
  removeMeal,
  removeWater,
  resetDemoProfile,
  resetStoreForTests,
  setActiveProfile,
  setSessionStatus,
  updateMoodCheckin,
  updateProfile,
  useDataStore,
} from './store'
import { toDateString } from './dates'

const state = () => useDataStore.getState()
const activeData = () => state().data[state().activeProfileId]!

function newMember(name = 'Test member') {
  const id = createProfile({ displayName: name })
  setActiveProfile(id)
  return id
}

beforeEach(() => {
  localStorage.clear()
  clearMemoryStorage()
  resetStoreForTests()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('first load', () => {
  it('creates the demo profile and makes it active', () => {
    expect(state().activeProfileId).toBe('demo')
    expect(state().profiles.map((p) => p.id)).toEqual(['demo'])
    expect(state().data['demo']!.sleep).toHaveLength(14)
  })

  it('saves everything under the ophiuchus:v1: prefix', () => {
    addWater(250)
    const keys = Object.keys(localStorage)
    expect(keys.length).toBeGreaterThan(0)
    for (const key of keys) expect(key.startsWith(STORAGE_PREFIX)).toBe(true)
  })
})

describe('profiles', () => {
  it('creates a member with both consents off by default', () => {
    const id = createProfile({ displayName: '  Test member  ', role: 'Medic' })
    const profile = state().profiles.find((p) => p.id === id)!
    expect(profile.kind).toBe('member')
    expect(profile.displayName).toBe('Test member')
    expect(profile.consent).toEqual({ relay: false, assistant: false })
  })

  it('requires a display name', () => {
    expect(() => createProfile({ displayName: '   ' })).toThrow()
  })

  it('records optional body mass and last night’s sleep as entered values', () => {
    const id = createProfile({ displayName: 'Test member', massKg: 70, lastNightSleepHours: 6.5 })
    const data = state().data[id]!
    expect(data.bodyMass).toHaveLength(1)
    expect(data.bodyMass[0]).toMatchObject({ kg: 70, source: 'entered' })
    expect(data.sleep[0]).toMatchObject({ hours: 6.5, source: 'entered' })
  })

  it('gives a member today’s plan, as planned sessions', () => {
    const id = createProfile({ displayName: 'Test member' })
    const sessions = state().data[id]!.sessions
    expect(sessions).toHaveLength(2)
    expect(sessions.every((s) => s.status === 'planned')).toBe(true)
  })

  it('does not change the demo profile', () => {
    updateProfile('demo', { displayName: 'Someone else', consent: { relay: true } })
    const demo = state().profiles.find((p) => p.id === 'demo')!
    expect(demo.displayName).toBe('Demo crew member')
    expect(demo.consent.relay).toBe(false)
  })

  it('updates a member’s consent switches one at a time', () => {
    const id = newMember()
    updateProfile(id, { consent: { assistant: true } })
    expect(state().profiles.find((p) => p.id === id)!.consent).toEqual({
      relay: false,
      assistant: true,
    })
  })
})

describe('writes', () => {
  it('stamp entered values, on the active profile only', () => {
    const id = newMember()
    addMeal('almonds', 2)
    addWater(250)
    addMoodCheckin(4, ['calm', 'calm', ' '], '  fine  ')
    addSleep(toDateString(new Date()), 7.25, 4)
    addBodyMass(70.04)
    const data = state().data[id]!
    expect(data.meals[0]).toMatchObject({ foodId: 'almonds', portions: 2, source: 'entered' })
    expect(data.water[0]).toMatchObject({ ml: 250, source: 'entered' })
    expect(data.moods[0]).toMatchObject({
      score: 4,
      tags: ['calm'],
      note: 'fine',
      source: 'entered',
    })
    expect(data.sleep.at(-1)).toMatchObject({ hours: 7.3, quality: 4, source: 'entered' })
    expect(data.bodyMass.at(-1)).toMatchObject({ kg: 70, source: 'entered' })
    expect(state().data['demo']!.water.some((w) => w.source === 'entered')).toBe(false)
  })

  it('ignore nonsense instead of storing it', () => {
    newMember()
    addMeal('no-such-food', 1)
    addMeal('almonds', -1)
    addWater(Number.NaN)
    addMoodCheckin(9, [])
    expect(activeData().meals).toHaveLength(0)
    expect(activeData().water).toHaveLength(0)
    expect(activeData().moods).toHaveLength(0)
  })

  it('remove what was added', () => {
    newMember()
    addMeal('almonds', 1)
    addWater(250)
    removeMeal(activeData().meals[0]!.id)
    removeWater(activeData().water[0]!.id)
    expect(activeData().meals).toHaveLength(0)
    expect(activeData().water).toHaveLength(0)
  })

  it('replace a second sleep entry for the same morning', () => {
    newMember()
    const today = toDateString(new Date())
    addSleep(today, 6, 3)
    addSleep(today, 7, 4)
    expect(activeData().sleep.filter((s) => s.date === today)).toHaveLength(1)
    expect(activeData().sleep[0]!.hours).toBe(7)
  })

  it('edit a mood check-in and clear its note', () => {
    newMember()
    addMoodCheckin(3, ['tired'], 'slow day')
    const id = activeData().moods[0]!.id
    updateMoodCheckin(id, { score: 4, note: '' })
    expect(activeData().moods[0]).toMatchObject({ score: 4, tags: ['tired'] })
    expect(activeData().moods[0]).not.toHaveProperty('note')
  })

  it('mark a session done with changes, skipped and planned again', () => {
    newMember()
    const id = activeData().sessions[0]!.id
    setSessionStatus(id, 'changed', 40)
    expect(activeData().sessions[0]).toMatchObject({ status: 'changed', actualMinutes: 40 })
    setSessionStatus(id, 'skipped', undefined, 'Not feeling well')
    expect(activeData().sessions[0]).toMatchObject({
      status: 'skipped',
      actualMinutes: 0,
      skipReason: 'Not feeling well',
    })
    setSessionStatus(id, 'done')
    expect(activeData().sessions[0]).toMatchObject({ status: 'done', actualMinutes: 60 })
    expect(activeData().sessions[0]).not.toHaveProperty('skipReason')
  })

  it('log game minutes as a done aerobic session', () => {
    newMember()
    logGameMinutes('futvolley', 12)
    expect(activeData().sessions.at(-1)).toMatchObject({
      device: 'game',
      kind: 'aerobic',
      status: 'done',
      actualMinutes: 12,
      source: 'entered',
    })
  })
})

describe('alerts', () => {
  it('raise, cancel and acknowledge', () => {
    const first = raiseAlert('emergency', 'console', 'Test emergency')
    const second = raiseAlert('health', 'console', 'A question', 'medbot')
    expect(state().alerts.find((a) => a.id === first)).toMatchObject({
      status: 'open',
      kind: 'emergency',
    })
    cancelAlert(first)
    acknowledgeAlert(second)
    expect(state().alerts.find((a) => a.id === first)!.status).toBe('cancelled')
    const acknowledged = state().alerts.find((a) => a.id === second)!
    expect(acknowledged.status).toBe('acknowledged')
    expect(acknowledged.acknowledgedAt).toBeDefined()
    expect(acknowledged.screenId).toBe('medbot')
  })
})

describe('a member profile never receives simulated records', () => {
  it('drops a simulated reading', () => {
    const id = newMember()
    pushVital({ heartRate: 70, source: 'simulated' })
    expect(state().data[id]!.vitals).toHaveLength(0)
    expect(useRuntime.getState().latestVital[id]).toBeUndefined()
  })

  it('keeps a live reading, and the demo profile refuses it', () => {
    const id = newMember()
    pushVital({ heartRate: 70, source: 'live' })
    expect(state().data[id]!.vitals).toHaveLength(1)
    const before = state().data['demo']!.vitals.length
    pushVital({ profileId: 'demo', heartRate: 70, source: 'live' })
    expect(state().data['demo']!.vitals).toHaveLength(before)
  })

  it('refuses out-of-range values', () => {
    const id = newMember()
    pushVital({ heartRate: 900, spo2: 5, source: 'live' })
    expect(state().data[id]!.vitals).toHaveLength(0)
  })

  it('keeps one reading in the saved history every five minutes, and the newest always live', () => {
    const id = newMember()
    const t0 = Date.now()
    for (let i = 0; i < 6; i++) {
      pushVital({ heartRate: 60 + i, source: 'live', at: new Date(t0 + i * 60_000).toISOString() })
    }
    expect(state().data[id]!.vitals).toHaveLength(2)
    expect(useRuntime.getState().latestVital[id]!.heartRate).toBe(65)
  })

  it('never starts the simulator on a member, and stops it on switching to one', () => {
    vi.useFakeTimers()
    startSimulator()
    expect(useRuntime.getState().simulatorOn).toBe(true)
    vi.advanceTimersByTime(9000)
    const demoVitals = state().data['demo']!.vitals.length
    expect(demoVitals).toBeGreaterThan(0)

    const id = newMember()
    vi.advanceTimersByTime(9000)
    expect(useRuntime.getState().simulatorOn).toBe(false)
    expect(state().data[id]!.vitals).toHaveLength(0)

    startSimulator()
    expect(useRuntime.getState().simulatorOn).toBe(false)
    stopSimulator()
  })
})

describe('deleteProfileData', () => {
  it('leaves nothing behind', () => {
    const demoBefore = JSON.stringify(state().data['demo'])
    const id = newMember('Test member')
    addMeal('almonds', 1)
    addWater(250)
    addMoodCheckin(3, ['tired'], 'a private note')
    addSleep(toDateString(new Date()), 6)
    addBodyMass(70)
    pushVital({ heartRate: 70, source: 'live' })
    raiseAlert('emergency', 'console', 'Test emergency')
    expect(localStorage.getItem(STORE_KEY)).toContain(id)

    deleteProfileData(id)

    expect(state().profiles.map((p) => p.id)).toEqual(['demo'])
    expect(state().data[id]).toBeUndefined()
    expect(state().alerts.filter((a) => a.profileId === id)).toHaveLength(0)
    expect(state().activeProfileId).toBe('demo')
    expect(useRuntime.getState().latestVital[id]).toBeUndefined()
    const saved = localStorage.getItem(STORE_KEY)!
    expect(saved).not.toContain(id)
    expect(saved).not.toContain('a private note')
    expect(saved).not.toContain('Test member')
    expect(JSON.stringify(state().data['demo'])).toBe(demoBefore)
  })

  it('cannot delete the demo profile', () => {
    const before = JSON.stringify(state().data['demo'])
    deleteProfileData('demo')
    expect(state().profiles.some((p) => p.id === 'demo')).toBe(true)
    expect(JSON.stringify(state().data['demo'])).toBe(before)
  })
})

describe('resetDemoProfile', () => {
  it('restores the seed and clears the demo alerts', () => {
    const ids = (d: ReturnType<typeof activeData>) =>
      Object.values(d)
        .flat()
        .map((r) => r.id)
        .sort()
    const seededIds = ids(state().data['demo']!)
    addWater(250)
    addMoodCheckin(5, [])
    raiseAlert('emergency', 'console', 'Test emergency')
    expect(ids(state().data['demo']!)).not.toEqual(seededIds)
    resetDemoProfile()
    expect(ids(state().data['demo']!)).toEqual(seededIds)
    expect(
      Object.values(state().data['demo']!)
        .flat()
        .every((r) => r.source === 'simulated'),
    ).toBe(true)
    expect(state().alerts.filter((a) => a.profileId === 'demo')).toHaveLength(0)
  })

  it('leaves member profiles alone', () => {
    const id = newMember()
    addWater(500)
    setActiveProfile('demo')
    resetDemoProfile()
    expect(state().data[id]!.water).toHaveLength(1)
  })
})

describe('saving and loading', () => {
  it('keeps what was entered after a reload', async () => {
    const id = newMember('Test member')
    addMeal('almonds', 1)
    vi.resetModules()
    const reloaded = await import('./store')
    const reloadedState = reloaded.useDataStore.getState()
    expect(reloadedState.activeProfileId).toBe(id)
    expect(reloadedState.profiles.map((p) => p.id)).toContain(id)
    expect(reloadedState.data[id]!.meals).toHaveLength(1)
  })

  it('survives corrupted storage', async () => {
    localStorage.setItem(STORE_KEY, '{this is not json')
    vi.resetModules()
    const fresh = await import('./store')
    expect(fresh.useDataStore.getState().activeProfileId).toBe('demo')
    expect(fresh.useDataStore.getState().data['demo']!.sleep).toHaveLength(14)
  })

  it('survives saved data of the wrong shape', async () => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        state: {
          profiles: 'nope',
          data: { demo: { meals: [{ id: 1 }, null, 'x'] } },
          alerts: [{ id: 'a' }],
          activeProfileId: 42,
        },
        version: 1,
      }),
    )
    vi.resetModules()
    const fresh = await import('./store')
    const s = fresh.useDataStore.getState()
    expect(s.activeProfileId).toBe('demo')
    expect(s.alerts).toEqual([])
    expect(s.data['demo']!.meals.every((m) => typeof m.id === 'string')).toBe(true)
  })

  it('drops unreadable records but keeps the rest', async () => {
    const id = newMember('Test member')
    addMeal('almonds', 1)
    const saved = JSON.parse(localStorage.getItem(STORE_KEY)!)
    saved.state.data[id].meals.push({ id: 'broken', portions: 'many' })
    localStorage.setItem(STORE_KEY, JSON.stringify(saved))
    vi.resetModules()
    const fresh = await import('./store')
    expect(fresh.useDataStore.getState().data[id]!.meals).toHaveLength(1)
  })

  it('keeps working when storage refuses to save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(() => {
      newMember()
      addMeal('almonds', 1)
    }).not.toThrow()
    expect(activeData().meals).toHaveLength(1)
  })

  it('keeps working when storage is missing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    expect(() => addWater(250)).not.toThrow()
  })

  it('rebuilds the demo profile when the date has moved on', () => {
    const seeded = state().data['demo']!.sleep.at(-1)!.date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    initializeStore(tomorrow)
    const rebuilt = useDataStore.getState().data['demo']!.sleep.at(-1)!.date
    expect(rebuilt).not.toBe(seeded)
    expect(rebuilt).toBe(toDateString(tomorrow))
  })
})
