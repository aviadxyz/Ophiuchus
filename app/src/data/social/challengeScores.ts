// The two crew challenge scores (CONTRACTS section 8, "Challenge ids"), worked out on the device
// from the store. Pure functions: no React, no network. A week runs Monday to Sunday.
//
//   exercise:  the share of this week's planned exercise minutes that are done, 0 to 100.
//              Planned minutes are the sessions on the plan (a game round is extra, not a plan);
//              done minutes are every session marked done or changed, game rounds included.
//              No plan this week gives no score.
//   nutrition: the days this week, 0 to 7, on which energy, water and protein were all at level
//              `ok`, by the shared level function. Nothing eaten or drunk this week gives no score.

import { indexByDate, summarizeDay } from '../compute'
import { addDays, dateOfTimestamp, parseDateString, toDateString } from '../dates'
import { targetsFor } from '../targets'
import type { CrewProfile, DateString, ExerciseSession, ProfileData, TargetMap } from '../types'

export type ChallengeId = 'exercise' | 'nutrition'
export const CHALLENGE_IDS: readonly ChallengeId[] = ['exercise', 'nutrition']

/** This week's dates from Monday up to and including `today`. */
export function weekSoFar(today: DateString): DateString[] {
  const daysSinceMonday = (parseDateString(today).getDay() + 6) % 7
  return Array.from({ length: daysSinceMonday + 1 }, (_, i) => addDays(today, i - daysSinceMonday))
}

/** The Monday and Sunday of the week `today` falls in. */
function weekBounds(today: DateString): { monday: DateString; sunday: DateString } {
  const monday = weekSoFar(today)[0] ?? today
  return { monday, sunday: addDays(monday, 6) }
}

export function exerciseScore(
  sessions: readonly ExerciseSession[],
  today: DateString,
): number | null {
  const { monday, sunday } = weekBounds(today)
  const week = sessions.filter((s) => s.date >= monday && s.date <= sunday)
  const planned = week
    .filter((s) => s.device !== 'game')
    .reduce((sum, s) => sum + Math.max(0, s.plannedMinutes), 0)
  if (planned <= 0) return null
  const done = week
    .filter((s) => s.status === 'done' || s.status === 'changed')
    .reduce((sum, s) => sum + Math.max(0, s.actualMinutes), 0)
  return Math.min(100, Math.max(0, Math.round((100 * done) / planned)))
}

export function nutritionScore(data: ProfileData, targets: TargetMap, now: Date): number | null {
  const days = weekSoFar(toDateString(now))
  const inWeek = new Set(days)
  const logged =
    data.meals.some((m) => inWeek.has(dateOfTimestamp(m.at) ?? '')) ||
    data.water.some((w) => inWeek.has(dateOfTimestamp(w.at) ?? ''))
  if (!logged) return null
  const index = indexByDate(data)
  let onTarget = 0
  for (const date of days) {
    const day = summarizeDay(index, date, targets, now)
    if (
      day.energyKcal.level === 'ok' &&
      day.waterMl.level === 'ok' &&
      day.proteinG.level === 'ok'
    ) {
      onTarget += 1
    }
  }
  return onTarget
}

/** Both scores for one profile, with the same targets the screens use. */
export function scoresFor(
  profile: CrewProfile,
  data: ProfileData,
  now: Date,
): Record<ChallengeId, number | null> {
  const targets = targetsFor(profile, new Date(now.getFullYear(), 6, 1))
  return {
    exercise: exerciseScore(data.sessions, toDateString(now)),
    nutrition: nutritionScore(data, targets, now),
  }
}
