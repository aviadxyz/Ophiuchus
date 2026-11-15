// Pure checks for the ground reports (CONTRACTS sections 8 and 11). No storage and no platform
// calls, so they can be tested. A report is rebuilt field by field from what is allowed: anything
// not in `GroundReport` is dropped, and anything malformed refuses the whole report.

/** 16 to 64 letters, digits and hyphens: a `crypto.randomUUID()` fits. */
export const ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/
export const MAX_BODY_BYTES = 20 * 1024
export const MAX_NAME_LENGTH = 40
export const MAX_ALERTS = 20
export const MAX_ALERT_MESSAGE = 300
const MAX_TEXT = 300

export const METRIC_IDS = [
  'sleepHours',
  'energyKcal',
  'waterMl',
  'proteinG',
  'sodiumMg',
  'calciumMg',
  'ironMg',
  'vitaminDIu',
  'omega3G',
  'potassiumMg',
  'exerciseMinutes',
  'moodScore',
  'bodyMassKg',
  'heartRate',
] as const

export const WEEK_METRIC_IDS = [
  'sleepHours',
  'energyKcal',
  'waterMl',
  'exerciseMinutes',
  'moodScore',
] as const

const AREAS = ['sleep', 'food', 'water', 'exercise', 'mood'] as const
const LEVELS = ['ok', 'watch', 'act', 'none'] as const
const SOURCES = ['live', 'entered', 'imported', 'simulated'] as const

type Level = (typeof LEVELS)[number]
type Source = (typeof SOURCES)[number]
type Obj = Record<string, unknown>

export type CleanMetricValue = {
  value: number | null
  targetId: string
  level: Level
  source: Source | null
}
export type CleanArea = { level: Level; text: string; source: Source | null }
export type CleanPoint = { date: string; value: number | null; source: Source | null }
export type CleanVitals = {
  at: string
  heartRate?: number
  spo2?: number
  skinTempC?: number
  source: Source
}
export type CleanAlert = {
  at: string
  kind: 'emergency' | 'health'
  message: string
  status: 'open' | 'cancelled' | 'acknowledged'
}

/** A `GroundReport` as stored: every field of the contract except `receivedAt`, which the server sets. */
export type CleanReport = {
  reportId: string
  displayName: string
  role: string
  kind: 'member'
  missionDay: number
  sentAt: string
  today: { date: string } & Record<(typeof METRIC_IDS)[number], CleanMetricValue>
  summary: Record<(typeof AREAS)[number], CleanArea> & {
    openAlerts: number
    ophiLine: string
    updatedAt: string
  }
  week: Record<(typeof WEEK_METRIC_IDS)[number], CleanPoint[]>
  vitals: CleanVitals | null
  alerts: CleanAlert[]
}

export type GroundWrite =
  | { reportId: string; key: string; remove: true }
  | { reportId: string; key: string; remove: false; report: CleanReport }

// ---- Small checks ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isLevel = (v: unknown): v is Level => LEVELS.includes(v as Level)
const isSource = (v: unknown): v is Source => SOURCES.includes(v as Source)
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isTime = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v))
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max

/** Refuses the report: thrown inside `cleanReport` and turned into `null` there. */
class Invalid extends Error {}

function need<T>(ok: boolean, value: T): T {
  if (!ok) throw new Invalid()
  return value
}

const numberOrNull = (v: unknown): number | null => need(v === null || isNum(v), v as number | null)
const sourceOrNull = (v: unknown): Source | null =>
  need(v === null || isSource(v), v as Source | null)

export function cleanId(value: unknown): string | null {
  return typeof value === 'string' && ID_PATTERN.test(value) ? value : null
}

// ---- The report -----------------------------------------------------------------------------

function cleanMetric(id: string, v: unknown): CleanMetricValue {
  need(isObj(v), null)
  const m = v as Obj
  // A ground report never holds a body mass (CONTRACTS section 8), so that line stays empty.
  if (id === 'bodyMassKg') return { value: null, targetId: id, level: 'none', source: null }
  return {
    value: numberOrNull(m.value),
    targetId: need(m.targetId === id, id),
    level: need(isLevel(m.level), m.level as Level),
    source: sourceOrNull(m.source),
  }
}

function cleanToday(v: unknown): CleanReport['today'] {
  need(isObj(v), null)
  const t = v as Obj
  const today = { date: need(isDate(t.date), t.date as string) } as CleanReport['today']
  for (const id of METRIC_IDS) today[id] = cleanMetric(id, t[id])
  return today
}

function cleanArea(v: unknown): CleanArea {
  need(isObj(v), null)
  const a = v as Obj
  return {
    level: need(isLevel(a.level), a.level as Level),
    text: need(isText(a.text, MAX_TEXT), a.text as string),
    source: sourceOrNull(a.source),
  }
}

function cleanSummary(v: unknown): CleanReport['summary'] {
  need(isObj(v), null)
  const s = v as Obj
  const areas = Object.fromEntries(AREAS.map((id) => [id, cleanArea(s[id])])) as Record<
    (typeof AREAS)[number],
    CleanArea
  >
  return {
    ...areas,
    openAlerts: need(
      isNum(s.openAlerts) && Number.isInteger(s.openAlerts) && s.openAlerts >= 0,
      s.openAlerts as number,
    ),
    ophiLine: need(isText(s.ophiLine, MAX_TEXT), s.ophiLine as string),
    updatedAt: need(isTime(s.updatedAt), s.updatedAt as string),
  }
}

function cleanWeek(v: unknown): CleanReport['week'] {
  need(isObj(v), null)
  const w = v as Obj
  // Exactly the five weekly metric ids, nothing more.
  const keys = Object.keys(w)
  need(keys.length === WEEK_METRIC_IDS.length, null)
  const week = {} as CleanReport['week']
  for (const id of WEEK_METRIC_IDS) {
    const points = w[id]
    need(Array.isArray(points) && points.length === 7, null)
    week[id] = (points as unknown[]).map((p) => {
      need(isObj(p), null)
      const point = p as Obj
      return {
        date: need(isDate(point.date), point.date as string),
        value: numberOrNull(point.value),
        source: sourceOrNull(point.source),
      }
    })
  }
  return week
}

function inRange(v: unknown, min: number, max: number): number | undefined {
  if (v === undefined) return undefined
  return need(isNum(v) && v >= min && v <= max, v as number)
}

function cleanVitals(v: unknown): CleanVitals | null {
  if (v === null) return null
  need(isObj(v), null)
  const s = v as Obj
  const heartRate = inRange(s.heartRate, 20, 260)
  const spo2 = inRange(s.spo2, 50, 100)
  const skinTempC = inRange(s.skinTempC, 20, 45)
  return {
    at: need(isTime(s.at), s.at as string),
    ...(heartRate !== undefined ? { heartRate } : {}),
    ...(spo2 !== undefined ? { spo2 } : {}),
    ...(skinTempC !== undefined ? { skinTempC } : {}),
    source: need(isSource(s.source), s.source as Source),
  }
}

function cleanAlerts(v: unknown): CleanAlert[] {
  need(Array.isArray(v) && v.length <= MAX_ALERTS, null)
  return (v as unknown[]).map((item) => {
    need(isObj(item), null)
    const a = item as Obj
    return {
      at: need(isTime(a.at), a.at as string),
      kind: need(a.kind === 'emergency' || a.kind === 'health', a.kind as CleanAlert['kind']),
      message: need(isText(a.message, MAX_ALERT_MESSAGE), a.message as string),
      status: need(
        a.status === 'open' || a.status === 'cancelled' || a.status === 'acknowledged',
        a.status as CleanAlert['status'],
      ),
    }
  })
}

/**
 * Rebuilds a report from the fields the contract allows, or gives null. `kind` must be `member`:
 * simulated crew and the demo profile never reach the server. `receivedAt` is never taken from
 * the body.
 */
export function cleanReport(value: unknown, reportId: string): CleanReport | null {
  try {
    need(isObj(value), null)
    const r = value as Obj
    need(r.kind === 'member', null)
    need(r.reportId === undefined || r.reportId === reportId, null)
    return {
      reportId,
      displayName: need(
        typeof r.displayName === 'string' &&
          r.displayName.trim().length > 0 &&
          r.displayName.length <= MAX_NAME_LENGTH,
        r.displayName as string,
      ),
      role: need(isText(r.role, MAX_NAME_LENGTH), r.role as string),
      kind: 'member',
      missionDay: need(
        isNum(r.missionDay) &&
          Number.isInteger(r.missionDay) &&
          r.missionDay >= 1 &&
          r.missionDay <= 10000,
        r.missionDay as number,
      ),
      sentAt: need(isTime(r.sentAt), r.sentAt as string),
      today: cleanToday(r.today),
      summary: cleanSummary(r.summary),
      week: cleanWeek(r.week),
      vitals: cleanVitals(r.vitals ?? null),
      alerts: cleanAlerts(r.alerts),
    }
  } catch (error) {
    if (error instanceof Invalid) return null
    throw error
  }
}

/** A whole `POST /api/ground/report` body, or null when it must be refused with 400. */
export function cleanGroundWrite(body: unknown): GroundWrite | null {
  if (!isObj(body)) return null
  const reportId = cleanId(body.reportId)
  const key = cleanId(body.key)
  if (!reportId || !key) return null
  if ('remove' in body) {
    return body.remove === true ? { reportId, key, remove: true } : null
  }
  const report = cleanReport(body.report, reportId)
  return report ? { reportId, key, remove: false, report } : null
}

/** The code from `Authorization: Bearer CODE`, or an empty string. */
export function bearerCode(header: string | null): string {
  if (!header || !header.startsWith('Bearer ')) return ''
  return header.slice(7).trim()
}
