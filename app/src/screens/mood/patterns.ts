import type { DateString, ExerciseSession, MoodCheckin, SleepRecord } from '@/data'
import { addDays, toDateString } from '@/data'

export type MoodTrend = 'Rising' | 'Steady' | 'Falling'

export type DayMood = {
  date: DateString
  avgScore: number
  checkins: MoodCheckin[]
}

/** Returns the calendar date (YYYY-MM-DD) of a check-in timestamp. */
export function checkinDate(checkin: MoodCheckin): DateString {
  return toDateString(new Date(checkin.at))
}

/** Groups check-ins by calendar day (newest day first) and computes each day's average score. */
export function groupCheckinsByDay(checkins: readonly MoodCheckin[]): DayMood[] {
  const map = new Map<DateString, MoodCheckin[]>()
  for (const c of checkins) {
    const d = checkinDate(c)
    const list = map.get(d)
    if (list) list.push(c)
    else map.set(d, [c])
  }

  const result: DayMood[] = []
  for (const [date, list] of map.entries()) {
    // Sort checkins within the day newest first
    list.sort((a, b) => b.at.localeCompare(a.at))
    const sum = list.reduce((total, c) => total + c.score, 0)
    const avgScore = Math.round((sum / list.length) * 10) / 10
    result.push({ date, avgScore, checkins: list })
  }

  // Sort days newest first
  return result.sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * Computes the 7-day average score to one decimal place ending at today.
 * Returns null when there are no check-ins in the 7-day window.
 */
export function compute7DayAverage(
  checkins: readonly MoodCheckin[],
  today: DateString,
): number | null {
  const from = addDays(today, -6)
  const windowCheckins = checkins.filter((c) => {
    const d = checkinDate(c)
    return d >= from && d <= today
  })

  if (windowCheckins.length === 0) return null
  const sum = windowCheckins.reduce((total, c) => total + c.score, 0)
  return Math.round((sum / windowCheckins.length) * 10) / 10
}

/**
 * Computes the trend word (Rising, Steady, Falling) comparing the last 3 days
 * (today, yesterday, 2 days ago) with the 4 days before that.
 */
export function computeTrendWord(
  checkins: readonly MoodCheckin[],
  today: DateString,
): MoodTrend {
  const recentFrom = addDays(today, -2) // last 3 days: today-2 .. today
  const priorFrom = addDays(today, -6) // 4 before: today-6 .. today-3
  const priorTo = addDays(today, -3)

  const recent = checkins.filter((c) => {
    const d = checkinDate(c)
    return d >= recentFrom && d <= today
  })
  const prior = checkins.filter((c) => {
    const d = checkinDate(c)
    return d >= priorFrom && d <= priorTo
  })

  if (recent.length === 0 || prior.length === 0) return 'Steady'

  const recentAvg = recent.reduce((sum, c) => sum + c.score, 0) / recent.length
  const priorAvg = prior.reduce((sum, c) => sum + c.score, 0) / prior.length
  const diff = recentAvg - priorAvg

  if (diff >= 0.3) return 'Rising'
  if (diff <= -0.3) return 'Falling'
  return 'Steady'
}

/**
 * Safety condition 1:
 * "If the last three days with check-ins all average 2 or lower"
 */
export function isHeavyDaysConditionMet(checkins: readonly MoodCheckin[]): boolean {
  const byDay = groupCheckinsByDay(checkins)
  if (byDay.length < 3) return false
  const lastThree = byDay.slice(0, 3)
  return lastThree.every((day) => day.avgScore <= 2)
}

/**
 * Pattern rule 1: Sleep
 * "at least 2 days after a night under 6 hours and 2 days after longer nights"
 * "Your mood was lower on days after short nights." when the difference is 0.5 or more.
 */
export function computeSleepRule(
  checkins: readonly MoodCheckin[],
  sleepRecords: readonly SleepRecord[],
): string | null {
  const byDay = groupCheckinsByDay(checkins)
  const dayScores = new Map(byDay.map((d) => [d.date, d.avgScore]))

  const shortAfterDays: number[] = []
  const longAfterDays: number[] = []

  for (const s of sleepRecords) {
    const nextDay = addDays(s.date, 1)
    const score = dayScores.get(nextDay)
    if (score !== undefined) {
      if (s.hours < 6.0) {
        shortAfterDays.push(score)
      } else {
        longAfterDays.push(score)
      }
    }
  }

  if (shortAfterDays.length < 2 || longAfterDays.length < 2) return null

  const shortAvg = shortAfterDays.reduce((a, b) => a + b, 0) / shortAfterDays.length
  const longAvg = longAfterDays.reduce((a, b) => a + b, 0) / longAfterDays.length
  const diff = longAvg - shortAvg

  if (diff >= 0.5) {
    return 'Your mood was lower on days after short nights.'
  }
  return null
}

/**
 * Pattern rule 2: Exercise
 * "at least 2 days with a done session and 2 without"
 * "Your mood was a little higher on days you exercised." when the difference is 0.5 or more.
 */
export function computeExerciseRule(
  checkins: readonly MoodCheckin[],
  sessions: readonly ExerciseSession[],
): string | null {
  const byDay = groupCheckinsByDay(checkins)
  if (byDay.length === 0) return null

  const exercisedDates = new Set(
    sessions
      .filter((s) => s.status === 'done' || s.status === 'changed')
      .map((s) => s.date),
  )

  const exercisedMoods: number[] = []
  const noExerciseMoods: number[] = []

  for (const day of byDay) {
    if (exercisedDates.has(day.date)) {
      exercisedMoods.push(day.avgScore)
    } else {
      noExerciseMoods.push(day.avgScore)
    }
  }

  if (exercisedMoods.length < 2 || noExerciseMoods.length < 2) return null

  const exerciseAvg = exercisedMoods.reduce((a, b) => a + b, 0) / exercisedMoods.length
  const noExerciseAvg = noExerciseMoods.reduce((a, b) => a + b, 0) / noExerciseMoods.length
  const diff = exerciseAvg - noExerciseAvg

  if (diff >= 0.5) {
    return 'Your mood was a little higher on days you exercised.'
  }
  return null
}

/**
 * Pattern rule 3: Trend
 * "at least 6 days of check-ins"
 * "Your mood has been rising this week." or "…dipping this week." when the header trend is not Steady.
 */
export function computeTrendRule(
  checkins: readonly MoodCheckin[],
  headerTrend: MoodTrend,
): string | null {
  const byDay = groupCheckinsByDay(checkins)
  if (byDay.length < 6) return null

  if (headerTrend === 'Rising') {
    return 'Your mood has been rising this week.'
  }
  if (headerTrend === 'Falling') {
    return 'Your mood has been dipping this week.'
  }
  return null
}
