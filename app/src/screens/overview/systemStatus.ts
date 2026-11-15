import type { DaySummary } from '@/data'
import type { Level, Tone } from '@/design'
import type { BodySystemDef } from './systems'

export type SystemStatus = Level | 'untracked'

const severity: Record<Level, number> = {
  none: 0,
  ok: 1,
  watch: 2,
  act: 3,
}

/**
 * Returns the worst of several levels:
 * `act` beats `watch`, `watch` beats `ok`, and `none` is ignored unless every entry is `none`.
 * An empty list returns `none`.
 */
export function worstLevel(levels: readonly Level[]): Level {
  if (levels.length === 0) return 'none'
  let worst: Level = 'none'
  for (const level of levels) {
    if (severity[level] > severity[worst]) {
      worst = level
    }
  }
  return worst
}

/**
 * Evaluates the status of a body system against today's summary:
 * returns `untracked` if the system has no metric ids, otherwise `worstLevel` of its metrics' levels.
 */
export function systemStatus(system: BodySystemDef, today: DaySummary): SystemStatus {
  if (system.metricIds.length === 0) {
    return 'untracked'
  }
  const levels = system.metricIds.map((id) => today[id]?.level ?? 'none')
  return worstLevel(levels)
}

export const systemStatusLabel: Record<SystemStatus, string> = {
  ok: 'ON TARGET',
  watch: 'WATCH',
  act: 'ACT',
  none: 'NO DATA',
  untracked: 'NOT TRACKED',
}

export const systemStatusTone: Record<SystemStatus, Tone> = {
  ok: 'ok',
  watch: 'warn',
  act: 'danger',
  none: 'neutral',
  untracked: 'neutral',
}
