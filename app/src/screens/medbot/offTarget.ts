import type { Level, Source } from '@/design'
import { metricIds, moodWord } from '@/data'
import type { DaySummary, MetricId, TargetMap } from '@/data'

export type OffTargetMetric = {
  id: MetricId
  name: string
  valueText: string
  level: Extract<Level, 'watch' | 'act'>
  source: Source | null
  screenId?: string
}

/** Where each metric is looked after. Metrics not listed here have no link. */
const SCREEN_FOR_METRIC: Partial<Record<MetricId, string>> = {
  energyKcal: 'nutrition',
  waterMl: 'nutrition',
  proteinG: 'nutrition',
  sodiumMg: 'nutrition',
  calciumMg: 'nutrition',
  ironMg: 'nutrition',
  vitaminDIu: 'nutrition',
  omega3G: 'nutrition',
  potassiumMg: 'nutrition',
  exerciseMinutes: 'physical-activity',
  moodScore: 'mood',
}

function formatValue(id: MetricId, value: number, unit: string): string {
  if (id === 'moodScore') {
    return `${moodWord(Math.round(value))} (${Math.round(value * 10) / 10} ${unit})`
  }
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded.toLocaleString('en-GB')} ${unit}`
}

/** Every metric in today's summary at level watch or act, worst first. */
export function offTargetMetrics(today: DaySummary, targets: TargetMap): OffTargetMetric[] {
  const list: OffTargetMetric[] = []
  for (const id of metricIds) {
    const metric = today[id]
    if (metric.level !== 'watch' && metric.level !== 'act') continue
    if (metric.value === null) continue
    const target: TargetMap[MetricId] | undefined = targets[id]
    list.push({
      id,
      name: target?.label ?? id,
      valueText: formatValue(id, metric.value, target?.unit ?? ''),
      level: metric.level,
      source: metric.source,
      screenId: SCREEN_FOR_METRIC[id],
    })
  }
  return list.sort((a, b) => (a.level === b.level ? 0 : a.level === 'act' ? -1 : 1))
}
