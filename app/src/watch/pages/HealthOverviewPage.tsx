import { useState, useEffect, useRef } from 'react'
import { useHealthSummary, useLatestVitals } from '@/data'
import { ProgressRing, SourceBadge, levelTone, type Level } from '@/design'

function levelValue(level: Level): number {
  switch (level) {
    case 'ok':
      return 1
    case 'watch':
      return 0.7
    case 'act':
      return 0.4
    case 'none':
    default:
      return 0.05
  }
}

export function HealthOverviewPage() {
  const { latest, connection } = useLatestVitals()
  const summary = useHealthSummary()

  const [activeArea, setActiveArea] = useState<'sleep' | 'exercise' | 'mood' | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleRingTap = (area: 'sleep' | 'exercise' | 'mood') => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setActiveArea(area)
    timerRef.current = setTimeout(() => {
      setActiveArea(null)
      timerRef.current = undefined
    }, 5000)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const lineText = activeArea ? summary[activeArea].text : summary.ophiLine

  const hasSensor = connection !== 'off' && latest && typeof latest.heartRate === 'number'

  return (
    <div className="flex size-full flex-col items-center justify-between py-2 text-center select-none">
      {/* Top: Heart Rate Section */}
      <div className="flex flex-col items-center pt-1">
        {hasSensor ? (
          <div className="flex flex-col items-center">
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl font-bold tracking-tight text-text">
                {latest.heartRate}
              </span>
              <span className="font-mono text-xs uppercase text-text-muted">bpm</span>
            </div>
            <div className="mt-0.5">
              <SourceBadge source={latest.source ?? 'live'} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-1">
            <span className="text-sm font-medium text-text-muted">No sensor</span>
          </div>
        )}
      </div>

      {/* Center: Three Health Rings */}
      <div className="flex items-center justify-center gap-2 px-1">
        {/* Sleep Ring */}
        <button
          type="button"
          onClick={() => handleRingTap('sleep')}
          aria-label={`Sleep: ${summary.sleep.text}`}
          className="flex flex-col items-center rounded-full p-1 transition-transform active:scale-95 cursor-pointer focus:outline-none"
        >
          <ProgressRing
            size={46}
            value={levelValue(summary.sleep.level)}
            tone={levelTone[summary.sleep.level]}
          >
            <span className="text-[10px] font-semibold text-text uppercase">Sleep</span>
          </ProgressRing>
        </button>

        {/* Exercise Ring */}
        <button
          type="button"
          onClick={() => handleRingTap('exercise')}
          aria-label={`Exercise: ${summary.exercise.text}`}
          className="flex flex-col items-center rounded-full p-1 transition-transform active:scale-95 cursor-pointer focus:outline-none"
        >
          <ProgressRing
            size={46}
            value={levelValue(summary.exercise.level)}
            tone={levelTone[summary.exercise.level]}
          >
            <span className="text-[10px] font-semibold text-text uppercase">Move</span>
          </ProgressRing>
        </button>

        {/* Mood Ring */}
        <button
          type="button"
          onClick={() => handleRingTap('mood')}
          aria-label={`Mood: ${summary.mood.text}`}
          className="flex flex-col items-center rounded-full p-1 transition-transform active:scale-95 cursor-pointer focus:outline-none"
        >
          <ProgressRing
            size={46}
            value={levelValue(summary.mood.level)}
            tone={levelTone[summary.mood.level]}
          >
            <span className="text-[10px] font-semibold text-text uppercase">Mood</span>
          </ProgressRing>
        </button>
      </div>

      {/* Bottom: Ophi line / 5-second detail text */}
      <div className="flex h-10 w-full items-center justify-center px-4 pb-1">
        <p className="m-0 text-xs leading-snug line-clamp-2 text-text-secondary">
          {lineText}
        </p>
      </div>
    </div>
  )
}
