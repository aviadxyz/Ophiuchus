import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  ArrowLeft,
  Moon,
  Play,
  RotateCcw,
  Smartphone,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Button, Card, ProgressBar, SourceLine, StatusPill } from '@/design'
import {
  isDeviceFlat,
  PhoneDownTracker,
  ROUND_DURATION_SECONDS,
  spawnSheep,
  updateSheep,
  type Sheep,
} from './gameLogic'
import { meta } from './meta'
import { sheepAudio } from './sound'
import { SpaceScene } from './SpaceScene'

type GamePhase = 'start' | 'playing' | 'result'

export default function CountingSheepGame() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<GamePhase>('start')
  const [sheepCount, setSheepCount] = useState<number>(0)
  const [timeLeft, setTimeLeft] = useState<number>(ROUND_DURATION_SECONDS)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [isPhoneDown, setIsPhoneDown] = useState<boolean>(false)
  const [simulatedPhoneDown, setSimulatedPhoneDown] = useState<boolean>(false)
  const [sheepList, setSheepList] = useState<Sheep[]>([])

  // Animation & simulation refs
  const nextSheepIndexRef = useRef<number>(0)
  const lastSpawnTimeRef = useRef<number>(0)
  const lastFrameTimeRef = useRef<number>(0)
  const animFrameIdRef = useRef<number | null>(null)
  const trackerRef = useRef<PhoneDownTracker>(new PhoneDownTracker(1000))
  const phoneDownTriggeredRef = useRef<boolean>(false)
  const isPausedRef = useRef<boolean>(false)

  // Stop sounds and timers on unmount or tab switch
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        isPausedRef.current = true
        sheepAudio.pause()
      } else {
        isPausedRef.current = false
        sheepAudio.resume()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current)
      }
      sheepAudio.pause()
    }
  }, [])

  // Mobile DeviceOrientation listener for "phone put down" detection
  useEffect(() => {
    if (phase !== 'playing') return

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const flat = isDeviceFlat(event.beta, event.gamma)
      setIsPhoneDown(flat)
    }

    window.addEventListener('deviceorientation', handleOrientation)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [phase])

  // Start the game loop when playing
  useEffect(() => {
    if (phase !== 'playing') return

    phoneDownTriggeredRef.current = false
    trackerRef.current.reset()
    lastFrameTimeRef.current = performance.now()
    lastSpawnTimeRef.current = performance.now()

    // Spawn first sheep immediately
    const firstSheep = spawnSheep(nextSheepIndexRef.current++)
    setSheepList([firstSheep])

    const loop = (now: number) => {
      const deltaSec = Math.min(0.1, (now - lastFrameTimeRef.current) / 1000)
      lastFrameTimeRef.current = now

      // Check phone down tracker
      const flatActive = isPhoneDown || simulatedPhoneDown
      const isConfirmedDown = trackerRef.current.update(flatActive, deltaSec * 1000)

      if (isConfirmedDown && !phoneDownTriggeredRef.current) {
        phoneDownTriggeredRef.current = true
        // Allow brief visual feedback, then transition to result
        setTimeout(() => {
          setPhase('result')
        }, 600)
      }

      // Check round timer
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - deltaSec)
        if (next <= 0 && !phoneDownTriggeredRef.current) {
          phoneDownTriggeredRef.current = true
          setTimeout(() => {
            setPhase('result')
          }, 400)
        }
        return next
      })

      // Spawn new sheep every ~3.5 seconds if phone is not down
      if (!flatActive && now - lastSpawnTimeRef.current >= 3500) {
        lastSpawnTimeRef.current = now
        const newSheep = spawnSheep(nextSheepIndexRef.current++)
        setSheepList((prev) => [...prev, newSheep])
      }

      // Update all active sheep
      setSheepList((prev) => {
        const nextList: Sheep[] = []
        let enteredCount = 0

        for (const s of prev) {
          const { justEntered, shouldRemove } = updateSheep(s, deltaSec, isPausedRef.current)
          if (justEntered) {
            enteredCount++
            sheepAudio.playBleat()
          }
          if (!shouldRemove) {
            nextList.push({ ...s })
          }
        }

        if (enteredCount > 0) {
          setSheepCount((c) => c + enteredCount)
        }
        return nextList
      })

      animFrameIdRef.current = requestAnimationFrame(loop)
    }

    animFrameIdRef.current = requestAnimationFrame(loop)

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current)
        animFrameIdRef.current = null
      }
    }
  }, [phase, isPhoneDown, simulatedPhoneDown])

  const handleStart = () => {
    setSheepCount(0)
    setTimeLeft(ROUND_DURATION_SECONDS)
    setIsPhoneDown(false)
    setSimulatedPhoneDown(false)
    nextSheepIndexRef.current = 0
    setPhase('playing')
  }

  const handleToggleMute = () => {
    const muted = sheepAudio.toggleMute()
    setIsMuted(muted)
  }

  const handleSheepClick = () => {
    // Interactive gentle bounce boost on tap
    sheepAudio.playBleat()
  }

  return (
    <div className="flex flex-1 flex-col p-page-phone sm:p-page max-w-5xl mx-auto w-full">
      {phase === 'start' && (
        <div className="flex flex-col items-center justify-center my-auto py-8">
          <Card>
            <div className="flex flex-col items-center text-center max-w-md mx-auto py-4">
              <div className="p-3 mb-4 rounded-full border border-border bg-surface-raised text-accent">
                <Moon aria-hidden="true" className="size-8" />
              </div>

              <h2 className="text-xl font-bold text-text mb-2">{meta.label}</h2>

              <p className="text-base text-text-secondary mb-3">
                Count space sheep jumping between asteroids in microgravity to wind down for sleep.
              </p>

              <p className="text-sm text-text-muted mb-6">
                Calm rhythmic focus eases cognitive arousal and settles respiration in orbital crew
                quarters.
              </p>

              <div className="flex items-center gap-2 mb-6">
                <StatusPill tone="info" label="75s Wind-down" />
                <StatusPill tone="neutral" label="Microgravity Physics" />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <Button
                  variant="primary"
                  size="lg"
                  icon={Play}
                  onClick={handleStart}
                >
                  Start Counting
                </Button>

                <Button
                  variant="quiet"
                  size="lg"
                  icon={isMuted ? VolumeX : Volume2}
                  onClick={handleToggleMute}
                  aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
                >
                  {isMuted ? 'Muted' : 'Sound on'}
                </Button>
              </div>

              <div className="mt-6 flex items-center gap-2 text-xs text-text-muted">
                <Smartphone aria-hidden="true" className="size-4 shrink-0 text-accent" />
                <span>Putting your phone flat down on your bed will stop the counter.</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {phase === 'playing' && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          {/* Top Game Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase font-mono tracking-wide text-text-muted">
                Sheep Counted
              </span>
              <span className="text-number font-bold text-accent font-mono">
                {sheepCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <StatusPill
                tone={isPhoneDown || simulatedPhoneDown ? 'ok' : 'neutral'}
                label={isPhoneDown || simulatedPhoneDown ? 'Phone resting' : 'In hand'}
              />

              <Button
                variant="quiet"
                size="md"
                icon={isMuted ? VolumeX : Volume2}
                onClick={handleToggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              />

              <Button
                variant={simulatedPhoneDown ? 'primary' : 'quiet'}
                size="md"
                icon={Smartphone}
                onClick={() => setSimulatedPhoneDown((p) => !p)}
                aria-label="Simulate putting phone down"
              >
                {simulatedPhoneDown ? 'Device down' : 'Put phone down'}
              </Button>
            </div>
          </div>

          {/* Time Progress Bar */}
          <div className="w-full">
            <ProgressBar
              value={timeLeft / ROUND_DURATION_SECONDS}
              tone="info"
              label={`Time remaining (${Math.ceil(timeLeft)}s)`}
            />
          </div>

          {/* Main Space Simulation Scene */}
          <div className="flex-1 flex items-center justify-center min-h-0 py-1">
            <SpaceScene sheepList={sheepList} onSheepClick={handleSheepClick} />
          </div>

          {/* Bottom helper guidance */}
          <div className="flex items-center justify-between text-xs text-text-muted px-1">
            <span>Tap sheep for a gentle microgravity float.</span>
            <span>Lie phone flat when ready to sleep.</span>
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div className="flex flex-col items-center justify-center my-auto py-8">
          <Card>
            <div className="flex flex-col items-center text-center max-w-md mx-auto py-4">
              <div className="p-3 mb-4 rounded-full border border-border bg-surface-raised text-accent">
                <Sparkles aria-hidden="true" className="size-8" />
              </div>

              <StatusPill tone="ok" label="Rest Ready" />

              <h2 className="text-xl font-bold text-text mt-3 mb-1">
                {sheepCount} {sheepCount === 1 ? 'Sheep' : 'Sheep'} Counted
              </h2>

              <p className="text-base text-text-secondary mb-4">
                Your device is resting and your focus is calm. Rest well in microgravity, astronaut.
              </p>

              <div className="mb-6 w-full p-3 rounded-md bg-surface-raised border border-border text-left">
                <p className="text-sm text-text-secondary m-0">
                  Repetitive rhythmic counting facilitates the transition to restorative slow-wave
                  sleep during high-tempo spaceflight.
                </p>
                <SourceLine text="" />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <Button
                  variant="primary"
                  size="lg"
                  icon={RotateCcw}
                  onClick={handleStart}
                >
                  Count Again
                </Button>

                <Button
                  variant="quiet"
                  size="lg"
                  icon={ArrowLeft}
                  onClick={() => navigate('/sleep')}
                >
                  Back to Sleep
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
