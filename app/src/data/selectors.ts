// The hooks of CONTRACTS section 9, "Reading". Everything reads the active profile.
// Hooks select stable slices of the store and derive from them with useMemo, so a component
// re-renders only when something it shows has changed.

import { useMemo } from 'react'
import { useNow } from './clock'
import {
  buildHealthSummary,
  emptyProfileData,
  indexByDate,
  mealsOn,
  seriesFor,
  summarizeDay,
} from './compute'
import { addDays, dateOfTimestamp, daysBetween, toDateString } from './dates'
import { foods } from './foods'
import { useRuntime } from './runtime'
import { getActiveProfile, useDataStore } from './store'
import { targetsFor } from './targets'
import type {
  Alert,
  CrewProfile,
  DateString,
  DaySummary,
  ExerciseSession,
  FoodItem,
  HealthSummary,
  MealWithFood,
  MetricId,
  Mission,
  MoodCheckin,
  SeriesPoint,
  SleepRecord,
  TargetMap,
  VitalSample,
  VitalsConnection,
  WaterEntry,
} from './types'

/** The mission is the same for everyone. Mission day is always computed from the start date. */
export const MISSION: Mission = {
  name: 'Ophiuchus-1',
  startDate: '2026-11-01',
  lengthDays: 210,
  location: 'mars-transit',
  gravity: 0,
  commDelaySeconds: 240,
}

const NO_DATA = emptyProfileData()
const LIVE_MAX_AGE_MS = 30_000

export function useActiveProfile(): CrewProfile {
  return useDataStore((state) => getActiveProfile(state))
}

export function useProfiles(): CrewProfile[] {
  return useDataStore((state) => state.profiles)
}

export function useMission(): Mission & { day: number } {
  const now = useNow()
  const today = toDateString(now)
  return useMemo(
    () => ({ ...MISSION, day: Math.max(1, daysBetween(MISSION.startDate, today) + 1) }),
    [today],
  )
}

/** The active profile, its records, its targets and the clock: the base of most hooks. */
function useProfileContext() {
  const profile = useActiveProfile()
  const data = useDataStore((state) => state.data[state.activeProfileId] ?? NO_DATA)
  const now = useNow()
  const year = now.getFullYear()
  const targets = useMemo(() => targetsFor(profile, new Date(year, 6, 1)), [profile, year])
  const index = useMemo(() => indexByDate(data), [data])
  return { profile, data, now, targets, index, today: toDateString(now) }
}

export function useTargets(): TargetMap {
  return useProfileContext().targets
}

export function useFoods(): readonly FoodItem[] {
  return foods
}

export function useToday(): DaySummary {
  const { index, today, targets, now } = useProfileContext()
  return useMemo(() => summarizeDay(index, today, targets, now), [index, today, targets, now])
}

export function useDay(date: DateString): DaySummary {
  const { index, targets, now } = useProfileContext()
  return useMemo(() => summarizeDay(index, date, targets, now), [index, date, targets, now])
}

/** One entry per day, oldest first. A day with no data has a value of null: a gap, not a zero. */
export function useSeries(metricId: MetricId, days: number): SeriesPoint[] {
  const { index, today } = useProfileContext()
  return useMemo(() => seriesFor(index, metricId, days, today), [index, metricId, days, today])
}

export function useMeals(date: DateString): MealWithFood[] {
  const { data } = useProfileContext()
  return useMemo(() => mealsOn(data, date), [data, date])
}

export function useWater(date: DateString): WaterEntry[] {
  const { data } = useProfileContext()
  return useMemo(
    () =>
      data.water
        .filter((w) => dateOfTimestamp(w.at) === date)
        .sort((a, b) => a.at.localeCompare(b.at)),
    [data, date],
  )
}

/** Sessions from `fromDate` to `toDate`, both included, oldest first. */
export function useExerciseSessions(fromDate: DateString, toDate: DateString): ExerciseSession[] {
  const { data } = useProfileContext()
  return useMemo(
    () =>
      data.sessions
        .filter((s) => s.date >= fromDate && s.date <= toDate)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [data, fromDate, toDate],
  )
}

/** Check-ins from the last `days` days, newest first. */
export function useMoodCheckins(days: number): MoodCheckin[] {
  const { data, today } = useProfileContext()
  return useMemo(() => {
    const from = addDays(today, -(Math.max(1, days) - 1))
    return data.moods
      .filter((m) => (dateOfTimestamp(m.at) ?? '') >= from)
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [data, days, today])
}

/** Sleep records from the last `days` days, newest first. */
export function useSleep(days: number): SleepRecord[] {
  const { data, today } = useProfileContext()
  return useMemo(() => {
    const from = addDays(today, -(Math.max(1, days) - 1))
    return data.sleep.filter((s) => s.date >= from).sort((a, b) => b.date.localeCompare(a.date))
  }, [data, days, today])
}

export type LatestVitals = {
  /** null when there is no reading yet. */
  latest: VitalSample | null
  /** `live` a sensor or watch is sending, `simulated` the demo profile's simulator, `off` neither. */
  connection: VitalsConnection
}

export function useLatestVitals(): LatestVitals {
  const { profile, data, now } = useProfileContext()
  const live = useRuntime((state) => state.latestVital[profile.id])
  const sensor = useRuntime((state) => state.sensor)
  const simulatorOn = useRuntime((state) => state.simulatorOn)
  return useMemo(() => {
    const latest = live ?? data.vitals.at(-1) ?? null
    if (profile.kind === 'demo') return { latest, connection: simulatorOn ? 'simulated' : 'off' }
    const sensorOn = sensor?.profileId === profile.id && sensor.status === 'connected'
    const fresh =
      latest?.source === 'live' && now.getTime() - new Date(latest.at).getTime() < LIVE_MAX_AGE_MS
    return { latest, connection: sensorOn || fresh ? 'live' : 'off' }
  }, [live, data, profile, sensor, simulatorOn, now])
}

/** Alerts for the active profile, newest first. */
export function useAlerts(): Alert[] {
  const all = useDataStore((state) => state.alerts)
  const id = useDataStore((state) => state.activeProfileId)
  return useMemo(
    () => all.filter((a) => a.profileId === id).sort((a, b) => b.at.localeCompare(a.at)),
    [all, id],
  )
}

export function useHealthSummary(): HealthSummary {
  const today = useToday()
  const alerts = useAlerts()
  const { targets, now } = useProfileContext()
  return useMemo(
    () => buildHealthSummary(today, alerts, targets, now),
    [today, alerts, targets, now],
  )
}
