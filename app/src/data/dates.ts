// Local-date helpers. A "date" is a calendar day in the device's time, written YYYY-MM-DD.

import type { DateString, Timestamp } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateString(date: Date): DateString {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The local day an ISO timestamp falls on. Returns null for text that is not a time. */
export function dateOfTimestamp(at: Timestamp): DateString | null {
  const date = new Date(at)
  return Number.isNaN(date.getTime()) ? null : toDateString(date)
}

export function parseDateString(date: DateString): Date {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function isDateString(value: unknown): value is DateString {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function addDays(date: DateString, days: number): DateString {
  const d = parseDateString(date)
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

/** Whole days from a to b (b minus a). */
export function daysBetween(a: DateString, b: DateString): number {
  return Math.round((parseDateString(b).getTime() - parseDateString(a).getTime()) / 86_400_000)
}

/** A moment on a local day, as an ISO timestamp. */
export function timestampOn(date: DateString, hour: number, minute = 0): Timestamp {
  const d = parseDateString(date)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** The last `days` dates ending at `today`, oldest first. */
export function lastDates(today: DateString, days: number): DateString[] {
  return Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)))
}

/** Minutes since local midnight. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** A random-enough unique id. Not used for anything secret. */
export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${random}`
}
