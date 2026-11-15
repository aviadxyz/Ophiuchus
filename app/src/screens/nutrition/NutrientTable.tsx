import { useState } from 'react'
import {
  Card,
  DataTable,
  DetailDrawer,
  SectionLabel,
  SourceBadge,
  SourceLine,
  StatusPill,
  TrendChart,
  levelLabel,
  levelTone,
  type DataTableRow,
} from '@/design'
import { useFoods, useSeries, useTargets, useToday, type MetricValue, type Target } from '@/data'
import { formatNumber, shortDate } from './format'
import { helpfulFoods, nutrients, type NutrientDef } from './nutrients'
import { useNarrow } from './useNarrow'

function targetText(def: NutrientDef, target: Target): string {
  return def.direction === 'less'
    ? `limit ${formatNumber(target.value)} ${target.unit}`
    : `of ${formatNumber(target.value)} ${target.unit}`
}

/** Today's value with its unit, its source badge and its target. */
function TodayCell({
  def,
  metric,
  target,
}: {
  def: NutrientDef
  metric: MetricValue
  target: Target
}) {
  if (metric.value === null) return <span>No data yet</span>
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="font-semibold tabular-nums text-text">
        {formatNumber(metric.value)} {target.unit}
      </span>
      {metric.source && <SourceBadge source={metric.source} />}
      <span className="text-xs text-text-muted">{targetText(def, target)}</span>
    </span>
  )
}

function NutrientDetail({ def }: { def: NutrientDef }) {
  const today = useToday()
  const targets = useTargets()
  const foods = useFoods()
  const series = useSeries(def.id, 7)
  const metric = today[def.id]
  const target = targets[def.id]
  const helpers = helpfulFoods(foods, def.id, def.direction)
  const days = series.filter((p) => p.value !== null).length
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone={levelTone[metric.level]} label={levelLabel[metric.level]} />
          <TodayCell def={def} metric={metric} target={target} />
        </div>
        <p className="m-0 text-base text-text-secondary">{def.why}</p>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel as="h3">Last 7 days</SectionLabel>
        <TrendChart
          kind="bar"
          labels={series.map((p) => shortDate(p.date))}
          series={[
            {
              name: def.label,
              values: series.map((p) => p.value),
              tone: levelTone[metric.level],
            },
          ]}
          targetValue={target.value}
          height={200}
          summary={`${def.label} over the last 7 days in ${target.unit}, with ${days} of 7 days logged. The target is ${formatNumber(target.value)} ${target.unit}.`}
        />
        <SourceLine
          text={target.verified ? target.sourceText : ''}
          href={target.sourceUrl || undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel as="h3">
          {def.direction === 'less' ? 'Lowest in ' : 'Richest in '}
          {def.label}
        </SectionLabel>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {helpers.map((food) => (
            <li
              key={food.id}
              className="flex items-baseline justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2"
            >
              <span className="min-w-0 text-base break-words text-text">{food.name}</span>
              <span className="shrink-0 text-sm tabular-nums text-text-secondary">
                {formatNumber(food[def.id])} {target.unit} a portion
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** The six nutrients that behave differently in space. A row opens its detail. */
export function NutrientTable() {
  const today = useToday()
  const targets = useTargets()
  const narrow = useNarrow()
  const [openId, setOpenId] = useState<NutrientDef['id'] | null>(null)
  const open = nutrients.find((n) => n.id === openId)

  const rows: DataTableRow[] = nutrients.map((def) => {
    const metric = today[def.id]
    return {
      id: def.id,
      barTone: levelTone[metric.level],
      cells: [
        def.label,
        def.why,
        <TodayCell key="today" def={def} metric={metric} target={targets[def.id]} />,
      ],
      pill: { tone: levelTone[metric.level], label: levelLabel[metric.level] },
      onOpen: () => setOpenId(def.id),
    }
  })

  return (
    <Card title="Space-critical nutrients" footer={<SourceLine text="" />}>
      <DataTable
        columns={
          narrow ? ['Nutrient', 'Why', 'Today'] : ['Nutrient', 'Why it matters in space', 'Today']
        }
        rows={rows}
      />
      <DetailDrawer
        open={open !== undefined}
        title={open?.label ?? ''}
        onClose={() => setOpenId(null)}
      >
        {open && <NutrientDetail def={open} />}
      </DetailDrawer>
    </Card>
  )
}
