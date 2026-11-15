import { StatTile } from '@/design'
import { useEnvironmentSeries, useTargets, type EnvironmentSample } from '@/data'
import { formatNumber, levelOf, targetFor, targetWords, unitOf } from './derive'
import type { EnvironmentMetric } from './metrics'

/** One value as a tile. Pressing it opens the detail drawer. */
export function EnvironmentTile({
  metric,
  sample,
  onOpen,
}: {
  metric: EnvironmentMetric
  sample: EnvironmentSample
  onOpen: () => void
}) {
  const targets = useTargets()
  const series = useEnvironmentSeries(metric.id, 24)
  const value = sample[metric.id]
  const level = levelOf(metric, value, targets)
  return (
    <StatTile
      label={metric.name}
      value={formatNumber(value, metric.digits)}
      unit={unitOf(metric, targets)}
      targetText={targetWords(targetFor(metric, targets))}
      source={sample.source}
      trend={series.map((point) => point.value)}
      onOpen={onOpen}
      {...(level ? { level } : {})}
    />
  )
}
