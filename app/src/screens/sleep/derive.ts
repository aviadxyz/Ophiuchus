// Numbers worked out from the nights on record. Pure functions.

import type { SeriesPoint } from '@/data'

export type WeekSummary = {
  /** Nights in the week that have a record. */
  nights: number
  /** Mean hours over the recorded nights, or null with none. */
  average: number | null
  /** Hours short of the target, added up over the recorded nights, or null with none. */
  debt: number | null
  /** Recorded nights at or above the target. */
  onTarget: number
}

/** Summarises the last seven entries of a daily series. A night with no record is left out, never counted as zero. */
export function summarizeWeek(series: readonly SeriesPoint[], targetHours: number): WeekSummary {
  const hours = series
    .slice(-7)
    .map((point) => point.value)
    .filter((value): value is number => value !== null)
  if (hours.length === 0) return { nights: 0, average: null, debt: null, onTarget: 0 }
  const total = hours.reduce((sum, h) => sum + h, 0)
  const debt = hours.reduce((sum, h) => sum + Math.max(0, targetHours - h), 0)
  return {
    nights: hours.length,
    average: Math.round((total / hours.length) * 10) / 10,
    debt: Math.round(debt * 10) / 10,
    onTarget: hours.filter((h) => h >= targetHours).length,
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "14 Nov" from "2026-11-14". */
export function shortDate(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ''}`.trim()
}

/** Lowest, mean and highest of a list, with the position of the lowest. */
export function range(values: readonly number[]): {
  min: number
  mean: number
  max: number
  minIndex: number
} {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const mean = Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10
  return { min, mean, max, minIndex: values.indexOf(min) }
}
