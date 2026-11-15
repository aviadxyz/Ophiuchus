import type { ExerciseSession, DateString } from '@/data'
import { addDays } from '@/data'
import type { Tone } from '@/design'

export const DEVICE_LABELS: Record<ExerciseSession['device'], string> = {
  resistive: 'Resistive exercise device',
  treadmill: 'Treadmill',
  cycle: 'Cycle ergometer',
  game: 'Mini game',
  other: 'Other',
}

export type TodayStatus = 'Done' | 'Partly done' | 'Not started'

/**
 * Determines today's status from today's sessions.
 * Done: all planned sessions completed (at least 1 exists).
 * Partly done: at least 1 session completed, but not all.
 * Not started: no sessions completed.
 */
export function getTodayStatus(todaySessions: ExerciseSession[]): {
  status: TodayStatus
  tone: Tone
} {
  if (todaySessions.length === 0) {
    return { status: 'Not started', tone: 'neutral' }
  }
  const completed = todaySessions.filter(
    (s) => s.status === 'done' || s.status === 'changed',
  )
  if (completed.length === todaySessions.length) {
    return { status: 'Done', tone: 'ok' }
  }
  if (completed.length > 0) {
    return { status: 'Partly done', tone: 'warn' }
  }
  return { status: 'Not started', tone: 'neutral' }
}

/**
 * Returns Monday (YYYY-MM-DD) of the ISO week containing dateStr.
 */
export function getMondayOfWeek(dateStr: DateString): DateString {
  const [y = 1970, m = 1, d = 1] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
  const day = dt.getDay()
  const diffToMonday = (day + 6) % 7
  return addDays(dateStr, -diffToMonday)
}

export type WeeklyCounts = {
  resistiveCount: number
  aerobicCount: number
  totalCount: number
  hasData: boolean
}

/**
 * Counts done or changed sessions from Monday to today.
 * Sessions that are only planned are a plan, not data.
 */
export function getWeeklyCounts(
  sessions: ExerciseSession[],
  monday: DateString,
  today: DateString,
): WeeklyCounts {
  const weekSessions = sessions.filter((s) => s.date >= monday && s.date <= today)
  const hasData = weekSessions.some((s) => s.status !== 'planned')
  const resistive = weekSessions.filter(
    (s) =>
      (s.kind === 'resistive' || s.device === 'resistive') &&
      (s.status === 'done' || s.status === 'changed'),
  ).length
  const aerobic = weekSessions.filter(
    (s) =>
      (s.kind === 'aerobic' || s.device === 'game') &&
      (s.status === 'done' || s.status === 'changed'),
  ).length
  return {
    resistiveCount: resistive,
    aerobicCount: aerobic,
    totalCount: resistive + aerobic,
    hasData,
  }
}

/**
 * Calculates the current streak in days.
 * An active day has at least one done or changed session with actualMinutes > 0.
 * If today has completed exercise, count consecutive days ending today.
 * If today has not completed exercise yet, count consecutive days ending yesterday.
 */
export function getStreak(sessions: ExerciseSession[], today: DateString): number {
  const exercisedDates = new Set<string>()
  for (const s of sessions) {
    if ((s.status === 'done' || s.status === 'changed') && s.actualMinutes > 0) {
      exercisedDates.add(s.date)
    }
  }

  const todayExercised = exercisedDates.has(today)
  let streak = 0
  let checkDate = todayExercised ? today : addDays(today, -1)

  while (exercisedDates.has(checkDate)) {
    streak++
    checkDate = addDays(checkDate, -1)
  }

  return streak
}

export type CoverageScores = {
  boneLoading: { score: number; tone: Tone; actualMinutes: number }
  muscle: { score: number; tone: Tone; actualMinutes: number }
  cardiovascular: { score: number; tone: Tone; actualMinutes: number }
}

export function coverageTone(score: number): Tone {
  if (score >= 0.9) return 'ok'
  if (score >= 0.7) return 'warn'
  return 'danger'
}

export function coverageLabel(tone: Tone): string {
  if (tone === 'ok') return 'ON TARGET'
  if (tone === 'warn') return 'WATCH'
  return 'ACT'
}

/**
 * Scores countermeasure coverage from the last 7 days of done and changed sessions,
 * as the share of weekly goals (capped at 1).
 * Bone loading: resistive minutes + 0.5 * treadmill minutes (goal 240)
 * Muscle: resistive minutes (goal 240)
 * Cardiovascular: aerobic minutes of any device (goal 300)
 */
export function getCoverageScores(
  sessions: ExerciseSession[],
  fromDate: DateString,
  toDate: DateString,
): CoverageScores {
  const windowSessions = sessions.filter(
    (s) =>
      s.date >= fromDate &&
      s.date <= toDate &&
      (s.status === 'done' || s.status === 'changed'),
  )

  let resistiveMins = 0
  let treadmillMins = 0
  let aerobicMins = 0

  for (const s of windowSessions) {
    if (s.kind === 'resistive' || s.device === 'resistive') {
      resistiveMins += s.actualMinutes
    }
    if (s.device === 'treadmill') {
      treadmillMins += s.actualMinutes
    }
    if (s.kind === 'aerobic' || s.device === 'game') {
      aerobicMins += s.actualMinutes
    }
  }

  const boneLoadingMins = resistiveMins + 0.5 * treadmillMins
  const boneScore = Math.min(1, Math.max(0, boneLoadingMins / 240))
  const muscleScore = Math.min(1, Math.max(0, resistiveMins / 240))
  const cardioScore = Math.min(1, Math.max(0, aerobicMins / 300))

  return {
    boneLoading: {
      score: Math.round(boneScore * 100) / 100,
      tone: coverageTone(boneScore),
      actualMinutes: Math.round(boneLoadingMins),
    },
    muscle: {
      score: Math.round(muscleScore * 100) / 100,
      tone: coverageTone(muscleScore),
      actualMinutes: Math.round(resistiveMins),
    },
    cardiovascular: {
      score: Math.round(cardioScore * 100) / 100,
      tone: coverageTone(cardioScore),
      actualMinutes: Math.round(aerobicMins),
    },
  }
}

export type WeekViewDay = {
  date: DateString
  label: string
  planned: number | null
  completed: number | null
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Prepares bar chart series and summary for the last 7 days.
 */
export function getWeekViewData(
  sessions: ExerciseSession[],
  fromDate: DateString,
  toDate: DateString,
): {
  labels: string[]
  plannedValues: (number | null)[]
  completedValues: (number | null)[]
  summary: string
} {
  const days: DateString[] = []
  let curr = fromDate
  while (curr <= toDate) {
    days.push(curr)
    curr = addDays(curr, 1)
  }

  const labels: string[] = []
  const plannedValues: (number | null)[] = []
  const completedValues: (number | null)[] = []

  let totalPlanned = 0
  let totalCompleted = 0
  let hasAnySessions = false
  let skippedCount = 0

  for (const date of days) {
    const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
    const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
    const weekday = SHORT_DAYS[dt.getDay()] ?? ''
    labels.push(`${weekday} ${d}`)

    const onDay = sessions.filter((s) => s.date === date)
    if (onDay.length === 0) {
      plannedValues.push(null)
      completedValues.push(null)
      continue
    }

    hasAnySessions = true
    const planned = onDay.reduce((sum, s) => sum + s.plannedMinutes, 0)
    plannedValues.push(planned)
    totalPlanned += planned

    const doneOrChanged = onDay.filter(
      (s) => s.status === 'done' || s.status === 'changed',
    )
    const skipped = onDay.filter((s) => s.status === 'skipped')
    skippedCount += skipped.length

    if (doneOrChanged.length === 0 && onDay.every((s) => s.status === 'planned')) {
      completedValues.push(null)
    } else {
      const actual = doneOrChanged.reduce((sum, s) => sum + s.actualMinutes, 0)
      completedValues.push(actual)
      totalCompleted += actual
    }
  }

  let summary: string
  if (!hasAnySessions) {
    summary = 'No exercise sessions recorded for the last 7 days.'
  } else {
    summary = `Planned ${totalPlanned} min and completed ${totalCompleted} min over the last 7 days.`
    if (skippedCount > 0) {
      summary += ` ${skippedCount} ${skippedCount === 1 ? 'session was' : 'sessions were'} skipped.`
    }
  }

  return {
    labels,
    plannedValues,
    completedValues,
    summary,
  }
}
