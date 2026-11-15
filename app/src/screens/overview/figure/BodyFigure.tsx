import type { KeyboardEvent } from 'react'
import { ChipGroup, type Level } from '@/design'

type SystemStatus = Level | 'untracked'

const statusLabel: Record<SystemStatus, string> = {
  ok: 'ON TARGET',
  watch: 'WATCH',
  act: 'ACT',
  none: 'NO DATA',
  untracked: 'NOT TRACKED',
}

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

const organCenters: Record<string, { x: number; y: number }> = {
  brain: { x: 200, y: 52 },
  eyes: { x: 178, y: 86 },
  ears: { x: 246, y: 90 },
  face: { x: 200, y: 112 },
  heart: { x: 218, y: 232 },
  lungs: { x: 168, y: 236 },
  digestive: { x: 200, y: 330 },
  kidneys: { x: 244, y: 318 },
  spine: { x: 200, y: 392 },
  reproductive: { x: 200, y: 452 },
  bones: { x: 174, y: 560 },
  muscles: { x: 118, y: 262 },
}

const statusToneVar: Record<SystemStatus, string> = {
  ok: 'var(--color-accent)',
  watch: 'var(--color-warn)',
  act: 'var(--color-danger)',
  none: 'var(--color-text-muted)',
  untracked: 'var(--color-text-muted)',
}

export function BodyFigure({ systems, selectedId, onSelect, heartRate }: BodyFigureProps) {
  const organSystems = systems.filter((s) => s.kind === 'organ')
  const wholeBodySystems = systems.filter((s) => s.kind === 'whole-body')

  const heartBpm = heartRate && heartRate > 0 ? heartRate : undefined
  const heartBeatDuration = heartBpm ? 60 / heartBpm : undefined

  const handleKeyDown = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }

  const chipOptions = wholeBodySystems.map((s) => ({
    value: s.id,
    label: `${s.label} · ${statusLabel[s.status]}`,
  }))

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative mx-auto flex w-full max-w-[320px] justify-center">
        <svg
          viewBox="0 0 400 880"
          className="h-auto w-full select-none"
          role="img"
          aria-label="Human body figure with interactive system markers"
        >
          <defs>
            <style>
              {`
                @keyframes heartbeat-pulse {
                  0%, 100% { transform: scale(1); }
                  15% { transform: scale(1.18); }
                  30% { transform: scale(1); }
                  45% { transform: scale(1.12); }
                  60% { transform: scale(1); }
                }
                @keyframes act-slow-pulse {
                  0%, 100% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.15); opacity: 0.8; }
                }
                @media (prefers-reduced-motion: reduce) {
                  .heart-marker-beat,
                  .act-marker-pulse {
                    animation: none !important;
                  }
                }
              `}
            </style>
          </defs>

          {/* Body outline in border token */}
          <g
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Head */}
            <ellipse cx="200" cy="80" rx="36" ry="46" />
            {/* Neck */}
            <path d="M 190 126 L 190 150 M 210 126 L 210 150" />
            {/* Torso */}
            <path d="M 190 150 C 160 150 125 155 115 170 C 110 178 125 210 135 240 C 145 270 148 310 145 350 C 142 390 135 430 130 460 C 160 475 240 475 270 460 C 265 430 258 390 255 350 C 252 310 255 270 265 240 C 275 210 290 178 285 170 C 275 155 240 150 210 150 Z" />
            {/* Left Arm */}
            <path d="M 115 170 C 95 200 85 260 80 320 C 75 370 70 410 65 445 C 65 455 75 458 80 450 C 90 420 100 370 110 320 C 115 285 125 240 135 240" />
            {/* Right Arm */}
            <path d="M 285 170 C 305 200 315 260 320 320 C 325 370 330 410 335 445 C 335 455 325 458 320 450 C 310 420 300 370 290 320 C 285 285 275 240 265 240" />
            {/* Left Leg */}
            <path d="M 130 460 C 135 520 140 600 145 680 C 150 740 150 800 145 840 C 145 850 160 855 168 850 C 175 800 178 740 175 680 C 172 610 170 550 200 495" />
            {/* Right Leg */}
            <path d="M 270 460 C 265 520 260 600 255 680 C 250 740 250 800 255 840 C 255 850 240 855 232 850 C 225 800 222 740 225 680 C 228 610 230 550 200 495" />
          </g>

          {/* Organ Markers */}
          {organSystems.map((sys) => {
            const center = organCenters[sys.id]
            if (!center) return null

            const isSelected = selectedId === sys.id
            const color = statusToneVar[sys.status]
            const isUntracked = sys.status === 'untracked'
            const isHeart = sys.id === 'heart'
            const isAct = sys.status === 'act'

            let animStyle: React.CSSProperties | undefined
            let animClass = ''

            if (isHeart && heartBeatDuration) {
              animClass = 'heart-marker-beat'
              animStyle = {
                transformOrigin: `${center.x}px ${center.y}px`,
                animation: `heartbeat-pulse ${heartBeatDuration}s ease-in-out infinite`,
              }
            } else if (isAct) {
              animClass = 'act-marker-pulse'
              animStyle = {
                transformOrigin: `${center.x}px ${center.y}px`,
                animation: 'act-slow-pulse 2s ease-in-out infinite',
              }
            }

            const accessibleName = `${sys.label}, ${statusLabel[sys.status]}`

            return (
              <g
                key={sys.id}
                role="button"
                tabIndex={0}
                aria-label={accessibleName}
                onClick={() => onSelect(sys.id)}
                onKeyDown={(e) => handleKeyDown(e, sys.id)}
                className={`cursor-pointer outline-none focus-visible:outline-none ${animClass}`}
                style={animStyle}
              >
                {/* Second outer ring when chosen */}
                {isSelected && (
                  <circle
                    cx={center.x}
                    cy={center.y}
                    r={22}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    className="opacity-90"
                  />
                )}

                {/* Focus indicator ring */}
                <circle
                  cx={center.x}
                  cy={center.y}
                  r={isSelected ? 26 : 19}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  className="hidden focus-visible:inline"
                />

                {/* Main marker circle */}
                <circle
                  cx={center.x}
                  cy={center.y}
                  r={isSelected ? 16 : 14}
                  fill={color}
                  fillOpacity={0.25}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={isUntracked ? '4 3' : undefined}
                  className="transition-all duration-150 hover:stroke-[3px]"
                />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Whole-body systems chips */}
      <div className="w-full">
        <ChipGroup
          label="Whole-body systems"
          options={chipOptions}
          selected={selectedId ? [selectedId] : []}
          onChange={(vals) => {
            if (vals[0]) onSelect(vals[0])
          }}
        />
      </div>
    </div>
  )
}
