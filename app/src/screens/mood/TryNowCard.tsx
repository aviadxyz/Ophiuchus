import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, DetailDrawer } from '@/design'
import { askMedbot } from '@/ophi'

type BreatheExerciseProps = {
  onDone: () => void
  reducedMotion: boolean
}

function BreatheExercise({ onDone, reducedMotion }: BreatheExerciseProps) {
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [isRunning, setIsRunning] = useState(true)

  useEffect(() => {
    if (!isRunning || secondsLeft <= 0) return

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, secondsLeft])

  // Breathing cycle: 4 seconds in (0..3), 6 seconds out (4..9)
  const elapsed = 60 - secondsLeft
  const cycleSecond = elapsed % 10
  const isInhale = cycleSecond < 4
  const phaseWord = isInhale ? 'Breathe in' : 'Breathe out'

  const handleRestart = () => {
    setSecondsLeft(60)
    setIsRunning(true)
  }

  return (
    <div className="flex flex-col items-center justify-between gap-8 py-4 text-center">
      <p className="m-0 text-base text-text-secondary">
        Follow the circle: slow inhale for 4 seconds, gentle exhale for 6.
      </p>

      {/* Animated Circle Container */}
      <div className="relative flex size-60 items-center justify-center">
        {/* Background guide ring */}
        <div className="absolute inset-0 rounded-full border border-border/50" />

        {/* Breathing Circle */}
        <div
          className={[
            'flex size-36 items-center justify-center rounded-full bg-accent/20 border-2 border-accent text-accent',
            reducedMotion
              ? 'scale-100 transition-none'
              : isInhale
                ? 'scale-135 transition-transform duration-[4000ms] ease-in-out'
                : 'scale-85 transition-transform duration-[6000ms] ease-in-out',
          ].join(' ')}
          aria-live="polite"
        >
          <span className="text-lg font-semibold select-none text-text">
            {secondsLeft > 0 ? phaseWord : 'Complete'}
          </span>
        </div>
      </div>

      {/* Countdown timer and controls */}
      <div className="flex flex-col items-center gap-3">
        <p className="m-0 font-mono text-3xl font-semibold text-text tabular-nums">
          0:{secondsLeft.toString().padStart(2, '0')}
        </p>
        <p className="m-0 text-xs text-text-muted">
          {secondsLeft > 0
            ? isRunning
              ? '60-second exercise in progress'
              : 'Paused'
            : '60 seconds complete. Notice how your body feels.'}
        </p>

        <div className="flex items-center gap-2 pt-2">
          {secondsLeft > 0 ? (
            <Button variant="quiet" onClick={() => setIsRunning(!isRunning)}>
              {isRunning ? 'Pause' : 'Resume'}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleRestart}>
              Start again
            </Button>
          )}
          <Button variant="quiet" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

export function TryNowCard() {
  const navigate = useNavigate()
  const [breatheOpen, setBreatheOpen] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  // Listen for prefers-reduced-motion changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])

  return (
    <>
      <Card title="Try now">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="quiet" onClick={() => setBreatheOpen(true)}>
            Breathe for a minute
          </Button>
          <Button variant="quiet" onClick={() => navigate('/social')}>
            Message home
          </Button>
          <Button variant="quiet" onClick={() => askMedbot('mood')}>
            Talk to the Med bot
          </Button>
        </div>
      </Card>

      <DetailDrawer
        open={breatheOpen}
        title="Breathe for a minute"
        onClose={() => setBreatheOpen(false)}
      >
        {breatheOpen && (
          <BreatheExercise
            onDone={() => setBreatheOpen(false)}
            reducedMotion={reducedMotion}
          />
        )}
      </DetailDrawer>
    </>
  )
}
