import { lazy, Suspense } from 'react'
import { cn } from '../cn'
import { toneText } from '../toneClasses'
import type { Tone } from '../vocabulary'

const TrendChartCanvas = lazy(() => import('./TrendChartCanvas'))

export type TrendSeries = {
  name: string
  /** One per label. null or undefined is a gap. */
  values: Array<number | null | undefined>
  tone: Tone
}

export type TrendChartProps = {
  kind: 'line' | 'bar'
  labels: string[]
  series: TrendSeries[]
  targetValue?: number
  /** What the chart shows, in words, for screen readers. */
  summary: string
  /** Chart height in px. */
  height?: number
}

/** Line or bar chart over time. Missing values are gaps, never zeros. */
export function TrendChart({
  kind,
  labels,
  series,
  targetValue,
  summary,
  height = 220,
}: TrendChartProps) {
  const hasData = series.some((s) =>
    s.values.some((v) => typeof v === 'number' && Number.isFinite(v)),
  )
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2">
      <figcaption className="sr-only">{summary}</figcaption>
      {hasData ? (
        <Suspense
          fallback={
            <div
              aria-hidden="true"
              style={{ height }}
              className="w-full animate-pulse rounded-md bg-surface-raised/50"
            />
          }
        >
          <TrendChartCanvas
            kind={kind}
            labels={labels}
            series={series}
            targetValue={targetValue}
            height={height}
          />
        </Suspense>
      ) : (
        <div
          style={{ height }}
          className="flex items-center justify-center rounded-md border border-dashed border-border text-sm text-text-muted"
        >
          No data for this period.
        </div>
      )}
      {(series.length > 1 || targetValue !== undefined) && (
        <ul
          aria-hidden="true"
          className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 font-mono text-pill uppercase tracking-wider text-text-secondary"
        >
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className={cn('inline-block h-0.5 w-3 bg-current', toneText[s.tone])} />
              {s.name}
            </li>
          ))}
          {targetValue !== undefined && (
            <li className="flex items-center gap-1.5">
              <span className="inline-block w-3 border-t border-dashed border-text-muted" />
              Target
            </li>
          )}
        </ul>
      )}
    </figure>
  )
}
