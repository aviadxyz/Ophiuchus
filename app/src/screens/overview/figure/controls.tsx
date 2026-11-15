import type { KeyboardEvent, ReactNode } from 'react'
import { blob, MIRROR, symmetric } from './geometry'
import { statusLabel, type Status } from './palette'
import {
  BLADDER_D,
  BRAIN_D,
  HEART_D,
  HEART_FIT,
  KIDNEY_L_D,
  KIDNEY_R_D,
  LIVER_D,
  LUNG_L_D,
  LUNG_R_D,
  STOMACH_D,
  lensTransform,
} from './shapes'

const pair = (node: ReactNode) => (
  <>
    {node}
    <g transform={MIRROR}>{node}</g>
  </>
)

const gutArea = blob([
  [150, 349], [170, 340], [200, 350], [232, 345], [250, 331], [256.5, 345], [255.5, 400],
  [249, 420], [233, 433], [213, 437], [206.5, 458], [195.5, 458], [193, 437], [170, 436],
  [152, 429], [150, 390],
])
const sinusArea = symmetric([
  [200, 65.5], [211, 66], [212, 75.5], [206.5, 78.5], [206, 90], [219.5, 90.5], [220, 104],
  [212, 108.5], [200, 108.5],
])
const brains = pair(<path d={BRAIN_D} />)

/**
 * Where each organ system can be clicked. `z` orders the click areas: a higher number is on top,
 * so a small organ over a large one can still be chosen. `pad` widens small targets.
 * `body` is in body coordinates, `head` inside the enlarged head.
 */
const areas: Record<string, { z: number; pad: number; body?: ReactNode; head?: ReactNode }> = {
  muscles: {
    z: 0,
    pad: 2,
    body: pair(
      <>
        <path d={blob([[268, 172], [292, 180], [302, 220], [309, 290], [317, 340], [292, 342], [284, 300], [277, 250], [272, 225], [262, 196]])} />
        <path d={blob([[293, 356], [322, 362], [326, 398], [299, 404]])} />
        <path d={blob([[203, 476], [240, 470], [279, 474], [276.5, 530], [268, 590], [256, 628], [210, 628], [205, 560]])} />
      </>,
    ),
  },
  bones: {
    z: 1,
    pad: 2,
    body: pair(
      <>
        <path d={blob([[208, 166], [270, 164], [274, 176], [208, 180]])} />
        <circle cx="304" cy="351" r="11" />
        <path d={blob([[299, 404], [326, 398], [332, 466], [351, 507], [337, 541], [309, 531], [306, 468]])} />
        <path d={blob([[244, 380], [258, 392], [262, 420], [262, 448], [248, 452], [246, 420]])} />
        <circle cx="232" cy="650" r="21" />
        <path d={blob([[207, 674], [257, 674], [254, 740], [242, 812], [257, 848], [209, 848], [211, 812], [206, 740]])} />
      </>,
    ),
  },
  lungs: {
    z: 2,
    pad: 2,
    body: (
      <>
        <path d={LUNG_R_D} />
        <path d={LUNG_L_D} />
        <rect x="194" y="172" width="12" height="36" rx="3" />
      </>
    ),
  },
  digestive: {
    z: 3,
    pad: 2,
    body: (
      <>
        <path d={gutArea} />
        <path d={STOMACH_D} />
        <path d={LIVER_D} />
      </>
    ),
  },
  heart: { z: 4, pad: 4, body: <path d={HEART_D} transform={HEART_FIT} /> },
  spine: { z: 5, pad: 8, body: <rect x="189" y="141" width="22" height="28" rx="4" /> },
  kidneys: {
    z: 6,
    pad: 3,
    body: (
      <>
        <path d={KIDNEY_L_D} />
        <path d={KIDNEY_R_D} />
        <path d={BLADDER_D} />
      </>
    ),
  },
  reproductive: { z: 7, pad: 6, body: <ellipse cx="200" cy="460" rx="17" ry="5.5" /> },
  brain: { z: 8, pad: 3, body: brains, head: brains },
  face: { z: 9, pad: 2, head: <path d={sinusArea} /> },
  eyes: { z: 10, pad: 3, head: pair(<circle cx="215.5" cy="84.3" r="6.5" />) },
  ears: { z: 11, pad: 3, head: pair(<circle cx="227.5" cy="90.5" r="7" />) },
}

type ControlSystem = { id: string; label: string; status: Status }

type ControlsProps = {
  systems: ControlSystem[]
  selectedId?: string
  lens: { cx: number; cy: number; scale: number }
  onSelect: (id: string) => void
  onHover: (id: string | undefined) => void
}

/**
 * The figure's controls. Keyboard and screen readers get one button per organ system, in the
 * order of the `systems` input, each with a focus ring in the shape of its organ. The pointer
 * gets a separate layer of invisible click areas stacked small-on-top.
 */
export function Controls({ systems, selectedId, lens, onSelect, onHover }: ControlsProps) {
  const known = systems.filter((s) => areas[s.id])
  const shapes = (id: string) => (
    <>
      {areas[id].body}
      {areas[id].head && <g transform={lensTransform(lens)}>{areas[id].head}</g>}
    </>
  )
  const onKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }
  return (
    <>
      {known.map((s) => (
        <g
          key={s.id}
          className="bf-ctl"
          data-system={s.id}
          role="button"
          tabIndex={0}
          aria-label={`${s.label}, ${statusLabel[s.status]}`}
          aria-pressed={selectedId === s.id}
          onClick={() => onSelect(s.id)}
          onKeyDown={(e) => onKey(e, s.id)}
          onFocus={() => onHover(s.id)}
          onBlur={() => onHover(undefined)}
        >
          <g className="bf-ring" fill="none" stroke="var(--color-text)" strokeWidth="2.2" pointerEvents="none">
            {shapes(s.id)}
          </g>
        </g>
      ))}
      <g aria-hidden="true">
        {[...known]
          .sort((a, b) => areas[a.id].z - areas[b.id].z)
          .map((s) => (
            <g
              key={s.id}
              className="bf-hit"
              data-system={s.id}
              strokeWidth={areas[s.id].pad * 2}
              onClick={() => onSelect(s.id)}
              onPointerEnter={() => onHover(s.id)}
              onPointerLeave={() => onHover(undefined)}
            >
              {shapes(s.id)}
            </g>
          ))}
      </g>
    </>
  )
}
