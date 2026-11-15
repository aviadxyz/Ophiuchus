import { describe, expect, it } from 'vitest'
import type { ExerciseSession } from '@/data'
import {
  coverageLabel,
  coverageTone,
  getCoverageScores,
  getMondayOfWeek,
  getStreak,
  getTodayStatus,
  getWeeklyCounts,
  getWeekViewData,
} from './compute'

function makeSession(overrides: Partial<ExerciseSession>): ExerciseSession {
  return {
    id: 'test-session',
    profileId: 'demo',
    date: '2026-11-15',
    device: 'resistive',
    kind: 'resistive',
    plannedMinutes: 60,
    actualMinutes: 60,
    status: 'done',
    source: 'simulated',
    ...overrides,
  }
}

describe('Coverage scores', () => {
  it('calculates bone loading, muscle, and cardio scores correctly', () => {
    const sessions: ExerciseSession[] = [
      makeSession({
        id: '1',
        date: '2026-11-10',
        device: 'resistive',
        kind: 'resistive',
        actualMinutes: 120,
        status: 'done',
      }),
      makeSession({
        id: '2',
        date: '2026-11-11',
        device: 'treadmill',
        kind: 'aerobic',
        actualMinutes: 60,
        status: 'done',
      }),
      makeSession({
        id: '3',
        date: '2026-11-12',
        device: 'cycle',
        kind: 'aerobic',
        actualMinutes: 90,
        status: 'done',
      }),
      makeSession({
        id: '4',
        date: '2026-11-13',
        device: 'game',
        kind: 'aerobic',
        actualMinutes: 30,
        status: 'done',
      }),
      // Skipped session should not count toward actual minutes
      makeSession({
        id: '5',
        date: '2026-11-14',
        device: 'resistive',
        kind: 'resistive',
        actualMinutes: 0,
        status: 'skipped',
      }),
    ]

    const fromDate = '2026-11-09'
    const toDate = '2026-11-15'
    const scores = getCoverageScores(sessions, fromDate, toDate)

    // Resistive: 120 min
    // Treadmill: 60 min
    // Aerobic: 60 (treadmill) + 90 (cycle) + 30 (game) = 180 min
    // Bone loading: (120 + 0.5 * 60) / 240 = 150 / 240 = 0.625 -> 0.63
    // Muscle: 120 / 240 = 0.5
    // Cardio: 180 / 300 = 0.6
    expect(scores.boneLoading.actualMinutes).toBe(150)
    expect(scores.boneLoading.score).toBe(0.63)
    expect(scores.boneLoading.tone).toBe('danger')

    expect(scores.muscle.actualMinutes).toBe(120)
    expect(scores.muscle.score).toBe(0.5)
    expect(scores.muscle.tone).toBe('danger')

    expect(scores.cardiovascular.actualMinutes).toBe(180)
    expect(scores.cardiovascular.score).toBe(0.6)
    expect(scores.cardiovascular.tone).toBe('danger')
  })

  it('caps scores at 1.0 and assigns correct tones', () => {
    const sessions: ExerciseSession[] = [
      makeSession({
        date: '2026-11-10',
        device: 'resistive',
        kind: 'resistive',
        actualMinutes: 300,
        status: 'done',
      }),
      makeSession({
        date: '2026-11-11',
        device: 'cycle',
        kind: 'aerobic',
        actualMinutes: 350,
        status: 'done',
      }),
    ]

    const scores = getCoverageScores(sessions, '2026-11-09', '2026-11-15')
    expect(scores.muscle.score).toBe(1)
    expect(scores.muscle.tone).toBe('ok')
    expect(coverageLabel(scores.muscle.tone)).toBe('ON TARGET')

    expect(scores.cardiovascular.score).toBe(1)
    expect(scores.cardiovascular.tone).toBe('ok')
  })

  it('assigns warn tone between 0.7 and 0.9', () => {
    expect(coverageTone(0.95)).toBe('ok')
    expect(coverageTone(0.9)).toBe('ok')
    expect(coverageTone(0.85)).toBe('warn')
    expect(coverageTone(0.7)).toBe('warn')
    expect(coverageTone(0.69)).toBe('danger')
    expect(coverageTone(0)).toBe('danger')
  })
})

describe('Weekly counts and Monday calculation', () => {
  it('correctly calculates Monday of the week', () => {
    // 2026-11-15 is Sunday -> Monday is 2026-11-09
    expect(getMondayOfWeek('2026-11-15')).toBe('2026-11-09')
    // 2026-11-09 is Monday -> Monday is 2026-11-09
    expect(getMondayOfWeek('2026-11-09')).toBe('2026-11-09')
    // 2026-11-11 is Wednesday -> Monday is 2026-11-09
    expect(getMondayOfWeek('2026-11-11')).toBe('2026-11-09')
  })

  it('counts done and changed sessions Monday to today', () => {
    const monday = '2026-11-09'
    const today = '2026-11-15'
    const sessions: ExerciseSession[] = [
      // Before this week - should not count
      makeSession({ date: '2026-11-08', kind: 'resistive', status: 'done' }),
      // This week resistive done
      makeSession({ date: '2026-11-09', kind: 'resistive', status: 'done' }),
      // This week resistive changed
      makeSession({ date: '2026-11-10', kind: 'resistive', status: 'changed' }),
      // This week resistive skipped - should not count
      makeSession({ date: '2026-11-11', kind: 'resistive', status: 'skipped' }),
      // This week aerobic cycle done
      makeSession({ date: '2026-11-12', device: 'cycle', kind: 'aerobic', status: 'done' }),
      // This week aerobic game done
      makeSession({ date: '2026-11-13', device: 'game', kind: 'aerobic', status: 'done' }),
      // This week aerobic planned - should not count
      makeSession({ date: '2026-11-15', device: 'treadmill', kind: 'aerobic', status: 'planned' }),
    ]

    const counts = getWeeklyCounts(sessions, monday, today)
    expect(counts.resistiveCount).toBe(2)
    expect(counts.aerobicCount).toBe(2)
    expect(counts.totalCount).toBe(4)
    expect(counts.hasData).toBe(true)
  })

  it('marks hasData as false when sessions are empty or only planned', () => {
    const emptyCounts = getWeeklyCounts([], '2026-11-09', '2026-11-15')
    expect(emptyCounts.resistiveCount).toBe(0)
    expect(emptyCounts.aerobicCount).toBe(0)
    expect(emptyCounts.totalCount).toBe(0)
    expect(emptyCounts.hasData).toBe(false)

    const plannedOnly = [
      makeSession({ date: '2026-11-15', status: 'planned', actualMinutes: 0 }),
    ]
    const plannedCounts = getWeeklyCounts(plannedOnly, '2026-11-09', '2026-11-15')
    expect(plannedCounts.hasData).toBe(false)
  })
})

describe('Streak calculation', () => {
  it('returns 0 when there are no sessions', () => {
    expect(getStreak([], '2026-11-15')).toBe(0)
  })

  it('returns 1 when only today has an exercise session done', () => {
    const sessions = [makeSession({ date: '2026-11-15', status: 'done', actualMinutes: 60 })]
    expect(getStreak(sessions, '2026-11-15')).toBe(1)
  })

  it('preserves yesterday’s streak when today is not completed yet', () => {
    const sessions = [
      makeSession({ date: '2026-11-13', status: 'done', actualMinutes: 60 }),
      makeSession({ date: '2026-11-14', status: 'done', actualMinutes: 60 }),
      // Today is planned only
      makeSession({ date: '2026-11-15', status: 'planned', actualMinutes: 0 }),
    ]
    expect(getStreak(sessions, '2026-11-15')).toBe(2)
  })

  it('increments streak when today is completed', () => {
    const sessions = [
      makeSession({ date: '2026-11-13', status: 'done', actualMinutes: 60 }),
      makeSession({ date: '2026-11-14', status: 'done', actualMinutes: 60 }),
      makeSession({ date: '2026-11-15', status: 'done', actualMinutes: 60 }),
    ]
    expect(getStreak(sessions, '2026-11-15')).toBe(3)
  })

  it('stops streak when there is a gap day with no completed exercise', () => {
    const sessions = [
      makeSession({ date: '2026-11-11', status: 'done', actualMinutes: 60 }),
      // Gap on 2026-11-12 (skipped or missing)
      makeSession({ date: '2026-11-12', status: 'skipped', actualMinutes: 0 }),
      makeSession({ date: '2026-11-13', status: 'done', actualMinutes: 60 }),
      makeSession({ date: '2026-11-14', status: 'done', actualMinutes: 60 }),
      makeSession({ date: '2026-11-15', status: 'done', actualMinutes: 60 }),
    ]
    expect(getStreak(sessions, '2026-11-15')).toBe(3)
  })
})

describe('Today status', () => {
  it('returns Done when all sessions today are finished', () => {
    const sessions = [
      makeSession({ id: '1', status: 'done' }),
      makeSession({ id: '2', status: 'changed' }),
    ]
    expect(getTodayStatus(sessions)).toEqual({ status: 'Done', tone: 'ok' })
  })

  it('returns Partly done when some sessions are done and some planned', () => {
    const sessions = [
      makeSession({ id: '1', status: 'done' }),
      makeSession({ id: '2', status: 'planned' }),
    ]
    expect(getTodayStatus(sessions)).toEqual({ status: 'Partly done', tone: 'warn' })
  })

  it('returns Not started when no sessions are completed', () => {
    const sessions = [
      makeSession({ id: '1', status: 'planned' }),
      makeSession({ id: '2', status: 'skipped' }),
    ]
    expect(getTodayStatus(sessions)).toEqual({ status: 'Not started', tone: 'neutral' })
  })

  it('returns Not started when sessions array is empty', () => {
    expect(getTodayStatus([])).toEqual({ status: 'Not started', tone: 'neutral' })
  })
})

describe('Week view data', () => {
  it('generates labels and separates planned and completed minutes', () => {
    const sessions: ExerciseSession[] = [
      makeSession({ date: '2026-11-09', plannedMinutes: 60, actualMinutes: 60, status: 'done' }),
      makeSession({ date: '2026-11-10', plannedMinutes: 60, actualMinutes: 45, status: 'changed' }),
      makeSession({ date: '2026-11-11', plannedMinutes: 60, actualMinutes: 0, status: 'skipped' }),
      makeSession({ date: '2026-11-15', plannedMinutes: 60, actualMinutes: 60, status: 'done' }),
    ]

    const data = getWeekViewData(sessions, '2026-11-09', '2026-11-15')
    expect(data.labels).toHaveLength(7)
    expect(data.plannedValues[0]).toBe(60)
    expect(data.completedValues[0]).toBe(60)
    expect(data.completedValues[1]).toBe(45)
    expect(data.completedValues[2]).toBe(0) // Skipped session day
    expect(data.plannedValues[3]).toBeNull() // Missing day has null (gap)
    expect(data.completedValues[3]).toBeNull()
    expect(data.summary).toContain('1 session was skipped')
  })

  it('handles empty week data without zero placeholders', () => {
    const data = getWeekViewData([], '2026-11-09', '2026-11-15')
    expect(data.labels).toHaveLength(7)
    expect(data.plannedValues.every((v) => v === null)).toBe(true)
    expect(data.completedValues.every((v) => v === null)).toBe(true)
    expect(data.summary).toBe('No exercise sessions recorded for the last 7 days.')
  })
})
