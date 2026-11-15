import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearMemoryStorage } from './persistence'
import {
  useAlerts,
  useHealthSummary,
  useLatestVitals,
  useMeals,
  useMission,
  useSeries,
  useTargets,
  useToday,
} from './selectors'
import {
  addMeal,
  addWater,
  createProfile,
  raiseAlert,
  resetStoreForTests,
  setActiveProfile,
  cancelAlert,
} from './store'
import { toDateString } from './dates'
import { metricIds, targetIds } from './types'

beforeEach(() => {
  localStorage.clear()
  clearMemoryStorage()
  resetStoreForTests()
})

function switchToNewMember() {
  act(() => {
    setActiveProfile(createProfile({ displayName: 'Test member' }))
  })
}

describe('mission', () => {
  it('is Ophiuchus-1 and counts the day from the start date', () => {
    const { result } = renderHook(() => useMission())
    expect(result.current.name).toBe('Ophiuchus-1')
    expect(result.current.startDate).toBe('2026-11-01')
    expect(result.current.day).toBeGreaterThanOrEqual(1)
  })
})

describe('targets', () => {
  it('has one entry for every target id, all unverified', () => {
    const { result } = renderHook(() => useTargets())
    expect(Object.keys(result.current).sort()).toEqual([...targetIds].sort())
    for (const target of Object.values(result.current)) {
      expect(target.sourceText).toBe('to be confirmed')
      expect(target.verified).toBe(false)
    }
  })

  it('computes energy and protein from body mass, with fixed defaults when it is unknown', () => {
    act(() => {
      setActiveProfile(createProfile({ displayName: 'Light', massKg: 60 }))
    })
    const light = renderHook(() => useTargets()).result.current
    act(() => {
      setActiveProfile(createProfile({ displayName: 'Heavy', massKg: 90 }))
    })
    const heavy = renderHook(() => useTargets()).result.current
    act(() => {
      setActiveProfile(createProfile({ displayName: 'Unknown' }))
    })
    const unknown = renderHook(() => useTargets()).result.current
    expect(heavy.energyKcal.value).toBeGreaterThan(light.energyKcal.value)
    expect(heavy.proteinG.value).toBeGreaterThan(light.proteinG.value)
    expect(unknown.energyKcal.value).toBe(3000)
    expect(unknown.proteinG.value).toBe(90)
  })
})

describe('today and series', () => {
  it('give every metric a value, target id, level and source', () => {
    const { result } = renderHook(() => useToday())
    expect(result.current.date).toBe(toDateString(new Date()))
    for (const id of metricIds) {
      expect(result.current[id].targetId).toBe(id)
    }
  })

  it('shows an empty member profile as missing, never as zero or made up', () => {
    switchToNewMember()
    const today = renderHook(() => useToday()).result.current
    for (const id of metricIds) {
      expect(today[id].value).toBeNull()
      expect(today[id].level).toBe('none')
      expect(today[id].source).toBeNull()
    }
    const series = renderHook(() => useSeries('sleepHours', 14)).result.current
    expect(series).toHaveLength(14)
    expect(series.every((p) => p.value === null)).toBe(true)
  })

  it('returns one entry per day, oldest first, with gaps left as gaps', () => {
    const { result } = renderHook(() => useSeries('bodyMassKg', 14))
    expect(result.current).toHaveLength(14)
    const dates = result.current.map((p) => p.date)
    expect([...dates].sort()).toEqual(dates)
    expect(dates.at(-1)).toBe(toDateString(new Date()))
    const withValue = result.current.filter((p) => p.value !== null)
    expect(withValue.length).toBeGreaterThan(0)
    expect(withValue.length).toBeLessThan(14)
  })

  it('updates when something is added', () => {
    switchToNewMember()
    const today = renderHook(() => useToday())
    act(() => addWater(250))
    expect(today.result.current.waterMl.value).toBe(250)
    expect(today.result.current.waterMl.source).toBe('entered')
  })

  it('counts a demo total that includes an entered record as simulated', () => {
    const today = renderHook(() => useToday())
    act(() => addWater(250))
    expect(today.result.current.waterMl.source).toBe('simulated')
  })

  it('lists meals with their food', () => {
    switchToNewMember()
    act(() => addMeal('almonds', 2))
    const { result } = renderHook(() => useMeals(toDateString(new Date())))
    expect(result.current).toHaveLength(1)
    expect(result.current[0]?.food.name).toBe('Almonds')
    expect(result.current[0]?.portions).toBe(2)
  })
})

describe('health summary', () => {
  it('has short phrases for the demo profile', () => {
    const { result } = renderHook(() => useHealthSummary())
    expect(result.current.sleep.text).toBe('7.2 h last night')
    expect(result.current.sleep.source).toBe('simulated')
    expect(result.current.mood.text).toBe('No check-in today')
    expect(result.current.mood.level).toBe('none')
    expect(result.current.ophiLine.length).toBeGreaterThan(10)
    expect(new Date(result.current.updatedAt).getTime()).not.toBeNaN()
  })

  it('says nothing is logged for an empty member profile', () => {
    switchToNewMember()
    const { result } = renderHook(() => useHealthSummary())
    for (const area of [
      result.current.sleep,
      result.current.food,
      result.current.water,
      result.current.exercise,
      result.current.mood,
    ]) {
      expect(area.level).toBe('none')
      expect(area.source).toBeNull()
    }
    expect(result.current.ophiLine).toBe(
      'Nothing logged yet today. A quick check-in gets your day started.',
    )
  })

  it('points to Emergency while an alert is open, and lets go when it is cancelled', () => {
    const { result } = renderHook(() => ({ summary: useHealthSummary(), alerts: useAlerts() }))
    let id = ''
    act(() => {
      id = raiseAlert('emergency', 'console', 'Test emergency')
    })
    expect(result.current.summary.openAlerts).toBe(1)
    expect(result.current.summary.ophiLine).toContain('Emergency')
    expect(result.current.alerts[0]?.id).toBe(id)
    act(() => cancelAlert(id))
    expect(result.current.summary.openAlerts).toBe(0)
  })
})

describe('alerts', () => {
  it('belong to the active profile and come newest first', () => {
    act(() => {
      raiseAlert('emergency', 'console', 'first')
    })
    const { result } = renderHook(() => useAlerts())
    expect(result.current).toHaveLength(1)
    switchToNewMember()
    expect(result.current).toHaveLength(0)
  })
})

describe('latest vitals', () => {
  it('reports off for a member with no sensor', () => {
    switchToNewMember()
    const { result } = renderHook(() => useLatestVitals())
    expect(result.current).toEqual({ latest: null, connection: 'off' })
  })

  it('has a reading from the seed for the demo profile', () => {
    const { result } = renderHook(() => useLatestVitals())
    expect(result.current.latest?.source).toBe('simulated')
    expect(result.current.connection).toBe('off')
  })
})
