import type { CSSProperties, ReactNode } from 'react'
import { useUrl } from './ids'
import { palette, type LayerView } from './palette'

export function Layer({ view, children }: { view: LayerView; children: ReactNode }) {
  return (
    <g
      className="bf-layer"
      data-mark={view.mark}
      data-hover={view.hover || undefined}
      style={{ opacity: view.opacity, '--bf-tone': view.tone } as CSSProperties}
    >
      <g className={view.pulse ? 'bf-pulse' : undefined}>{children}</g>
    </g>
  )
}

type VolProps = {
  d: string
  fill: string
  stroke?: string
  sw?: number
  /** Takes the status outline. On by default. */
  outline?: boolean
}

/** A filled shape with soft shading on top, so it reads as a rounded volume. */
export function Vol({ d, fill, stroke, sw = 0.9, outline = true }: VolProps) {
  const ref = useUrl()
  return (
    <>
      <path d={d} fill={fill} />
      <path
        d={d}
        fill={ref('vol')}
        stroke={stroke}
        strokeWidth={sw}
        className={outline ? 'bf-o' : undefined}
      />
    </>
  )
}

const css = `
.bf-layer { transition: opacity 180ms ease; }
/* bf-o: an outline that takes the status tone. bf-u: a dark edge under a stroke, same idea. */
.bf-o, .bf-u { transition: stroke 180ms ease; }
.bf-layer[data-hover] .bf-o { stroke: var(--color-text); stroke-opacity: 0.9; }
.bf-layer[data-hover] .bf-u { stroke: var(--color-text); stroke-opacity: 0.5; }
.bf-layer[data-mark] .bf-o, .bf-layer[data-mark] .bf-u { stroke: var(--bf-tone); stroke-opacity: 1; }
.bf-layer[data-mark] .bf-o { stroke-width: 1.2; }
.bf-layer[data-mark='chosen'] .bf-o, .bf-layer[data-mark='dashed'] .bf-o { stroke-width: 1.75; }
.bf-layer[data-mark='dashed'] .bf-o { stroke-dasharray: 4 3; }
.bf-pulse { animation: bf-pulse 2s ease-in-out infinite; }
.bf-beat { animation: bf-beat 1s linear infinite; transform-box: fill-box; transform-origin: 45% 40%; }
.bf-breathe { animation: bf-breathe 5s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 35%; }
.bf-flow { animation: bf-flow 1.8s linear infinite; }
.bf-flow-back { animation-direction: reverse; }
.bf-ctl { outline: none; cursor: pointer; }
.bf-ctl .bf-ring { opacity: 0; }
.bf-ctl:focus-visible .bf-ring { opacity: 1; }
.bf-hit { cursor: pointer; fill: transparent; stroke: transparent; pointer-events: all; }
@keyframes bf-beat { 0% { transform: scale(1); } 14% { transform: scale(1.05); } 32% { transform: scale(1); } 100% { transform: scale(1); } }
@keyframes bf-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
@keyframes bf-flow { to { stroke-dashoffset: -36; } }
@keyframes bf-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.62; } }
@media (prefers-reduced-motion: reduce) {
  .bf-beat, .bf-breathe, .bf-flow, .bf-pulse { animation: none !important; }
  .bf-layer, .bf-o, .bf-u { transition: none !important; }
}
`

export function FigureStyles() {
  return <style>{css}</style>
}

/** Shared shading, defined once. `bodyD` is the silhouette, used to clip the rim light. */
type Lens = { cx: number; cy: number; r: number }

export function FigureDefs({ uid, bodyD, lens }: { uid: string; bodyD: string; lens: Lens }) {
  return (
    <defs>
      <radialGradient id={`${uid}-vol`} cx="0.38" cy="0.3" r="0.8">
        <stop offset="0" stopColor={palette.light} stopOpacity="0.44" />
        <stop offset="0.42" stopColor={palette.light} stopOpacity="0" />
        <stop offset="0.62" stopColor={palette.shade} stopOpacity="0" />
        <stop offset="1" stopColor={palette.shade} stopOpacity="0.58" />
      </radialGradient>
      <linearGradient id={`${uid}-skin`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={palette.skin} stopOpacity="0.3" />
        <stop offset="0.5" stopColor={palette.skin} stopOpacity="0.22" />
        <stop offset="1" stopColor={palette.skin} stopOpacity="0.26" />
      </linearGradient>
      <radialGradient id={`${uid}-glow`}>
        <stop offset="0" stopColor={palette.lung} stopOpacity="0.85" />
        <stop offset="1" stopColor={palette.lung} stopOpacity="0" />
      </radialGradient>
      <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <filter id={`${uid}-haze`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
      <clipPath id={`${uid}-body`}>
        <path d={bodyD} />
      </clipPath>
      <clipPath id={`${uid}-lens`}>
        <circle cx={lens.cx} cy={lens.cy} r={lens.r} />
      </clipPath>
    </defs>
  )
}
