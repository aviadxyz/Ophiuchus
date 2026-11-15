import type { DaySummary, TargetMap } from '@/data'
import type { Level, Source } from '@/design'

export type ContextBuilderData = {
  screenLabel: string
  mission: {
    name: string
    day: number
    lengthDays: number
    location: string
    commDelaySeconds: number
  }
  profile: {
    kind: 'demo' | 'member'
    consent: { assistant: boolean }
  }
  today: DaySummary
  targets: TargetMap
  sleepRecords?: readonly { hours: number }[]
  moodCheckins?: readonly { score: number }[]
  exerciseSessions?: readonly { status: string }[]
  latestVitals?: { heartRate?: number; source?: Source | null } | null
  alerts?: readonly { status: string; message: string; kind?: string; at?: string }[]
  replyMode?: 'standard' | 'watch'
  /** What this profile entered about itself. Missing fields are simply left out. */
  basics?: { role?: string; sex?: string; birthYear?: number; heightCm?: number; massKg?: number }
  /** One entry per day, oldest first, for each metric. A missing day is null. */
  history?: Partial<Record<string, readonly { date: string; value: number | null }[]>>
  /** This profile's sessions of the last seven days. */
  weekSessions?: readonly { date: string; kind: string; status: string; skipReason?: string }[]
  /** This profile's medical record in plain words, or none. */
  medicalRecord?: string | null
}

/** "7.2, 6.9, -, 7.4" from a daily series, oldest first. A missing day shows as a dash. */
function seriesLine(points: readonly { date: string; value: number | null }[] | undefined): string {
  if (!points || points.length === 0 || points.every((p) => p.value === null)) return 'no data'
  return points.map((p) => (p.value === null ? '-' : String(round1(p.value)))).join(', ')
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function formatDelay(seconds: number): string {
  if (seconds <= 0) return '0 s'
  if (seconds < 60) return `${seconds} s`
  if (seconds % 60 === 0) {
    const mins = seconds / 60
    return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`
  }
  return `${Math.round(seconds / 60)} minutes`
}

function statusLabel(level: Level): string {
  switch (level) {
    case 'ok':
      return 'on target'
    case 'watch':
      return 'watch'
    case 'act':
      return 'act'
    case 'none':
    default:
      return 'no data'
  }
}

/**
 * Builds the context block sent to the chat endpoint according to Section 2 of
 * prompts/companion/medbot-system-prompt.md.
 */
export function buildChatContext(data: ContextBuilderData): string {
  const mode = data.replyMode ?? 'standard'
  const delayStr = formatDelay(data.mission.commDelaySeconds)
  const screenLine = `screen: ${data.screenLabel}`
  const missionLine = `mission: ${data.mission.name}, day ${data.mission.day} of ${data.mission.lengthDays}, ${data.mission.location}, one-way delay to Earth ${delayStr}`
  const replyModeLine = `reply mode: ${mode}`

  // If consent for assistant is turned off, emit only screen, mission and reply mode.
  if (!data.profile.consent.assistant) {
    return `[context]\n${screenLine}\n${missionLine}\n${replyModeLine}\n[end context]`
  }

  const profileDesc =
    data.profile.kind === 'demo'
      ? 'demo crew member, all values simulated'
      : 'team member, real readings and entries'

  // Sleep
  const sleepToday = data.today.sleepHours
  const sleepTodayStr =
    sleepToday.value !== null ? `${round1(sleepToday.value)} h` : 'no data'
  let sleepAvgStr = sleepTodayStr
  if (data.sleepRecords && data.sleepRecords.length > 0) {
    const sum = data.sleepRecords.reduce((acc, r) => acc + r.hours, 0)
    sleepAvgStr = `${round1(sum / data.sleepRecords.length)} h`
  }
  const sleepStatus = statusLabel(sleepToday.level)
  const sleepSource = sleepToday.source ?? 'no data'
  const sleepLine = `sleep: last night ${sleepTodayStr}, 7-day average ${sleepAvgStr}, status ${sleepStatus}, source ${sleepSource}`

  // Food
  const foodToday = data.today.energyKcal
  const foodKcal = foodToday.value !== null ? Math.round(foodToday.value) : 'no data'
  const foodTarget = Math.round(data.targets.energyKcal.value)
  const foodStatus = statusLabel(foodToday.level)
  const foodSource = foodToday.source ?? 'no data'
  const foodLine = `food: today ${foodKcal} of ${foodTarget} kcal, status ${foodStatus}, source ${foodSource}`

  // Water
  const waterToday = data.today.waterMl
  const waterLitres = waterToday.value !== null ? round1(waterToday.value / 1000) : 'no data'
  const waterTarget = round1(data.targets.waterMl.value / 1000)
  const waterStatus = statusLabel(waterToday.level)
  const waterSource = waterToday.source ?? 'no data'
  const waterLine = `water: today ${waterLitres} of ${waterTarget} L, status ${waterStatus}, source ${waterSource}`

  // Exercise
  const exToday = data.today.exerciseMinutes
  const exMinutes = exToday.value !== null ? Math.round(exToday.value) : 'no data'
  const exTarget = Math.round(data.targets.exerciseMinutes.value)
  let doneSessions = 0
  let plannedSessions = 0
  if (data.exerciseSessions && data.exerciseSessions.length > 0) {
    plannedSessions = data.exerciseSessions.length
    doneSessions = data.exerciseSessions.filter(
      (s) => s.status === 'done' || s.status === 'changed',
    ).length
  }
  const exSessionsStr = plannedSessions > 0 ? `${doneSessions} of ${plannedSessions}` : 'no data'
  const exStatus = statusLabel(exToday.level)
  const exSource = exToday.source ?? 'no data'
  const exerciseLine = `exercise: today ${exMinutes} of ${exTarget} min, today ${exSessionsStr} sessions, status ${exStatus}, source ${exSource}`

  // Mood (score only, notes and tags are NEVER included)
  const moodToday = data.today.moodScore
  const moodScore = moodToday.value !== null ? round1(moodToday.value) : 'no data'
  let moodAvg: string | number = moodScore
  if (data.moodCheckins && data.moodCheckins.length > 0) {
    const sum = data.moodCheckins.reduce((acc, m) => acc + m.score, 0)
    moodAvg = round1(sum / data.moodCheckins.length)
  }
  const moodStatus = statusLabel(moodToday.level)
  const moodSource = moodToday.source ?? 'no data'
  const moodLine = `mood: latest ${moodScore} of 5, 7-day average ${moodAvg}, status ${moodStatus}, source ${moodSource}`

  // Heart rate
  const hr = data.latestVitals?.heartRate
  const hrStr = hr !== undefined ? `${hr} bpm` : 'no sensor'
  const hrSource = hr !== undefined ? (data.latestVitals?.source ?? 'live') : 'no data'
  const hrLine = `heart rate: ${hrStr}, source ${hrSource}`

  // Alerts
  const openAlerts = (data.alerts ?? []).filter((a) => a.status === 'open')
  const alertsStr = openAlerts.length > 0 ? openAlerts.map((a) => a.message).join('; ') : 'none'
  const alertsLine = `open alerts: ${alertsStr}`

  // Who this is, from what the profile entered about itself. Never a name.
  const b = data.basics
  const year = new Date().getFullYear()
  const basicsParts = [
    b?.role ? `role ${b.role}` : null,
    b?.sex ? `sex ${b.sex}` : null,
    b?.birthYear ? `age about ${year - b.birthYear}` : null,
    b?.heightCm ? `height ${Math.round(b.heightCm)} cm` : null,
    b?.massKg ? `body mass at start ${round1(b.massKg)} kg` : null,
  ].filter((part): part is string => part !== null)

  // This profile's own history. Mood is scores only: notes and tags are never included.
  const h = data.history ?? {}
  const days = Object.values(h).find((points) => points && points.length > 0)?.length ?? 0
  const historyLines =
    days > 0
      ? [
          `history, last ${days} days, oldest first, a dash is a day with no data:`,
          `  sleep hours: ${seriesLine(h.sleepHours)}`,
          `  energy kcal: ${seriesLine(h.energyKcal)}`,
          `  water ml: ${seriesLine(h.waterMl)}`,
          `  protein g: ${seriesLine(h.proteinG)}`,
          `  exercise minutes: ${seriesLine(h.exerciseMinutes)}`,
          `  mood score of 5: ${seriesLine(h.moodScore)}`,
          `  body mass kg: ${seriesLine(h.bodyMassKg)}`,
        ]
      : []

  const week = data.weekSessions ?? []
  const skipped = week.filter((sess) => sess.status === 'skipped')
  const weekLine =
    week.length > 0
      ? `exercise sessions, last 7 days: ${week.filter((sess) => sess.status === 'done' || sess.status === 'changed').length} done, ${skipped.length} skipped${
          skipped.length > 0
            ? ` (${skipped.map((sess) => `${sess.date} ${sess.kind}${sess.skipReason ? `: ${sess.skipReason}` : ''}`).join('; ')})`
            : ''
        }`
      : null

  const pastAlerts = (data.alerts ?? []).filter((a) => a.status !== 'open').slice(0, 5)
  const pastAlertsLine =
    pastAlerts.length > 0
      ? `earlier alerts: ${pastAlerts.map((a) => `${a.message} (${a.status})`).join('; ')}`
      : null

  const recordLine = `medical record on file: ${data.medicalRecord?.trim() || 'none entered for this profile'}`

  return [
    '[context]',
    screenLine,
    missionLine,
    `profile: ${profileDesc}${basicsParts.length > 0 ? `; ${basicsParts.join(', ')}` : ''}`,
    'everything below belongs to this one profile only',
    sleepLine,
    foodLine,
    waterLine,
    exerciseLine,
    moodLine,
    hrLine,
    alertsLine,
    ...(pastAlertsLine ? [pastAlertsLine] : []),
    ...(weekLine ? [weekLine] : []),
    ...historyLines,
    recordLine,
    replyModeLine,
    '[end context]',
  ].join('\n')
}
