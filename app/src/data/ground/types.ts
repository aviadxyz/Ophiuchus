// The ground report and the two ground hooks (CONTRACTS sections 8 and 9, prompt 28).

import type {
  AlertKind,
  AlertStatus,
  DaySummary,
  HealthSummary,
  SeriesPoint,
  Timestamp,
  VitalSample,
} from '../types'

/** The five metrics a report carries a week of. */
export const GROUND_WEEK_METRICS = [
  'sleepHours',
  'energyKcal',
  'waterMl',
  'exerciseMinutes',
  'moodScore',
] as const

export type GroundWeekMetric = (typeof GROUND_WEEK_METRICS)[number]

export type GroundAlert = {
  at: Timestamp
  kind: AlertKind
  message: string
  status: AlertStatus
}

/**
 * What the medical team on Earth sees of one crew member. It never holds a mood note, a meal
 * list, a body mass, a birth year or a chat message: `today.bodyMassKg` is always empty.
 */
export type GroundReport = {
  reportId: string
  displayName: string
  role: string
  /** `member` for a real crew member, `demo` for the demo profile and the simulated crew. */
  kind: 'member' | 'demo'
  missionDay: number
  sentAt: Timestamp
  /** Set by the server. For a `demo` report it is `sentAt` plus the mission's signal delay. */
  receivedAt: Timestamp
  today: DaySummary
  summary: HealthSummary
  /** Seven entries per metric, oldest first. */
  week: Record<GroundWeekMetric, SeriesPoint[]>
  /** The latest reading without its `id` and `profileId`, or null. */
  vitals: Omit<VitalSample, 'id' | 'profileId'> | null
  /** Open alerts and those from the last 24 hours, newest first. */
  alerts: GroundAlert[]
}

/** What a device sends: the server sets `receivedAt`. */
export type OutgoingGroundReport = Omit<GroundReport, 'receivedAt'>

export type GroundShareState = 'off' | 'sending' | 'sent' | 'failed'

export type GroundShare = {
  on: boolean
  state: GroundShareState
  lastSentAt: Timestamp | null
}

export type GroundViewState =
  'closed' | 'checking' | 'open' | 'wrong-code' | 'not-set-up' | 'offline'

export type GroundView = {
  state: GroundViewState
  mode: 'live' | 'simulated'
  /** The worst `summary` level first, then the newest. */
  reports: GroundReport[]
  fetchedAt: Timestamp | null
}
