import { SourceLine, StatTile } from '@/design'
import { useSeries, useTargets, useToday, type MetricId, type Target } from '@/data'
import { formatNumber, litres } from './format'

type TileSpec = {
  id: MetricId
  label: string
  unit: string
  /** Turns a stored number into what the tile shows. */
  show: (n: number) => number | string
  /** The number used for the sparkline. */
  trend: (n: number) => number
  targetText: (target: Target) => string
}

const specs: TileSpec[] = [
  {
    id: 'energyKcal',
    label: 'Energy',
    unit: 'kcal',
    show: (n) => Math.round(n),
    trend: (n) => n,
    targetText: (t) => `of ${formatNumber(t.value)} today`,
  },
  {
    id: 'waterMl',
    label: 'Water',
    unit: 'L',
    show: (n) => litres(n),
    trend: (n) => n / 1000,
    targetText: (t) => `of ${litres(t.value)} L today`,
  },
  {
    id: 'proteinG',
    label: 'Protein',
    unit: 'g',
    show: (n) => Math.round(n),
    trend: (n) => n,
    targetText: (t) => `of ${formatNumber(t.value)} g today`,
  },
  {
    id: 'sodiumMg',
    label: 'Sodium',
    unit: 'mg',
    show: (n) => Math.round(n),
    trend: (n) => n,
    targetText: (t) => `limit ${formatNumber(t.value)}`,
  },
]

function MetricTile({ spec }: { spec: TileSpec }) {
  const today = useToday()
  const targets = useTargets()
  const series = useSeries(spec.id, 7)
  const metric = today[spec.id]
  const target = targets[spec.id]
  return (
    <StatTile
      label={spec.label}
      value={metric.value === null ? null : spec.show(metric.value)}
      unit={spec.unit}
      targetText={metric.value === null ? 'No data yet' : spec.targetText(target)}
      level={metric.level}
      {...(metric.source ? { source: metric.source } : {})}
      trend={series.map((p) => (p.value === null ? null : spec.trend(p.value)))}
    />
  )
}

/** Energy, water, protein and sodium for today, with a seven-day sparkline each. */
export function Tiles() {
  const targets = useTargets()
  const tileTargets = specs.map((s) => targets[s.id])
  const allVerified = tileTargets.every((t) => t.verified)
  const sourceText = allVerified
    ? [...new Set(tileTargets.map((t) => t.sourceText))].join('; ')
    : ''
  return (
    <section aria-label="Today's totals" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {specs.map((spec) => (
          <MetricTile key={spec.id} spec={spec} />
        ))}
      </div>
      <SourceLine text={sourceText} />
    </section>
  )
}
