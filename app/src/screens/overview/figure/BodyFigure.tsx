import { useEffect, useId, useRef, useState } from 'react'
import { ChipGroup, type Level } from '@/design'
import { Controls } from './controls'
import { Hormones, Immune } from './glands'
import { HeadLens, HeadOrgans, type HeadViews } from './head'
import { Uid } from './ids'
import { Muscles } from './muscles'
import { Digestive, Heart, Kidneys, Lungs, Reproductive } from './organs'
import { Face, Skin, SurfaceMarks } from './outline'
import { statusLabel, statusTone, type LayerView, type Status } from './palette'
import { BODY_D, LENS } from './shapes'
import { Bones, Spine } from './skeleton'
import { FigureDefs, FigureStyles } from './styles'
import { useNarrow } from './useNarrow'
import { Vessels } from './vessels'

export type BodyFigureProps = {
  systems: Array<{
    id: string
    label: string
    kind: 'organ' | 'whole-body'
    status: Level | 'untracked'
  }>
  selectedId?: string
  onSelect: (id: string) => void
  heartRate?: number
}

/** Opacity of the other layers while one system is chosen. */
const DIM = 0.12
/** Lowest opacity of a layer whose status is WATCH or ACT while nothing is chosen. */
const FLAGGED = 0.4

export function BodyFigure({ systems, selectedId, onSelect, heartRate }: BodyFigureProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [hoverId, setHoverId] = useState<string>()
  const narrow = useNarrow()
  const lens = narrow ? LENS.narrow : LENS.wide

  // The shared drawer returns focus only to HTML elements, and these controls are SVG.
  // So when a system opened from the figure is closed again, put the focus back here.
  const svg = useRef<SVGSVGElement>(null)
  const openedHere = useRef<string | undefined>(undefined)
  const choose = (id: string) => {
    openedHere.current = id
    onSelect(id)
  }
  useEffect(() => {
    const id = openedHere.current
    if (selectedId !== undefined || !id) return
    openedHere.current = undefined
    svg.current?.querySelector<SVGGElement>(`.bf-ctl[data-system="${id}"]`)?.focus()
  }, [selectedId])

  const chosenId = systems.some((s) => s.id === selectedId) ? selectedId : undefined
  const statusOf = (id: string): Status => systems.find((s) => s.id === id)?.status ?? 'untracked'

  /**
   * How a layer looks right now. `rest` is its opacity when nothing is chosen.
   * A layer can belong to a second system as well (the vessels: heart and blood).
   */
  const view = (id: string, rest: number, alsoId?: string): LayerView => {
    const litBy = chosenId === id ? id : alsoId && chosenId === alsoId ? alsoId : undefined
    const status = statusOf(litBy ?? id)
    const hover = !litBy && (hoverId === id || (alsoId !== undefined && hoverId === alsoId))
    const dim = chosenId !== undefined && !litBy
    const flagged = status === 'watch' || status === 'act'
    return {
      // A faint layer that needs attention is lifted, so its status outline can be seen at rest.
      opacity: litBy
        ? 1
        : hover
          ? Math.max(rest, 0.62)
          : dim
            ? Math.min(rest, DIM)
            : flagged
              ? Math.max(rest, FLAGGED)
              : rest,
      tone: statusTone[status],
      mark: litBy ? (status === 'untracked' ? 'dashed' : 'chosen') : flagged && !dim ? 'flag' : undefined,
      hover,
      pulse: status === 'act' && !dim,
    }
  }

  const heart = view('heart', 1)
  const headOnBody: HeadViews = {
    brain: view('brain', 1),
    eyes: view('eyes', 0),
    ears: view('ears', 0),
    face: view('face', 0),
  }
  const headInLens: HeadViews = {
    brain: view('brain', 1),
    eyes: view('eyes', 1),
    ears: view('ears', 1),
    face: view('face', 0.9),
  }
  const eyesShown = chosenId === 'eyes' || hoverId === 'eyes'
  const spine = view('spine', 0.22)

  const beatSeconds = heartRate && heartRate > 0 ? 60 / heartRate : undefined
  const organs = systems.filter((s) => s.kind === 'organ')
  const wholeBody = systems.filter((s) => s.kind === 'whole-body')

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <svg
        ref={svg}
        viewBox={narrow ? '0 -204 400 1084' : '0 0 400 880'}
        className="mx-auto h-auto w-full max-w-[300px] select-none sm:max-w-[360px]"
        role="group"
        aria-label="Human body. Choose a body system to see how it is doing."
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <FigureStyles />
        <FigureDefs uid={uid} bodyD={BODY_D} lens={lens} />
        <Uid value={uid}>
          <Skin view={{ ...view('skin', 1), opacity: 1 }} />
          <g clipPath={`url(#${uid}-body)`}>
            <Muscles view={view('muscles', 0.08)} />
            <Bones view={view('bones', 0.16)} />
            <Spine view={chosenId === 'bones' ? { ...spine, opacity: 0.5 } : spine} />
            <Vessels view={view('heart', 0.95, 'blood')} flow={chosenId === 'blood'} />
            <Immune view={view('immune', 0.22)} />
            <Lungs view={view('lungs', 1)} />
            <Heart
              view={chosenId === 'blood' ? { ...heart, opacity: 0.6 } : heart}
              beatSeconds={beatSeconds}
            />
            <Kidneys view={view('kidneys', 1)} />
            <Hormones view={view('hormones', 0.3)} />
            <Digestive view={view('digestive', 1)} />
            <Reproductive view={view('reproductive', 0.45)} />
            <Kidneys view={view('kidneys', 1)} ghost />
            <HeadOrgans views={headOnBody} />
          </g>
          <Face lids={!eyesShown} opacity={chosenId && chosenId !== 'skin' ? 0.3 : 1} />
          <SurfaceMarks />
          <HeadLens lens={lens} views={headInLens} above={narrow} />
          <Controls
            systems={organs}
            selectedId={chosenId}
            lens={lens}
            onSelect={choose}
            onHover={setHoverId}
          />
        </Uid>
      </svg>

      <div className="w-full">
        <ChipGroup
          label="Whole-body systems"
          options={wholeBody.map((s) => ({ value: s.id, label: `${s.label} · ${statusLabel[s.status]}` }))}
          selected={selectedId ? [selectedId] : []}
          onChange={(vals) => {
            if (vals[0]) onSelect(vals[0])
          }}
        />
      </div>
    </div>
  )
}
