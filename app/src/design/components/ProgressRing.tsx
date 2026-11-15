import type { ReactNode } from 'react'
import { clamp01 } from '../clamp'
import { cn } from '../cn'
import { toneText } from '../toneClasses'
import type { Tone } from '../vocabulary'

export type ProgressRingProps = {
  value: number
  tone?: Tone
  /** Diameter in px. */
  size?: number
  /** Read by screen readers. */
  label?: string
  children?: ReactNode
}

/** A ring from 0 to 1 with content in the middle. Used for watch rings and hold-to-send. */
export function ProgressRing({
  value,
  tone = 'ok',
  size = 96,
  label,
  children,
}: ProgressRingProps) {
  const v = clamp01(value)
  const stroke = Math.max(4, Math.round(size / 12))
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - v)}
          className={cn('transition-[stroke-dashoffset] duration-200', toneText[tone])}
        />
      </svg>
      {children !== undefined && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  )
}
