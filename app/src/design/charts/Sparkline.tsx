import { cn } from '../cn'
import { toneText } from '../toneClasses'
import type { Tone } from '../vocabulary'

export type SparklineProps = {
  /** Oldest first. null or undefined is a gap (a missing day). */
  values: Array<number | null | undefined>
  tone?: Tone
  /** Text for screen readers. Without it the line is decorative. */
  summary?: string
}

const W = 100
const H = 28
const PAD = 2

/** A tiny line. Missing values break the line; a lone value between gaps is drawn as a dot. */
export function Sparkline({ values, tone = 'ok', summary }: SparklineProps) {
  const present = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const a11y = summary ? { role: 'img', 'aria-label': summary } : { 'aria-hidden': true as const }
  if (present.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-7 w-full" {...a11y}>
        <line
          x1={0}
          x2={W}
          y1={H / 2}
          y2={H / 2}
          strokeDasharray="2 3"
          className="stroke-border"
          strokeWidth={1}
        />
      </svg>
    )
  }
  const min = Math.min(...present)
  const max = Math.max(...present)
  const span = max - min || 1
  const step = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0
  const point = (v: number, i: number) => ({
    x: values.length > 1 ? PAD + i * step : W / 2,
    y: max === min ? H / 2 : PAD + (1 - (v - min) / span) * (H - PAD * 2),
  })

  const segments: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  values.forEach((v, i) => {
    if (typeof v === 'number' && Number.isFinite(v)) current.push(point(v, i))
    else if (current.length) {
      segments.push(current)
      current = []
    }
  })
  if (current.length) segments.push(current)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn('block h-7 w-full', toneText[tone])}
      {...a11y}
    >
      {segments.map((segment, index) =>
        segment.length === 1 ? (
          <circle key={index} cx={segment[0]!.x} cy={segment[0]!.y} r={1.5} fill="currentColor" />
        ) : (
          <polyline
            key={index}
            points={segment.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ),
      )}
    </svg>
  )
}
