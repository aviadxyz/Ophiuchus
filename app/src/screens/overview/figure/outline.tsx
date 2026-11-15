import { useUrl } from './ids'
import { curve, MIRROR, type Pt } from './geometry'
import { palette, type LayerView } from './palette'
import { BODY_D, EAR_D } from './shapes'
import { Layer } from './styles'

/** The translucent body: a soft fill, a rim of light just inside the edge, and a fine outline. */
export function Skin({ view }: { view: LayerView }) {
  const url = useUrl()
  const strong = view.mark === 'chosen' || view.mark === 'dashed'
  return (
    <Layer view={view}>
      {[undefined, MIRROR].map((t) => (
        <path
          key={t ?? 'l'}
          d={EAR_D}
          transform={t}
          fill={palette.skin}
          fillOpacity="0.3"
          stroke={palette.skinLight}
          strokeOpacity="0.7"
          strokeWidth="0.9"
        />
      ))}
      <path d={BODY_D} fill="var(--color-surface)" />
      <path d={BODY_D} fill={url('skin')} />
      {strong && <path d={BODY_D} fill={url('skin')} />}
      <g clipPath={url('body')}>
        <path
          d={BODY_D}
          fill="none"
          stroke={palette.skinLight}
          strokeOpacity={strong ? 0.6 : 0.42}
          strokeWidth="20"
          filter={url('soft')}
        />
      </g>
      <path
        className="bf-o"
        d={BODY_D}
        fill="none"
        stroke={palette.skinLight}
        strokeOpacity="0.9"
        strokeWidth="1.1"
      />
    </Layer>
  )
}

const jaw: Pt[] = [[228, 112], [223, 122], [213.5, 129.5], [200, 132.5]]
const lid: Pt[] = [[208.5, 84], [212, 86], [216.5, 86.4], [221, 85]]
const brow: Pt[] = [[206.5, 77.5], [212, 75.2], [218.5, 75.6], [223.5, 78.5]]
const noseSide: Pt[] = [[203.2, 86], [204, 95], [206.6, 101.5], [205.6, 104.5], [202.8, 105]]

/** A simple calm face, and the small surface marks that make the body read as a body. */
export function Face({ lids = true, opacity = 1 }: { lids?: boolean; opacity?: number }) {
  return (
    <g
      fill="none"
      stroke={palette.skinLight}
      strokeWidth="0.9"
      opacity={opacity}
      style={{ transition: 'opacity 180ms ease' }}
    >
      {[undefined, MIRROR].map((t) => (
        <g key={t ?? 'l'} transform={t}>
          <path d={curve(jaw)} strokeOpacity="0.4" />
          {lids && <path d={curve(lid)} strokeOpacity="0.85" />}
          {lids && <path d={curve(brow)} strokeOpacity="0.45" strokeWidth="1.3" />}
          <path d={curve(noseSide)} strokeOpacity="0.55" />
        </g>
      ))}
      <path d="M197.4 105.6Q200 107.2 202.6 105.6" strokeOpacity="0.6" />
      <path d="M191.5 115.2Q196 116.6 200 115.6Q204 116.6 208.5 115.2" strokeOpacity="0.8" />
      <path d="M196 120.4Q200 121.6 204 120.4" strokeOpacity="0.3" />
    </g>
  )
}

/** Kneecaps, fingers and toes, drawn over the layers so the surface is still felt. */
export function SurfaceMarks() {
  return (
    <g fill="none" stroke={palette.skinLight} strokeOpacity="0.35" strokeWidth="0.9">
      {[undefined, MIRROR].map((t) => (
        <g key={t ?? 'l'} transform={t}>
          <path d="M222 641Q232 634 243 641" />
          <path d="M224 660Q232 665 241 660" />
          <path d="M331 540.5L329.6 513M320.4 541.6L321 511M314.6 536.8L314.6 509.5" />
          <path d="M221.5 853.2L222.3 847M229.5 854L230 847.5M237.5 854.2L237.6 848M245 853.8L244.6 848" />
        </g>
      ))}
    </g>
  )
}
