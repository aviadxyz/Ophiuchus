import { clamp01 } from '../clamp'
import { cn } from '../cn'
import { toneFill } from '../toneClasses'
import type { Tone } from '../vocabulary'

export type ProgressBarProps = { value: number; tone?: Tone; label: string }

/** A labeled bar from 0 to 1. */
export function ProgressBar({ value, tone = 'ok', label }: ProgressBarProps) {
  const v = clamp01(value)
  const percent = Math.round(v * 100)
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 break-words text-text-secondary">{label}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-border"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-200', toneFill[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
