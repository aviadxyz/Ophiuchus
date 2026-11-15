// The station around the crew (CONTRACTS section 8, "Environment metric ids"). The app has no
// cabin sensor, so every value is simulated from the clock: the same moment gives the same
// numbers on every device, nothing is stored, and there are no random numbers.

import { useMemo } from 'react'
import { useNow } from './clock'
import { MISSION } from './selectors'
import type { EnvironmentMetricId, EnvironmentPoint, EnvironmentSample } from './types'

const HOUR_MS = 3_600_000
const TWO_PI = Math.PI * 2
const STANDARD_GRAVITY = 9.80665
/** One orbit of a low-Earth-orbit station, in hours. */
const ORBIT_HOURS = 1.5

/** A slow sine wave with a fixed period (hours) and phase (radians). */
const wave = (hours: number, periodHours: number, phase: number) =>
  Math.sin((TWO_PI * hours) / periodHours + phase)

/** 1 in the middle of the crew's night (02:00 UTC), 0 in the middle of the day, smooth between. */
const nightness = (hours: number) => (1 + Math.cos((TWO_PI * (hours - 2)) / 24)) / 2

/** A short, smooth rise once an orbit: 0 most of the time, 1 at the peak. */
function orbitRise(hours: number): number {
  const phase = (hours / ORBIT_HOURS) % 1
  const distance = Math.min(phase, 1 - phase) - 0.5
  return Math.exp(-((distance / 0.12) ** 2))
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** The environment at a moment. Pure: the same moment always gives the same sample. */
export function environmentAt(at: Date): EnvironmentSample {
  const hours = at.getTime() / HOUR_MS
  const night = nightness(hours)
  const rise = orbitRise(hours)
  const inside = 9 + 1.2 * wave(hours, 9.1, 0.2) + 1.5 * wave(hours, 31, 2.4) + 1.6 * rise
  return {
    at: at.toISOString(),
    temperatureC: round(22.5 + 0.6 * wave(hours, 24, 0.4) + 0.4 * wave(hours, 7.3, 1.9), 1),
    humidityPct: round(45 + 4 * wave(hours, 24, 2.1) + 2 * wave(hours, 5.1, 0.7), 0),
    gravityG: round(MISSION.gravity / STANDARD_GRAVITY, 2),
    oxygenPct: round(20.9 + 0.12 * wave(hours, 11.5, 1.1) + 0.08 * wave(hours, 3.7, 0.3), 2),
    co2MmHg: round(
      2.6 + 0.3 * (2 * night - 1) + 0.15 * wave(hours, 6.1, 1.1) + 0.05 * wave(hours, 2.3, 0.6),
      2,
    ),
    noiseDb: round(60 + 2.5 * (1 - 2 * night) + 1.5 * wave(hours, 3.3, 0.3), 0),
    radiationUSvPerHour: round(
      23.8 + 2.5 * wave(hours, 16.7, 0.9) + 1.5 * wave(hours, 5.9, 2.2) + 5 * rise,
      1,
    ),
    mosfetOutsideUGyPerHour: round(3 * inside, 1),
    mosfetInsideUGyPerHour: round(inside, 1),
    source: 'simulated',
  }
}

/** The environment at the start of each of the last `hours` hours, oldest first. */
export function environmentSeries(
  metricId: EnvironmentMetricId,
  hours: number,
  now: Date,
): EnvironmentPoint[] {
  const thisHour = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS
  return Array.from({ length: Math.max(0, hours) }, (_, i) => {
    const sample = environmentAt(new Date(thisHour - (hours - 1 - i) * HOUR_MS))
    return { at: sample.at, value: sample[metricId], source: 'simulated' }
  })
}

/** The latest sample, refreshed once a minute. */
export function useEnvironment(): { sample: EnvironmentSample; connection: 'simulated' | 'off' } {
  const now = useNow()
  const minute = Math.floor(now.getTime() / 60_000)
  return useMemo(
    () => ({ sample: environmentAt(new Date(minute * 60_000)), connection: 'simulated' as const }),
    [minute],
  )
}

/** One entry per hour, oldest first. */
export function useEnvironmentSeries(metricId: EnvironmentMetricId, hours: number) {
  const now = useNow()
  const hour = Math.floor(now.getTime() / HOUR_MS)
  return useMemo(
    () => environmentSeries(metricId, hours, new Date(hour * HOUR_MS)),
    [metricId, hours, hour],
  )
}
