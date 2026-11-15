// The simulated ground view: one report for each member of the demo profile's simulated crew,
// plus the demo profile's own report when its sharing is on. Made on this device with no
// network call. Every value is marked simulated and every report has kind `demo`. The values are
// worked out from the clock, so every device shows the same crew at the same minute. Every level
// comes from `levelFor`, never written by hand.

import { buildHealthSummary } from '../compute'
import { lastDates, minutesOfDay, toDateString } from '../dates'
import { buildsUpDuringDay, expectedShare, levelFor } from '../levels'
import { MISSION } from '../selectors'
import { SIMULATED_CREW } from '../social/simulatedCrew'
import { useDataStore } from '../store'
import { targetsFor } from '../targets'
import { DEMO_PROFILE_ID } from '../seed'
import type { Alert, DaySummary, MetricId, MetricValue, SeriesPoint, TargetMap } from '../types'
import { metricIds } from '../types'
import { asSimulated, buildGroundReport, missionDayOn, reportAlerts } from './report'
import { GROUND_WEEK_METRICS, type GroundReport, type GroundWeekMetric } from './types'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

type Plan = {
  /** How long ago the report was sent. Always more than the signal delay, so it has arrived. */
  sentMinutesAgo: number
  sleepHours: number
  /** Share of the day's target reached, for the totals that build up during the day. */
  energy: number
  water: number
  exercise: number
  moodScore: number
  heartRate: number
  spo2: number
  alerts: Array<{
    hoursBeforeSent: number
    kind: Alert['kind']
    message: string
    status: Alert['status']
  }>
}

/**
 * One plan per simulated crew member: one needs attention now (sleep and mood well under target),
 * two need watching, the rest are on target. Two reports are late on purpose.
 */
const PLANS: Record<string, Plan> = {
  'sim-lunar-lark': {
    sentMinutesAgo: 6,
    sleepHours: 7.6,
    energy: 1,
    water: 1.05,
    exercise: 1,
    moodScore: 4,
    heartRate: 64,
    spo2: 98,
    alerts: [],
  },
  'sim-kestrel-9': {
    sentMinutesAgo: 62,
    sleepHours: 4.6,
    energy: 0.95,
    water: 0.95,
    exercise: 0.95,
    moodScore: 2,
    heartRate: 71,
    spo2: 97,
    alerts: [
      {
        hoursBeforeSent: 2,
        kind: 'health',
        message:
          'I have slept badly for two nights and feel low today. Should my sleep period be moved?',
        status: 'open',
      },
    ],
  },
  'sim-orbit-owl': {
    sentMinutesAgo: 14,
    sleepHours: 7.2,
    energy: 0.95,
    water: 0.8,
    exercise: 1,
    moodScore: 3,
    heartRate: 58,
    spo2: 98,
    alerts: [],
  },
  'sim-quiet-comet': {
    sentMinutesAgo: 9 * 60 + 5,
    sleepHours: 5.9,
    energy: 1,
    water: 1,
    exercise: 1.1,
    moodScore: 5,
    heartRate: 61,
    spo2: 99,
    alerts: [
      {
        hoursBeforeSent: 20,
        kind: 'health',
        message: 'How much water should I drink on a day with a long exercise session?',
        status: 'acknowledged',
      },
    ],
  },
  'sim-redshift': {
    sentMinutesAgo: 25,
    sleepHours: 7.4,
    energy: 1.02,
    water: 1,
    exercise: 0.95,
    moodScore: 3,
    heartRate: 69,
    spo2: 97,
    alerts: [],
  },
  'sim-blue-marble': {
    sentMinutesAgo: 9,
    sleepHours: 8.1,
    energy: 0.98,
    water: 1.1,
    exercise: 1,
    moodScore: 4,
    heartRate: 55,
    spo2: 99,
    alerts: [],
  },
}

/** A fixed number from 0 to 1 for a name and a day: the same on every device. */
function wobble(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 1000) / 1000
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** A full day's value for a past day, near the plan. */
function pastValue(
  plan: Plan,
  metric: GroundWeekMetric,
  targets: TargetMap,
  seed: string,
): number | null {
  const w = wobble(seed)
  switch (metric) {
    case 'sleepHours':
      return round1(plan.sleepHours + (w - 0.5) * 1.2)
    case 'energyKcal':
      return Math.round((targets.energyKcal.value * (plan.energy + (w - 0.5) * 0.15)) / 10) * 10
    case 'waterMl':
      return Math.round((targets.waterMl.value * (plan.water + (w - 0.5) * 0.2)) / 50) * 50
    case 'exerciseMinutes':
      return Math.round(targets.exerciseMinutes.value * (plan.exercise + (w - 0.5) * 0.3))
    case 'moodScore':
      // A missed check-in now and then is a gap, never a made-up score.
      return w < 0.12
        ? null
        : Math.min(5, Math.max(1, Math.round(plan.moodScore + (w - 0.5) * 1.6)))
  }
}

/** Today's value as of `sent`: totals that build up are the plan's share of what is expected by then. */
function todayValue(
  plan: Plan,
  metric: MetricId,
  targets: TargetMap,
  share: number,
): number | null {
  switch (metric) {
    case 'sleepHours':
      return plan.sleepHours
    case 'energyKcal':
      return Math.round(targets.energyKcal.value * share * plan.energy)
    case 'waterMl':
      return Math.round(targets.waterMl.value * share * plan.water)
    case 'proteinG':
      return Math.round(targets.proteinG.value * share * plan.energy)
    case 'exerciseMinutes':
      return Math.round(targets.exerciseMinutes.value * share * plan.exercise)
    case 'moodScore':
      return plan.moodScore
    default:
      // Nothing else is simulated, so it stays missing.
      return null
  }
}

function simulatedDay(plan: Plan, date: string, targets: TargetMap, share: number): DaySummary {
  const entries = metricIds.map((id): [MetricId, MetricValue] => {
    const value = todayValue(plan, id, targets, share)
    const builds = buildsUpDuringDay.has(id)
    return [
      id,
      {
        value,
        targetId: id,
        level: levelFor(value, targets[id], builds ? share : 1),
        source: value === null ? null : 'simulated',
      },
    ]
  })
  return { date, ...(Object.fromEntries(entries) as Record<MetricId, MetricValue>) }
}

function simulatedReport(
  member: (typeof SIMULATED_CREW)[number],
  plan: Plan,
  base: number,
  targets: TargetMap,
): GroundReport {
  const sent = new Date(base - plan.sentMinutesAgo * MINUTE_MS)
  const date = toDateString(sent)
  // Never less than a quarter of the day, so an early report still has something to compare.
  const share = Math.max(0.25, expectedShare(minutesOfDay(sent)))
  const today = simulatedDay(plan, date, targets, share)
  const alerts: Alert[] = plan.alerts.map((a, i) => ({
    id: `${member.socialId}-alert-${i}`,
    profileId: member.socialId,
    at: new Date(sent.getTime() - a.hoursBeforeSent * HOUR_MS).toISOString(),
    kind: a.kind,
    origin: 'console',
    message: a.message,
    status: a.status,
    screenId: 'medbot',
  }))
  const summary = buildHealthSummary(today, alerts, targets, sent)
  const week = Object.fromEntries(
    GROUND_WEEK_METRICS.map((metric) => {
      const points = lastDates(date, 7).map((day): SeriesPoint => {
        const value =
          day === date
            ? today[metric].value
            : pastValue(plan, metric, targets, `${member.socialId}|${metric}|${day}`)
        return { date: day, value, source: value === null ? null : 'simulated' }
      })
      return [metric, points]
    }),
  ) as GroundReport['week']

  return {
    reportId: member.socialId,
    displayName: member.handle,
    role: member.role,
    kind: 'demo',
    missionDay: missionDayOn(sent),
    sentAt: sent.toISOString(),
    receivedAt: new Date(sent.getTime() + MISSION.commDelaySeconds * 1000).toISOString(),
    today,
    summary,
    week,
    vitals: {
      at: new Date(sent.getTime() - 2 * MINUTE_MS).toISOString(),
      heartRate: plan.heartRate,
      spo2: plan.spo2,
      source: 'simulated',
    },
    alerts: reportAlerts(alerts, sent),
  }
}

/** The demo profile's own report, when its sharing is on: sent one signal delay ago, arriving now. */
function demoOwnReport(base: number): GroundReport | null {
  const setting = useDataStore.getState().groundShare[DEMO_PROFILE_ID]
  if (!setting?.on) return null
  const sent = new Date(base - MISSION.commDelaySeconds * 1000)
  const report = buildGroundReport(DEMO_PROFILE_ID, setting.reportId, sent)
  if (!report) return null
  return { ...asSimulated(report), receivedAt: new Date(base).toISOString() }
}

/** Every simulated report as of `now`, unsorted. */
export function simulatedGroundReports(now: Date = new Date()): GroundReport[] {
  const base = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS
  const targets = targetsFor({}, now)
  const crew = SIMULATED_CREW.flatMap((member) => {
    const plan = PLANS[member.socialId]
    return plan ? [simulatedReport(member, plan, base, targets)] : []
  })
  const own = demoOwnReport(base)
  return own ? [own, ...crew] : crew
}

/** Used by tests to check the plan covers the whole simulated crew. */
export const SIMULATED_PLAN_IDS = Object.keys(PLANS)
