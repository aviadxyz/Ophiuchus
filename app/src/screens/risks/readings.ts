// This person's own readings that feed the Risks table, read through `@/data`.
//
// A reading with no data has level `none` and is never shown as on target. Heart rate has no
// level by rule (see data/README.md), so it is shown as a reading only and never decides a status.

import {
  addDays,
  levelFor,
  useExerciseSessions,
  useLatestVitals,
  useTargets,
  useToday,
  worstLevel,
  type DaySummary,
  type ExerciseSession,
  type MetricId,
  type Target,
  type TargetMap,
  type VitalSample,
} from '@/data'
import type { Level, Source } from '@/design'
import type { ReadingId, RiskSystem } from './systems'

export type LoggedAt = { label: string; path: string }

export type Reading = {
  id: ReadingId
  label: string
  value: number | null
  unit: string
  level: Level
  /** Null when there is no data. */
  source: Source | null
  /** False for a reading that never gets a status (heart rate). */
  hasStatus: boolean
  /** The target in words, or null when the reading has none. */
  targetText: string | null
  sourceText: string
  sourceUrl: string | undefined
  /** Where this reading is logged, or null when no ready screen takes it. */
  loggedAt: LoggedAt | null
}

const NUTRITION: LoggedAt = { label: 'Nutrition', path: '/nutrition' }
const ACTIVITY: LoggedAt = { label: 'Physical activity', path: '/physical-activity' }
const MOOD: LoggedAt = { label: 'Mood', path: '/mood' }

type Spec = {
  metric: MetricId
  loggedAt: LoggedAt | null
}

/** Readings that come straight from today's summary. */
const metricReadings: Partial<Record<ReadingId, Spec>> = {
  exerciseMinutes: { metric: 'exerciseMinutes', loggedAt: ACTIVITY },
  calciumMg: { metric: 'calciumMg', loggedAt: NUTRITION },
  vitaminDIu: { metric: 'vitaminDIu', loggedAt: NUTRITION },
  waterMl: { metric: 'waterMl', loggedAt: NUTRITION },
  sodiumMg: { metric: 'sodiumMg', loggedAt: NUTRITION },
  moodScore: { metric: 'moodScore', loggedAt: MOOD },
  energyKcal: { metric: 'energyKcal', loggedAt: NUTRITION },
  proteinG: { metric: 'proteinG', loggedAt: NUTRITION },
  bodyMassKg: { metric: 'bodyMassKg', loggedAt: NUTRITION },
  sleepHours: { metric: 'sleepHours', loggedAt: null },
}

export function targetInWords(target: Target): string {
  const unit = target.unit ? ` ${target.unit}` : ''
  if (target.kind === 'min') return `at least ${target.value}${unit}`
  if (target.kind === 'max') return `at most ${target.value}${unit}`
  return `${target.value} to ${target.upper ?? target.value}${unit}`
}

function fromMetric(id: ReadingId, spec: Spec, today: DaySummary, targets: TargetMap): Reading {
  const target = targets[spec.metric]
  const metric = today[spec.metric]
  return {
    id,
    label: target.label,
    value: metric.value,
    unit: target.unit,
    level: metric.value === null ? 'none' : metric.level,
    source: metric.value === null ? null : metric.source,
    hasStatus: true,
    targetText: targetInWords(target),
    sourceText: target.verified ? target.sourceText : '',
    sourceUrl: target.verified && target.sourceUrl ? target.sourceUrl : undefined,
    loggedAt: spec.loggedAt,
  }
}

function fromHeartRate(sample: VitalSample | null, targets: TargetMap): Reading {
  const rate = sample?.heartRate
  const target = targets.heartRate
  return {
    id: 'heartRate',
    label: target.label,
    value: rate ?? null,
    unit: target.unit,
    level: 'none',
    source: rate === undefined || !sample ? null : sample.source,
    hasStatus: false,
    targetText: null,
    sourceText: '',
    sourceUrl: undefined,
    loggedAt: ACTIVITY,
  }
}

const sourcePriority: readonly Source[] = ['simulated', 'imported', 'entered', 'live']

function combinedSource(sessions: ExerciseSession[]): Source | null {
  return sourcePriority.find((source) => sessions.some((s) => s.source === source)) ?? null
}

/** Resistive sessions done in the last seven days, against the weekly target. */
function fromResistiveSessions(sessions: ExerciseSession[], targets: TargetMap): Reading {
  const target = targets.resistiveSessionsPerWeek
  const resistive = sessions.filter((s) => s.kind === 'resistive')
  // A planned session is not data yet. Done, changed and skipped ones are.
  const recorded = resistive.filter((s) => s.status !== 'planned')
  const done = recorded.filter((s) => s.status === 'done' || s.status === 'changed')
  const hasData = recorded.length > 0
  return {
    id: 'resistiveSessions',
    label: 'Resistive sessions this week',
    value: hasData ? done.length : null,
    unit: 'sessions',
    level: hasData ? levelFor(done.length, target) : 'none',
    source: hasData ? combinedSource(recorded) : null,
    hasStatus: true,
    targetText: targetInWords(target),
    sourceText: target.verified ? target.sourceText : '',
    sourceUrl: target.verified && target.sourceUrl ? target.sourceUrl : undefined,
    loggedAt: ACTIVITY,
  }
}

const formatNumber = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

/** The value with its unit, or "No data yet". */
export function formatReading(reading: Reading): string {
  if (reading.value === null) return 'No data yet'
  return `${formatNumber(reading.value)} ${reading.unit}`.trim()
}

export type ReadingMap = Record<ReadingId, Reading>

export function buildReadings(input: {
  today: DaySummary
  targets: TargetMap
  latest: VitalSample | null
  weekSessions: ExerciseSession[]
}): ReadingMap {
  const { today, targets, latest, weekSessions } = input
  const result: Partial<ReadingMap> = {
    heartRate: fromHeartRate(latest, targets),
    resistiveSessions: fromResistiveSessions(weekSessions, targets),
  }
  for (const [id, spec] of Object.entries(metricReadings) as [ReadingId, Spec][]) {
    result[id] = fromMetric(id, spec, today, targets)
  }
  return result as ReadingMap
}

/** All readings for the active profile. */
export function useReadings(): ReadingMap {
  const today = useToday()
  const targets = useTargets()
  const { latest } = useLatestVitals()
  const weekSessions = useExerciseSessions(addDays(today.date, -6), today.date)
  return buildReadings({ today, targets, latest, weekSessions })
}

export type SystemStatus = Level | 'untracked'

export type SystemSigns = {
  status: SystemStatus
  readings: Reading[]
  /** Readings at watch or act, worst first. */
  offTarget: Reading[]
}

export const statusLabel: Record<SystemStatus, string> = {
  ok: 'ON TARGET',
  watch: 'WATCH',
  act: 'ACT',
  none: 'NO DATA',
  untracked: 'NOT TRACKED',
}

/**
 * The status of a system: the worst level among its readings. It is on target only when every
 * reading that can have a status has data and is on target, so a missing reading never passes.
 */
export function signsFor(system: RiskSystem, readings: ReadingMap): SystemSigns {
  const own = system.readings.map((id) => readings[id])
  if (own.length === 0) return { status: 'untracked', readings: own, offTarget: [] }
  const levels = own.filter((r) => r.hasStatus).map((r) => r.level)
  const worst = worstLevel(levels)
  const status: SystemStatus = worst === 'ok' && levels.includes('none') ? 'none' : worst
  const offTarget = own
    .filter((r) => r.level === 'act' || r.level === 'watch')
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'act' ? -1 : 1))
  return { status, readings: own, offTarget }
}
