// Records from CONTRACTS section 8. Field names are fixed. The four crew-network records
// (SocialAccount, SharedMood, SocialPerson, ChatMessage) belong to lane 17 and live in data/social.

import type { Level, Source } from '@/design'

export type { Level, Source }

/** A calendar day in the device's local time, written YYYY-MM-DD. */
export type DateString = string

/** A moment, as an ISO 8601 string. */
export type Timestamp = string

export type Sex = 'female' | 'male'

export type CrewProfile = {
  id: string
  displayName: string
  role: string
  kind: 'member' | 'demo'
  sex?: Sex
  birthYear?: number
  heightCm?: number
  massKg?: number
  consent: { relay: boolean; assistant: boolean }
  createdAt: Timestamp
}

export type MissionLocation = 'leo' | 'lunar-surface' | 'mars-transit'

export type Mission = {
  name: string
  startDate: DateString
  lengthDays: number
  location: MissionLocation
  /** In m/s². */
  gravity: number
  commDelaySeconds: number
}

export type SleepRecord = {
  id: string
  profileId: string
  /** The morning the night ended. */
  date: DateString
  hours: number
  /** 1 to 5. */
  quality?: number
  source: Source
}

export type MealEntry = {
  id: string
  profileId: string
  at: Timestamp
  foodId: string
  portions: number
  source: Source
}

export type WaterEntry = {
  id: string
  profileId: string
  at: Timestamp
  ml: number
  source: Source
}

export type ExerciseDevice = 'resistive' | 'treadmill' | 'cycle' | 'game' | 'other'
export type ExerciseKind = 'resistive' | 'aerobic'
export type SessionStatus = 'planned' | 'done' | 'changed' | 'skipped'

export type ExerciseSession = {
  id: string
  profileId: string
  date: DateString
  device: ExerciseDevice
  kind: ExerciseKind
  plannedMinutes: number
  actualMinutes: number
  status: SessionStatus
  skipReason?: string
  detail?: string
  source: Source
}

export type MoodCheckin = {
  id: string
  profileId: string
  at: Timestamp
  /** 1 to 5. */
  score: number
  tags: string[]
  note?: string
  source: Source
}

export type BodyMass = {
  id: string
  profileId: string
  date: DateString
  kg: number
  source: Source
}

export type VitalSample = {
  id: string
  profileId: string
  at: Timestamp
  heartRate?: number
  spo2?: number
  skinTempC?: number
  source: Source
}

export type AlertKind = 'emergency' | 'health'
export type AlertOrigin = 'console' | 'watch'
export type AlertStatus = 'open' | 'cancelled' | 'acknowledged'

export type Alert = {
  id: string
  profileId: string
  at: Timestamp
  kind: AlertKind
  origin: AlertOrigin
  message: string
  screenId?: string
  status: AlertStatus
  acknowledgedAt?: Timestamp
  /** The role of the person who raised it. Present only on an alert that arrived from another device. */
  from?: string
}

export type FoodItem = {
  id: string
  name: string
  kcal: number
  proteinG: number
  sodiumMg: number
  calciumMg: number
  ironMg: number
  vitaminDIu: number
  omega3G: number
  potassiumMg: number
  waterMl: number
}

export type TargetKind = 'min' | 'max' | 'range'

export type Target = {
  id: TargetId
  label: string
  kind: TargetKind
  /** The minimum, the maximum, or the lower end of a range. */
  value: number
  /** The upper end. Ranges only. */
  upper?: number
  unit: string
  sourceText: string
  sourceUrl: string
  verified: boolean
}

export const metricIds = [
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

export type MetricId = (typeof metricIds)[number]

// Environment metric ids (CONTRACTS section 8, prompt 25). They describe the station, not a person.
export const environmentMetricIds = [
  'temperatureC',
  'humidityPct',
  'gravityG',
  'oxygenPct',
  'co2MmHg',
  'noiseDb',
  'radiationUSvPerHour',
  'mosfetOutsideUGyPerHour',
  'mosfetInsideUGyPerHour',
] as const

export type EnvironmentMetricId = (typeof environmentMetricIds)[number]

/** Every environment metric except gravity, which has no target: the mission sets it. */
export const environmentTargetIds = [
  'temperatureC',
  'humidityPct',
  'oxygenPct',
  'co2MmHg',
  'noiseDb',
  'radiationUSvPerHour',
  'mosfetOutsideUGyPerHour',
  'mosfetInsideUGyPerHour',
] as const

export type EnvironmentTargetId = (typeof environmentTargetIds)[number]

export const targetIds = [
  ...metricIds,
  'resistiveSessionsPerWeek',
  'aerobicSessionsPerWeek',
  ...environmentTargetIds,
] as const

export type TargetId = (typeof targetIds)[number]

/** The targets of a person's own metrics. Always present in a `TargetMap`. */
export type CoreTargetId = Exclude<TargetId, EnvironmentTargetId>

export type MetricValue = {
  /** null means no data. */
  value: number | null
  targetId: CoreTargetId
  level: Level
  /** null when there is no data. */
  source: Source | null
}

export type DaySummary = { date: DateString } & Record<MetricId, MetricValue>

export type AreaSummary = {
  level: Level
  text: string
  /** null when there is no data. */
  source: Source | null
}

export type HealthSummary = {
  sleep: AreaSummary
  food: AreaSummary
  water: AreaSummary
  exercise: AreaSummary
  mood: AreaSummary
  openAlerts: number
  ophiLine: string
  updatedAt: Timestamp
}

/** What `useMeals` returns: a meal entry with its food. */
export type MealWithFood = MealEntry & { food: FoodItem }

export type SeriesPoint = {
  date: DateString
  value: number | null
  source: Source | null
}

/** Every core target is always present. The environment targets are optional for callers that build a map by hand. */
export type TargetMap = Record<CoreTargetId, Target> & Partial<Record<EnvironmentTargetId, Target>>

export type VitalsConnection = 'live' | 'simulated' | 'off'

/** Everything recorded for one profile. */
export type ProfileData = {
  sleep: SleepRecord[]
  meals: MealEntry[]
  water: WaterEntry[]
  sessions: ExerciseSession[]
  moods: MoodCheckin[]
  bodyMass: BodyMass[]
  vitals: VitalSample[]
}

export type ProfileDetails = {
  displayName: string
  role?: string
  sex?: Sex
  birthYear?: number
  heightCm?: number
  massKg?: number
  /** Last night's sleep, in hours. Recorded as an entered sleep record for today. */
  lastNightSleepHours?: number
  consent?: Partial<CrewProfile['consent']>
}

export type ProfileChanges = Partial<
  Pick<CrewProfile, 'displayName' | 'role' | 'sex' | 'birthYear' | 'heightCm' | 'massKg'>
> & { consent?: Partial<CrewProfile['consent']> }

export type VitalInput = {
  at?: Timestamp
  /** Defaults to the active profile. Sensors pass the profile they were connected for. */
  profileId?: string
  heartRate?: number
  spo2?: number
  skinTempC?: number
  source: Source
}

/** The station around the crew at one moment. The same for every profile; never stored. */
export type EnvironmentSample = {
  at: Timestamp
  /** Always simulated: the app has no cabin sensor. */
  source: 'simulated'
} & Record<EnvironmentMetricId, number>

/** One hour of an environment value, oldest first in a series. */
export type EnvironmentPoint = { at: Timestamp; value: number; source: 'simulated' }
