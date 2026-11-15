// Checks a report received from the server before the screen shows it. A malformed report is
// dropped, never patched with made-up values.

import type { Source } from '@/design'
import { metricIds } from '../types'
import type { AreaSummary, DaySummary, HealthSummary, MetricValue, SeriesPoint } from '../types'
import { GROUND_WEEK_METRICS, type GroundAlert, type GroundReport } from './types'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isTime = (v: unknown): v is string => isStr(v) && !Number.isNaN(Date.parse(v))
const isNumOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v))
const isLevel = (v: unknown) => v === 'ok' || v === 'watch' || v === 'act' || v === 'none'
const isSource = (v: unknown) =>
  v === 'live' || v === 'entered' || v === 'imported' || v === 'simulated'
const isSourceOrNull = (v: unknown) => v === null || isSource(v)

function day(v: unknown): DaySummary | null {
  if (!isObj(v) || !isStr(v.date)) return null
  const result: Obj = { date: v.date }
  for (const id of metricIds) {
    const m = v[id]
    if (!isObj(m) || !isNumOrNull(m.value) || !isLevel(m.level) || !isSourceOrNull(m.source)) {
      return null
    }
    result[id] = { value: m.value, targetId: id, level: m.level, source: m.source } as MetricValue
  }
  return result as DaySummary
}

function area(v: unknown): AreaSummary | null {
  if (!isObj(v) || !isLevel(v.level) || !isStr(v.text) || !isSourceOrNull(v.source)) return null
  return { level: v.level, text: v.text, source: v.source } as AreaSummary
}

function summary(v: unknown): HealthSummary | null {
  if (!isObj(v)) return null
  const areas = {
    sleep: area(v.sleep),
    food: area(v.food),
    water: area(v.water),
    exercise: area(v.exercise),
    mood: area(v.mood),
  }
  if (Object.values(areas).some((a) => a === null)) return null
  if (typeof v.openAlerts !== 'number' || !isStr(v.ophiLine) || !isStr(v.updatedAt)) return null
  return {
    ...(areas as Record<keyof typeof areas, AreaSummary>),
    openAlerts: v.openAlerts,
    ophiLine: v.ophiLine,
    updatedAt: v.updatedAt,
  }
}

function series(v: unknown): SeriesPoint[] | null {
  if (!Array.isArray(v) || v.length !== 7) return null
  const points: SeriesPoint[] = []
  for (const p of v) {
    if (!isObj(p) || !isStr(p.date) || !isNumOrNull(p.value) || !isSourceOrNull(p.source)) {
      return null
    }
    points.push({
      date: p.date,
      value: p.value as number | null,
      source: p.source as SeriesPoint['source'],
    })
  }
  return points
}

function vitals(v: unknown): GroundReport['vitals'] | undefined {
  if (v === null || v === undefined) return null
  if (!isObj(v) || !isTime(v.at) || !isSource(v.source)) return undefined
  const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : undefined)
  const heartRate = num(v.heartRate)
  const spo2 = num(v.spo2)
  const skinTempC = num(v.skinTempC)
  return {
    at: v.at,
    source: v.source as Source,
    ...(heartRate !== undefined ? { heartRate } : {}),
    ...(spo2 !== undefined ? { spo2 } : {}),
    ...(skinTempC !== undefined ? { skinTempC } : {}),
  }
}

function alerts(v: unknown): GroundAlert[] | null {
  if (!Array.isArray(v)) return null
  const result: GroundAlert[] = []
  for (const a of v) {
    if (!isObj(a) || !isTime(a.at) || !isStr(a.message)) return null
    if (a.kind !== 'emergency' && a.kind !== 'health') return null
    if (a.status !== 'open' && a.status !== 'cancelled' && a.status !== 'acknowledged') return null
    result.push({ at: a.at, kind: a.kind, message: a.message, status: a.status })
  }
  return result
}

export function sanitizeReport(v: unknown): GroundReport | null {
  if (!isObj(v)) return null
  if (!isStr(v.reportId) || !isStr(v.displayName) || !isStr(v.role)) return null
  if (v.kind !== 'member' && v.kind !== 'demo') return null
  if (typeof v.missionDay !== 'number' || !isTime(v.sentAt) || !isTime(v.receivedAt)) return null
  const today = day(v.today)
  const health = summary(v.summary)
  const list = alerts(v.alerts)
  const latest = vitals(v.vitals)
  if (!today || !health || !list || latest === undefined || !isObj(v.week)) return null
  const week: Partial<GroundReport['week']> = {}
  for (const id of GROUND_WEEK_METRICS) {
    const points = series(v.week[id])
    if (!points) return null
    week[id] = points
  }
  return {
    reportId: v.reportId,
    displayName: v.displayName,
    role: v.role,
    kind: v.kind,
    missionDay: v.missionDay,
    sentAt: v.sentAt,
    receivedAt: v.receivedAt,
    today,
    summary: health,
    week: week as GroundReport['week'],
    vitals: latest,
    alerts: list,
  }
}
