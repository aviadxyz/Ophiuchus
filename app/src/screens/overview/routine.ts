import type {
  DaySummary,
  ExerciseSession,
  MoodCheckin,
  SeriesPoint,
} from '@/data'
import type { LatestVitals } from '@/data'
import type { Source } from '@/design'

export type RoutineItemId =
  | 'sleep'
  | 'heart-rate'
  | 'mood'
  | 'exercise'
  | 'water'
  | 'vitamin-d'
  | 'weigh-in'

export type RoutineState = 'done' | 'due' | 'not-planned'

export type RoutineItem = {
  id: RoutineItemId
  label: string
  state: RoutineState
  detail?: string
  source?: Source
  actionLabel?: string
  actionRoute?: string
}

export type RoutineInput = {
  today: DaySummary
  latestVitals?: LatestVitals | null
  moodCheckins?: MoodCheckin[]
  exerciseSessions?: ExerciseSession[]
  bodyMassSeries?: SeriesPoint[]
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function dateOfAt(at: string): string {
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? '' : localDateString(d)
}

export function timeOfAt(at: string): string {
  const d = new Date(at)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Calculates the seven daily routine items in fixed order.
 * Pure function: takes plain data and the current time, no hooks inside.
 */
export function routine(data: RoutineInput, now: Date = new Date()): RoutineItem[] {
  const todayDate = data.today.date || localDateString(now)

  // 1. Sleep
  const sleepVal = data.today.sleepHours?.value
  const sleepDone = sleepVal !== null && sleepVal !== undefined
  const sleepItem: RoutineItem = {
    id: 'sleep',
    label: "Log last night's sleep",
    state: sleepDone ? 'done' : 'due',
    detail: sleepDone ? `${Number(sleepVal.toFixed(1))} h` : undefined,
    actionLabel: sleepDone ? undefined : 'Open Sleep',
    actionRoute: sleepDone ? undefined : '/sleep',
  }

  // 2. Heart rate
  const latestVital = data.latestVitals?.latest
  const hrVal = latestVital?.heartRate
  const hrDone =
    latestVital != null &&
    hrVal !== undefined &&
    hrVal !== null &&
    dateOfAt(latestVital.at) === todayDate

  const heartRateItem: RoutineItem = {
    id: 'heart-rate',
    label: 'Heart-rate reading',
    state: hrDone ? 'done' : 'due',
    detail: hrDone ? `${hrVal} bpm at ${timeOfAt(latestVital.at)}` : undefined,
    source: hrDone ? latestVital.source : undefined,
    actionLabel: hrDone ? undefined : 'Take a reading',
    actionRoute: hrDone ? undefined : '/physical-activity',
  }

  // 3. Mood check-in
  const checkins = data.moodCheckins ?? []
  const todayCheckin = checkins.find((c) => dateOfAt(c.at) === todayDate)
  const moodDone = Boolean(todayCheckin)

  const moodItem: RoutineItem = {
    id: 'mood',
    label: 'Mood check-in',
    state: moodDone ? 'done' : 'due',
    detail: moodDone && todayCheckin ? timeOfAt(todayCheckin.at) : undefined,
    actionLabel: moodDone ? undefined : 'Check in',
    actionRoute: moodDone ? undefined : '/mood',
  }

  // 4. Exercise
  const sessions = data.exerciseSessions ?? []
  let exerciseState: RoutineState
  let exerciseDetail: string | undefined

  if (sessions.length === 0) {
    exerciseState = 'not-planned'
  } else {
    const skipped = sessions.filter((s) => s.status === 'skipped')
    const doneOrChanged = sessions.filter((s) => s.status === 'done' || s.status === 'changed')

    if (skipped.length > 0) {
      exerciseState = 'due'
      exerciseDetail = `${skipped.length} skipped`
    } else if (doneOrChanged.length === sessions.length) {
      exerciseState = 'done'
      exerciseDetail = `${doneOrChanged.length} of ${sessions.length} sessions`
    } else {
      exerciseState = 'due'
      exerciseDetail = `${doneOrChanged.length} of ${sessions.length} sessions`
    }
  }

  const exerciseItem: RoutineItem = {
    id: 'exercise',
    label: 'Exercise',
    state: exerciseState,
    detail: exerciseDetail,
    actionLabel: exerciseState === 'due' ? 'Open Physical activity' : undefined,
    actionRoute: exerciseState === 'due' ? '/physical-activity' : undefined,
  }

  // 5. Water
  const waterDone = data.today.waterMl?.level === 'ok'
  const waterMlVal = data.today.waterMl?.value ?? 0
  const waterLitres = (waterMlVal / 1000).toFixed(1)

  const waterItem: RoutineItem = {
    id: 'water',
    label: 'Water',
    state: waterDone ? 'done' : 'due',
    detail: `${waterLitres} L`,
    actionLabel: waterDone ? undefined : 'Add 250 ml',
  }

  // 6. Vitamin D
  const vitDVal = data.today.vitaminDIu?.value
  const vitDDone = vitDVal !== null && vitDVal !== undefined && vitDVal > 0

  const vitaminDItem: RoutineItem = {
    id: 'vitamin-d',
    label: 'Vitamin D',
    state: vitDDone ? 'done' : 'due',
    actionLabel: vitDDone ? undefined : 'Open Nutrition',
    actionRoute: vitDDone ? undefined : '/nutrition',
  }

  // 7. Weigh-in
  const series = data.bodyMassSeries ?? []
  const validPoints = series.filter((p) => p.value !== null && p.value !== undefined)
  const weighInDone = validPoints.length > 0
  const latestMassPoint = validPoints.at(-1)

  const weighInItem: RoutineItem = {
    id: 'weigh-in',
    label: 'Weekly weigh-in',
    state: weighInDone ? 'done' : 'due',
    detail: weighInDone && latestMassPoint ? `${latestMassPoint.value} kg` : undefined,
    actionLabel: weighInDone ? undefined : 'Open Nutrition',
    actionRoute: weighInDone ? undefined : '/nutrition',
  }

  return [
    sleepItem,
    heartRateItem,
    moodItem,
    exerciseItem,
    waterItem,
    vitaminDItem,
    weighInItem,
  ]
}
