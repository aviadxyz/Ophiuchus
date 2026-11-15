// Pure maths over a profile's records: day totals, series and the health summary.
// No React, no store. Hooks in selectors.ts and the relay both call these.

import type { Level, Source } from '@/design'
import { dateOfTimestamp, lastDates, minutesOfDay, toDateString } from './dates'
import { getFood } from './foods'
import { buildsUpDuringDay, expectedShare, levelFor } from './levels'
import type {
  AreaSummary,
  Alert,
  DateString,
  DaySummary,
  HealthSummary,
  MealWithFood,
  MetricId,
  MetricValue,
  ProfileData,
  SeriesPoint,
  TargetMap,
  VitalSample,
} from './types'
import { metricIds } from './types'
import type {
  ExerciseSession,
  MealEntry,
  MoodCheckin,
  SleepRecord,
  BodyMass,
  WaterEntry,
} from './types'

export const emptyProfileData = (): ProfileData => ({
  sleep: [],
  meals: [],
  water: [],
  sessions: [],
  moods: [],
  bodyMass: [],
  vitals: [],
})

/**
 * One source for a total made of several records. If any record is simulated the total is
 * simulated, so a demo value is never shown as entered. Otherwise imported, then entered, then live.
 */
export function combineSources(sources: readonly Source[]): Source | null {
  if (sources.length === 0) return null
  for (const source of ['simulated', 'imported', 'entered'] as const) {
    if (sources.includes(source)) return source
  }
  return 'live'
}

type DayBucket = {
  sleep: SleepRecord[]
  meals: MealEntry[]
  water: WaterEntry[]
  sessions: ExerciseSession[]
  moods: MoodCheckin[]
  bodyMass: BodyMass[]
  vitals: VitalSample[]
}

export type DayIndex = Map<DateString, DayBucket>

/** Groups every record by the local day it belongs to. */
export function indexByDate(data: ProfileData): DayIndex {
  const index: DayIndex = new Map()
  const bucket = (date: DateString): DayBucket => {
    let found = index.get(date)
    if (!found) {
      found = { sleep: [], meals: [], water: [], sessions: [], moods: [], bodyMass: [], vitals: [] }
      index.set(date, found)
    }
    return found
  }
  for (const r of data.sleep) bucket(r.date).sleep.push(r)
  for (const r of data.sessions) bucket(r.date).sessions.push(r)
  for (const r of data.bodyMass) bucket(r.date).bodyMass.push(r)
  for (const r of data.meals) {
    const date = dateOfTimestamp(r.at)
    if (date) bucket(date).meals.push(r)
  }
  for (const r of data.water) {
    const date = dateOfTimestamp(r.at)
    if (date) bucket(date).water.push(r)
  }
  for (const r of data.moods) {
    const date = dateOfTimestamp(r.at)
    if (date) bucket(date).moods.push(r)
  }
  for (const r of data.vitals) {
    const date = dateOfTimestamp(r.at)
    if (date) bucket(date).vitals.push(r)
  }
  return index
}

const empty: DayBucket = {
  sleep: [],
  meals: [],
  water: [],
  sessions: [],
  moods: [],
  bodyMass: [],
  vitals: [],
}

type Raw = { value: number | null; source: Source | null }
const none: Raw = { value: null, source: null }

const nutrientKey = {
  energyKcal: 'kcal',
  proteinG: 'proteinG',
  sodiumMg: 'sodiumMg',
  calciumMg: 'calciumMg',
  ironMg: 'ironMg',
  vitaminDIu: 'vitaminDIu',
  omega3G: 'omega3G',
  potassiumMg: 'potassiumMg',
} as const

const round1 = (n: number) => Math.round(n * 10) / 10

function rawValue(metric: MetricId, bucket: DayBucket): Raw {
  switch (metric) {
    case 'sleepHours': {
      const record = bucket.sleep.at(-1)
      return record ? { value: record.hours, source: record.source } : none
    }
    case 'waterMl': {
      // Drinks only. Water in food (FoodItem.waterMl) is not counted.
      if (bucket.water.length === 0) return none
      const value = bucket.water.reduce((sum, w) => sum + w.ml, 0)
      return { value, source: combineSources(bucket.water.map((w) => w.source)) }
    }
    case 'exerciseMinutes': {
      // Sessions that are only planned are a plan, not data: until one is done, changed or
      // skipped, there is nothing to report.
      if (bucket.sessions.every((s) => s.status === 'planned')) return none
      const done = bucket.sessions.filter((s) => s.status === 'done' || s.status === 'changed')
      return {
        value: done.reduce((sum, s) => sum + s.actualMinutes, 0),
        source: combineSources(bucket.sessions.map((s) => s.source)),
      }
    }
    case 'moodScore': {
      if (bucket.moods.length === 0) return none
      const value = bucket.moods.reduce((sum, m) => sum + m.score, 0) / bucket.moods.length
      return { value: round1(value), source: combineSources(bucket.moods.map((m) => m.source)) }
    }
    case 'bodyMassKg': {
      const record = bucket.bodyMass.at(-1)
      return record ? { value: record.kg, source: record.source } : none
    }
    case 'heartRate': {
      const samples = bucket.vitals.filter((v) => v.heartRate !== undefined)
      if (samples.length === 0) return none
      const sum = samples.reduce((total, v) => total + (v.heartRate ?? 0), 0)
      return {
        value: Math.round(sum / samples.length),
        source: combineSources(samples.map((v) => v.source)),
      }
    }
    default: {
      const key = nutrientKey[metric]
      const rows = bucket.meals.flatMap((meal) => {
        const food = getFood(meal.foodId)
        return food ? [{ meal, food }] : []
      })
      if (rows.length === 0) return none
      const total = rows.reduce((sum, { meal, food }) => sum + food[key] * meal.portions, 0)
      return {
        value: key === 'omega3G' ? round1(total) : Math.round(total),
        source: combineSources(rows.map(({ meal }) => meal.source)),
      }
    }
  }
}

function metricValue(
  metric: MetricId,
  bucket: DayBucket,
  targets: TargetMap,
  share: number,
): MetricValue {
  const raw = rawValue(metric, bucket)
  // A consumer-watch reading is never turned into a status.
  const level: Level =
    metric === 'heartRate'
      ? 'none'
      : levelFor(raw.value, targets[metric], buildsUpDuringDay.has(metric) ? share : 1)
  return { value: raw.value, targetId: metric, level, source: raw.source }
}

/** One day's summary. For today, totals that build up are compared with the share expected by `now`. */
export function summarizeDay(
  index: DayIndex,
  date: DateString,
  targets: TargetMap,
  now: Date,
): DaySummary {
  const bucket = index.get(date) ?? empty
  const share = date === toDateString(now) ? expectedShare(minutesOfDay(now)) : 1
  const entries = metricIds.map((id) => [id, metricValue(id, bucket, targets, share)] as const)
  return { date, ...(Object.fromEntries(entries) as Record<MetricId, MetricValue>) }
}

/** One entry per day, oldest first. A day without data has a value of null: a gap, not a zero. */
export function seriesFor(
  index: DayIndex,
  metric: MetricId,
  days: number,
  today: DateString,
): SeriesPoint[] {
  return lastDates(today, Math.max(1, Math.floor(days))).map((date) => {
    const raw = rawValue(metric, index.get(date) ?? empty)
    return { date, value: raw.value, source: raw.source }
  })
}

export function mealsOn(data: ProfileData, date: DateString): MealWithFood[] {
  return data.meals
    .filter((meal) => dateOfTimestamp(meal.at) === date)
    .flatMap((meal) => {
      const food = getFood(meal.foodId)
      return food ? [{ ...meal, food }] : []
    })
    .sort((a, b) => a.at.localeCompare(b.at))
}

const moodWords = ['VERY LOW', 'LOW', 'OKAY', 'GOOD', 'VERY GOOD'] as const

/** The word for a mood score from 1 to 5, the same everywhere. */
export function moodWord(score: number): string {
  return moodWords[Math.min(5, Math.max(1, Math.round(score))) - 1] ?? 'OKAY'
}

const formatNumber = (n: number) => n.toLocaleString('en-US')

function area(level: Level, text: string, source: Source | null): AreaSummary {
  return { level, text, source }
}

function ophiLineFor(
  areas: Record<'sleep' | 'food' | 'water' | 'exercise' | 'mood', AreaSummary>,
  openAlerts: number,
): string {
  if (openAlerts > 0) return 'There is an open alert. Open Emergency to see it.'
  const names = {
    sleep: 'Sleep',
    food: 'Food',
    water: 'Water',
    exercise: 'Exercise',
    mood: 'Mood',
  } as const
  const keys = Object.keys(names) as (keyof typeof names)[]
  const act = keys.filter((k) => areas[k].level === 'act')
  const watch = keys.filter((k) => areas[k].level === 'watch')
  const withData = keys.filter((k) => areas[k].level !== 'none')
  if (act.length > 0) {
    const first = act[0] as keyof typeof names
    return `${names[first]} needs your attention today. If it stays this way for several days, tell the flight surgeon.`
  }
  if (watch.length > 0) {
    const first = watch[0] as keyof typeof names
    return `Keep an eye on ${names[first].toLowerCase()} today. A small step now helps.`
  }
  if (withData.length === 0)
    return 'Nothing logged yet today. A quick check-in gets your day started.'
  if (withData.length < keys.length)
    return 'What you logged is on target. Log the rest when you can.'
  return 'Everything you logged today is on target. Nicely done.'
}

/** The short read of today used by Overview, the Med bot, the watch and Ophi. */
export function buildHealthSummary(
  today: DaySummary,
  alerts: readonly Alert[],
  targets: TargetMap,
  now: Date,
): HealthSummary {
  const sleep = today.sleepHours
  const energy = today.energyKcal
  const water = today.waterMl
  const exercise = today.exerciseMinutes
  const mood = today.moodScore

  const areas = {
    sleep: area(
      sleep.level,
      sleep.value === null ? 'Not logged yet' : `${round1(sleep.value)} h last night`,
      sleep.source,
    ),
    food: area(
      energy.level,
      energy.value === null
        ? 'Nothing logged yet'
        : `${formatNumber(energy.value)} of ${formatNumber(targets.energyKcal.value)} kcal`,
      energy.source,
    ),
    water: area(
      water.level,
      water.value === null
        ? 'Nothing logged yet'
        : `${formatNumber(water.value)} of ${formatNumber(targets.waterMl.value)} ml`,
      water.source,
    ),
    exercise: area(
      exercise.level,
      exercise.value === null ? 'No session planned' : `${Math.round(exercise.value)} min done`,
      exercise.source,
    ),
    mood: area(
      mood.level,
      mood.value === null ? 'No check-in today' : `Feeling ${moodWord(mood.value).toLowerCase()}`,
      mood.source,
    ),
  }
  const openAlerts = alerts.filter((a) => a.status === 'open').length
  return {
    ...areas,
    openAlerts,
    ophiLine: ophiLineFor(areas, openAlerts),
    updatedAt: now.toISOString(),
  }
}

/** The summary without its timestamp, for telling whether anything changed. */
export function summaryFingerprint(summary: HealthSummary): string {
  const { updatedAt, ...rest } = summary
  void updatedAt
  return JSON.stringify(rest)
}
