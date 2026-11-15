// How a value compares with its target (CONTRACTS section 7). Pure functions, implemented once.

import type { Level } from '@/design'
import type { Target, TargetId } from './types'

const EPS = 1e-9

/** Metrics that build up during the day. Today's value is compared with the share expected by now. */
export const buildsUpDuringDay: ReadonlySet<TargetId> = new Set<TargetId>([
  'energyKcal',
  'waterMl',
  'proteinG',
  'exerciseMinutes',
])

const DAY_START_MINUTE = 7 * 60
const DAY_END_MINUTE = 23 * 60

/** Share of a daily total expected by a time of day, counting from 07:00 to 23:00. 0 to 1. */
export function expectedShare(minuteOfDay: number): number {
  const share = (minuteOfDay - DAY_START_MINUTE) / (DAY_END_MINUTE - DAY_START_MINUTE)
  return Math.min(1, Math.max(0, share))
}

/** Reach at least: 90% or more is ok, 70% to under 90% is watch, under 70% is act. */
export function levelForMin(value: number, minimum: number): Level {
  if (value >= minimum * 0.9 - EPS) return 'ok'
  if (value >= minimum * 0.7 - EPS) return 'watch'
  return 'act'
}

/** Stay under: at or under the limit is ok, up to 20% over is watch, more than that is act. */
export function levelForMax(value: number, limit: number): Level {
  if (value <= limit + EPS) return 'ok'
  if (value <= limit * 1.2 + EPS) return 'watch'
  return 'act'
}

/** Stay inside: inside is ok, within 15% outside is watch, further outside is act. */
export function levelForRange(value: number, lower: number, upper: number): Level {
  if (value >= lower - EPS && value <= upper + EPS) return 'ok'
  const miss = value < lower ? (lower - value) / lower : (value - upper) / upper
  return miss <= 0.15 + EPS ? 'watch' : 'act'
}

/**
 * The level of a value against a target. `share` (0 to 1) scales a minimum target for totals
 * that build up during the day; leave it out for a full-day comparison.
 */
export function levelFor(value: number | null, target: Target, share = 1): Level {
  if (value === null || !Number.isFinite(value)) return 'none'
  if (target.kind === 'min') return levelForMin(value, target.value * share)
  if (target.kind === 'max') return levelForMax(value, target.value)
  return levelForRange(value, target.value, target.upper ?? target.value)
}

const severity: Record<Level, number> = { none: 0, ok: 1, watch: 2, act: 3 }

/** The worst of several levels. A level of none is ignored unless every level is none. */
export function worstLevel(levels: readonly Level[]): Level {
  let worst: Level = 'none'
  for (const level of levels) if (severity[level] > severity[worst]) worst = level
  return worst
}
