import type { HeaderPill, Level } from '@/design'
import { levelFor, type EnvironmentSample, type Target, type TargetMap } from '@/data'
import { environmentMetrics, type EnvironmentMetric } from './metrics'

/** Gravity has no target, so it never gets a level. */
export function targetFor(metric: EnvironmentMetric, targets: TargetMap): Target | null {
  const id = metric.id
  if (id === 'gravityG') return null
  return targets[id] ?? null
}

export function levelOf(
  metric: EnvironmentMetric,
  value: number,
  targets: TargetMap,
): Level | undefined {
  const target = targetFor(metric, targets)
  return target ? levelFor(value, target) : undefined
}

export function formatNumber(value: number, digits: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** The target in words, for example "Target: 18 to 27 °C" or "Stay under 3 mmHg". */
export function targetWords(target: Target | null): string {
  if (!target) return 'No target. The mission sets gravity.'
  if (target.kind === 'range')
    return `Target: ${target.value} to ${target.upper ?? target.value} ${target.unit}`
  if (target.kind === 'max') return `Stay under ${target.value} ${target.unit}`
  return `Reach at least ${target.value} ${target.unit}`
}

export function levelCounts(sample: EnvironmentSample, targets: TargetMap): Record<Level, number> {
  const counts: Record<Level, number> = { ok: 0, watch: 0, act: 0, none: 0 }
  for (const metric of environmentMetrics) {
    const level = levelOf(metric, sample[metric.id], targets)
    if (level) counts[level] += 1
  }
  return counts
}

/** Counts at each level, plus SIMULATED. At most three pills, so ON TARGET goes first when all three levels appear. */
export function headerPills(counts: Record<Level, number>): HeaderPill[] {
  const pills: HeaderPill[] = []
  if (counts.act > 0) pills.push({ tone: 'danger', label: `${counts.act} ACT` })
  if (counts.watch > 0) pills.push({ tone: 'warn', label: `${counts.watch} WATCH` })
  if (counts.ok > 0 && pills.length < 2) pills.push({ tone: 'ok', label: `${counts.ok} ON TARGET` })
  pills.push({ tone: 'neutral', label: 'SIMULATED' })
  return pills
}

export function hourLabel(at: string): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** The unit shown beside a value. Gravity has no target, so it is always g. */
export function unitOf(metric: EnvironmentMetric, targets: TargetMap): string {
  return targetFor(metric, targets)?.unit ?? 'g'
}
