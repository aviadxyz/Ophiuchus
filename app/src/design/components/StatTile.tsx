import { ChevronRight } from 'lucide-react'
import { Sparkline } from '../charts/Sparkline'
import { formatValue } from '../formatValue'
import { levelLabel, levelTone, type Level, type Source } from '../vocabulary'
import { SourceBadge } from './SourceBadge'
import { StatusPill } from './StatusPill'

export type StatTileProps = {
  label: string
  /** A missing value shows as a dash with NO DATA. */
  value: number | string | null | undefined
  unit?: string
  targetText?: string
  level?: Level
  source?: Source
  /** Recent values, oldest first. Missing days are gaps. */
  trend?: Array<number | null | undefined>
  onOpen?: () => void
}

/** Label, big number, unit, target line, status pill, optional sparkline. */
export function StatTile({
  label,
  value,
  unit,
  targetText,
  level,
  source,
  trend,
  onOpen,
}: StatTileProps) {
  const shown = formatValue(value)
  const missing = shown === '—'
  const effectiveLevel: Level | undefined = missing ? 'none' : level
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-medium break-words text-text-secondary">{label}</span>
        {source && !missing && <SourceBadge source={source} />}
      </div>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="text-number font-semibold tabular-nums text-text">
          {missing ? <span aria-label="No data">—</span> : shown}
        </span>
        {unit && !missing && <span className="text-sm text-text-muted">{unit}</span>}
      </div>
      {targetText && <p className="m-0 text-xs break-words text-text-muted">{targetText}</p>}
      {trend && trend.length > 0 && (
        <Sparkline values={trend} tone={effectiveLevel ? levelTone[effectiveLevel] : 'neutral'} />
      )}
      {effectiveLevel && (
        <div className="mt-auto flex min-w-0 pt-1">
          <StatusPill tone={levelTone[effectiveLevel]} label={levelLabel[effectiveLevel]} />
        </div>
      )}
    </>
  )
  const frame =
    'flex h-full min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-left'
  if (!onOpen) return <div className={frame}>{body}</div>
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${frame} relative w-full cursor-pointer pr-8 transition-colors duration-150 hover:bg-surface-raised`}
    >
      {body}
      <ChevronRight aria-hidden="true" className="absolute top-4 right-2 size-4 text-text-muted" />
      <span className="sr-only">Open details</span>
    </button>
  )
}
