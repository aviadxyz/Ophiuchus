import { useState, useRef, useEffect, useCallback } from 'react'
import { cancelAlert, raiseAlert, useAlerts } from '@/data'
import { ProgressRing } from '@/design'

const HOLD_DURATION_MS = 2000

export function EmergencyPage() {
  const alerts = useAlerts()

  const [isHolding, setIsHolding] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null)
  const [sentTime, setSentTime] = useState<string>('')
  const [cancelRemaining, setCancelRemaining] = useState<number>(10)

  const startTimeRef = useRef<number | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isHeldRef = useRef(false)
  const acknowledgedVibratedRef = useRef(false)

  // Vibrate helper
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern)
      } catch {
        // ignore
      }
    }
  }

  // Derive alert status without calling setState in an effect
  const targetAlert = activeAlertId ? alerts.find((a) => a.id === activeAlertId) : undefined
  const isAcknowledged = targetAlert?.status === 'acknowledged'
  const isCancelled = targetAlert?.status === 'cancelled'

  let phase: 'idle' | 'holding' | 'sent' | 'acknowledged' = 'idle'
  if (isHolding) {
    phase = 'holding'
  } else if (activeAlertId && !isCancelled) {
    phase = isAcknowledged ? 'acknowledged' : 'sent'
  }

  // Trigger alert creation
  const handleAlertCompleted = useCallback(() => {
    isHeldRef.current = false
    startTimeRef.current = null
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }

    const id = raiseAlert('emergency', 'watch', 'Emergency from watch')
    setActiveAlertId(id)
    const now = new Date()
    setSentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    setIsHolding(false)
    setHoldProgress(0)
    setCancelRemaining(10)
    vibrate([200, 100, 200])

    if (cancelTimerRef.current) clearInterval(cancelTimerRef.current)
    const startCount = Date.now()
    cancelTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startCount) / 1000)
      const left = Math.max(0, 10 - elapsed)
      setCancelRemaining(left)
      if (left <= 0 && cancelTimerRef.current) {
        clearInterval(cancelTimerRef.current)
        cancelTimerRef.current = null
      }
    }, 500)
  }, [])

  // Start hold
  const startHold = useCallback(() => {
    if (phase !== 'idle') return
    if (isHeldRef.current) return
    isHeldRef.current = true
    setIsHolding(true)
    setHoldProgress(0)
    startTimeRef.current = performance.now()

    holdTimerRef.current = setTimeout(() => {
      handleAlertCompleted()
    }, HOLD_DURATION_MS)

    const step = (now: number) => {
      if (!isHeldRef.current || startTimeRef.current === null) return
      const elapsed = now - startTimeRef.current
      const progress = Math.min(1, elapsed / HOLD_DURATION_MS)
      setHoldProgress(progress)

      if (elapsed < HOLD_DURATION_MS) {
        animFrameRef.current = requestAnimationFrame(step)
      }
    }

    animFrameRef.current = requestAnimationFrame(step)
  }, [phase, handleAlertCompleted])

  // Release early
  const releaseHold = useCallback(() => {
    if (!isHeldRef.current) return
    isHeldRef.current = false
    startTimeRef.current = null
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    setIsHolding(false)
    setHoldProgress(0)
  }, [])

  // Cancel sent alert
  const handleCancelAlert = () => {
    if (activeAlertId) {
      cancelAlert(activeAlertId)
    }
    if (cancelTimerRef.current) {
      clearInterval(cancelTimerRef.current)
      cancelTimerRef.current = null
    }
    setActiveAlertId(null)
    setHoldProgress(0)
  }

  // Vibration side-effect on acknowledgement
  useEffect(() => {
    if (isAcknowledged && !acknowledgedVibratedRef.current) {
      acknowledgedVibratedRef.current = true
      vibrate([300, 150, 300])
    }
  }, [isAcknowledged])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current)
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current)
      if (cancelTimerRef.current !== null) clearInterval(cancelTimerRef.current)
    }
  }, [])

  return (
    <div className="flex size-full flex-col items-center justify-between py-2 text-center select-none">
      {/* Top Header */}
      <div className="pt-1">
        <span className="font-semibold text-xs tracking-wider uppercase text-danger">
          Emergency
        </span>
      </div>

      {/* Main Action / Status Area */}
      <div className="flex flex-1 flex-col items-center justify-center w-full px-2">
        {phase === 'acknowledged' ? (
          <div className="flex flex-col items-center gap-1.5">
            <span className="size-3 rounded-full bg-accent animate-ping" />
            <span className="text-sm font-bold text-accent">Help is on the way</span>
            <span className="text-[11px] text-text-secondary">Console acknowledged</span>
          </div>
        ) : phase === 'sent' ? (
          <div
            data-testid="sent-container"
            data-alert-id={activeAlertId ?? ''}
            className="flex flex-col items-center gap-2"
          >
            <div className="flex flex-col items-center">
              <span className="text-sm font-bold text-danger">Alert sent</span>
              <span className="font-mono text-xs text-text-muted">{sentTime}</span>
            </div>

            {cancelRemaining > 0 && (
              <button
                type="button"
                onClick={handleCancelAlert}
                className="cursor-pointer rounded-full border border-danger/60 bg-danger/10 px-3 py-1 text-xs font-semibold text-danger hover:bg-danger/20 active:scale-95 transition-all"
              >
                Cancel ({cancelRemaining}s)
              </button>
            )}
          </div>
        ) : (
          <div className="relative flex items-center justify-center">
            {/* Hold progress ring overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center scale-110">
              <ProgressRing
                size={88}
                value={holdProgress}
                tone="danger"
              />
            </div>

            {/* Hold button */}
            <button
              type="button"
              data-testid="emergency-btn"
              onPointerDown={startHold}
              onPointerUp={releaseHold}
              onPointerLeave={releaseHold}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  startHold()
                }
              }}
              onKeyUp={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  releaseHold()
                }
              }}
              aria-label="Hold for 2 seconds to call emergency"
              className={`flex size-20 cursor-pointer items-center justify-center rounded-full bg-danger font-bold text-xs uppercase tracking-wider text-bg shadow-lg transition-transform active:scale-95 focus:outline-none ${
                phase === 'holding' ? 'scale-95 ring-2 ring-danger/40 ring-offset-2 ring-offset-bg' : ''
              }`}
            >
              {phase === 'holding' ? 'Holding...' : 'SOS'}
            </button>
          </div>
        )}
      </div>

      {/* Footer Disclaimer */}
      <div className="flex flex-col items-center pb-1">
        <span className="text-[10px] text-text-muted">
          Demo. No real alert is sent.
        </span>
      </div>
    </div>
  )
}
