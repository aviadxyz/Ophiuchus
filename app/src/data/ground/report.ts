// Builds one profile's GroundReport from the store, with the same functions the relay snapshot
// and the hooks use. Only the contract's fields are copied in: no mood note, no meal, no body
// mass, no birth year, no chat. Missing values stay missing and every value keeps its source.

import type { Source } from '@/design'
import {
  buildHealthSummary,
  emptyProfileData,
  indexByDate,
  seriesFor,
  summarizeDay,
} from '../compute'
import { daysBetween, toDateString } from '../dates'
import { useRuntime } from '../runtime'
import { MISSION } from '../selectors'
import { useDataStore } from '../store'
import { targetsFor } from '../targets'
import type { Alert, DaySummary, HealthSummary, SeriesPoint, VitalSample } from '../types'
import { GROUND_WEEK_METRICS, type GroundAlert, type OutgoingGroundReport } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
export const MAX_REPORT_ALERTS = 20
export const MAX_ALERT_MESSAGE = 300
const MAX_NAME = 40

export function missionDayOn(now: Date): number {
  return Math.max(1, daysBetween(MISSION.startDate, toDateString(now)) + 1)
}

/** Open alerts and those from the last 24 hours, newest first, as a report carries them. */
export function reportAlerts(alerts: readonly Alert[], now: Date): GroundAlert[] {
  const since = now.getTime() - DAY_MS
  return alerts
    .filter((a) => a.status === 'open' || new Date(a.at).getTime() >= since)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_REPORT_ALERTS)
    .map((a) => ({
      at: a.at,
      kind: a.kind,
      message: a.message.slice(0, MAX_ALERT_MESSAGE),
      status: a.status,
    }))
}

/** A report never holds a body mass, so that line of the day is always empty. */
function withoutBodyMass(today: DaySummary): DaySummary {
  return {
    ...today,
    bodyMassKg: { value: null, targetId: 'bodyMassKg', level: 'none', source: null },
  }
}

function latestVitals(profileId: string): OutgoingGroundReport['vitals'] {
  const live = useRuntime.getState().latestVital[profileId]
  const saved = useDataStore.getState().data[profileId]?.vitals.at(-1)
  const latest: VitalSample | undefined =
    live && (!saved || live.at >= saved.at) ? live : (saved ?? live)
  if (!latest) return null
  const { id, profileId: owner, ...rest } = latest
  void id
  void owner
  return rest
}

// ---- Simulated sources ------------------------------------------------------------------------

const simulated = (source: Source | null): Source | null => (source === null ? null : 'simulated')

const simDay = (day: DaySummary): DaySummary =>
  Object.fromEntries(
    Object.entries(day).map(([key, value]) =>
      key === 'date' || typeof value !== 'object' || value === null
        ? [key, value]
        : [key, { ...value, source: simulated(value.source) }],
    ),
  ) as DaySummary

const simSummary = (summary: HealthSummary): HealthSummary => ({
  ...summary,
  sleep: { ...summary.sleep, source: simulated(summary.sleep.source) },
  food: { ...summary.food, source: simulated(summary.food.source) },
  water: { ...summary.water, source: simulated(summary.water.source) },
  exercise: { ...summary.exercise, source: simulated(summary.exercise.source) },
  mood: { ...summary.mood, source: simulated(summary.mood.source) },
})

const simSeries = (points: SeriesPoint[]): SeriesPoint[] =>
  points.map((p) => ({ ...p, source: simulated(p.source) }))

/**
 * Every value of a `demo` report is marked simulated, even one typed in on the demo profile,
 * so a simulated report is never mistaken for a real one.
 */
export function asSimulated(report: OutgoingGroundReport): OutgoingGroundReport {
  return {
    ...report,
    kind: 'demo',
    today: simDay(report.today),
    summary: simSummary(report.summary),
    week: Object.fromEntries(
      GROUND_WEEK_METRICS.map((id) => [id, simSeries(report.week[id])]),
    ) as OutgoingGroundReport['week'],
    vitals: report.vitals ? { ...report.vitals, source: 'simulated' } : null,
  }
}

// ---- The report -------------------------------------------------------------------------------

/** One profile's report as of `now`, or null when the profile does not exist. */
export function buildGroundReport(
  profileId: string,
  reportId: string,
  now: Date = new Date(),
): OutgoingGroundReport | null {
  const state = useDataStore.getState()
  const profile = state.profiles.find((p) => p.id === profileId)
  if (!profile) return null
  const data = state.data[profileId] ?? emptyProfileData()
  const targets = targetsFor(profile, now)
  const index = indexByDate(data)
  const todayDate = toDateString(now)
  const today = withoutBodyMass(summarizeDay(index, todayDate, targets, now))
  const alerts = state.alerts.filter((a) => a.profileId === profileId)
  const summary = buildHealthSummary(today, alerts, targets, now)
  const week = Object.fromEntries(
    GROUND_WEEK_METRICS.map((id) => [id, seriesFor(index, id, 7, todayDate)]),
  ) as OutgoingGroundReport['week']

  const report: OutgoingGroundReport = {
    reportId,
    displayName: profile.displayName.slice(0, MAX_NAME),
    role: profile.role.slice(0, MAX_NAME),
    kind: profile.kind,
    missionDay: missionDayOn(now),
    sentAt: now.toISOString(),
    today,
    summary,
    week,
    vitals: latestVitals(profileId),
    alerts: reportAlerts(alerts, now),
  }
  return profile.kind === 'demo' ? asSimulated(report) : report
}

/** The report without its send times, to tell whether anything changed. */
export function reportFingerprint(report: OutgoingGroundReport): string {
  const { sentAt, summary, ...rest } = report
  void sentAt
  const { updatedAt, ...summaryRest } = summary
  void updatedAt
  return JSON.stringify({ ...rest, summary: summaryRest })
}
