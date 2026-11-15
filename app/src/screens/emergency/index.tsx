import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Button,
  Card,
  ChipGroup,
  ProgressRing,
  ScreenHeader,
  StatusPill,
  type Tone,
} from '@/design'
import {
  acknowledgeAlert,
  cancelAlert,
  raiseAlert,
  useAlerts,
  useMission,
  type Alert,
} from '@/data'
import { askMedbot } from '@/ophi'
import { meta } from './meta'

const ISSUE_OPTIONS = ['Medical', 'Injury', 'Mental health', 'Cabin problem']
const HOLD_DURATION_MS = 2000
const CANCEL_WINDOW_MS = 10_000

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return iso
  }
}

function formatDelay(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`
  }
  const mins = Math.round(seconds / 60)
  return `${mins} ${mins === 1 ? 'minute' : 'minutes'}`
}

function statusToneAndLabel(status: Alert['status']): { tone: Tone; label: string } {
  switch (status) {
    case 'open':
      return { tone: 'danger', label: 'OPEN' }
    case 'acknowledged':
      return { tone: 'ok', label: 'ACKNOWLEDGED' }
    case 'cancelled':
      return { tone: 'neutral', label: 'CANCELLED' }
  }
}

export default function EmergencyScreen() {
  const mission = useMission()
  const alerts = useAlerts()

  // Filter only emergency alerts, newest first
  const emergencyAlerts = alerts.filter((a) => a.kind === 'emergency')
  const openAlert = emergencyAlerts.find((a) => a.status === 'open')
  const hasOpenAlert = Boolean(openAlert)

  // Hold-to-send trigger state
  const [selectedIssue, setSelectedIssue] = useState('Medical')
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)

  const holdTimerRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const isHoldingRef = useRef<boolean>(false)

  // Cancel countdown state for open alert raised on console
  const [now, setNow] = useState(() => Date.now())

  const openAlertAt = openAlert?.at
  const openAlertOrigin = openAlert?.origin

  useEffect(() => {
    if (!openAlertAt || openAlertOrigin !== 'console') return
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 250)
    return () => clearInterval(interval)
  }, [openAlertAt, openAlertOrigin])

  const cancelRemainingSec =
    openAlertAt && openAlertOrigin === 'console'
      ? Math.max(0, Math.ceil((new Date(openAlertAt).getTime() + CANCEL_WINDOW_MS - now) / 1000))
      : 0

  const stopHold = useCallback(() => {
    if (holdTimerRef.current !== null) {
      clearInterval(holdTimerRef.current)
      holdTimerRef.current = null
    }
    isHoldingRef.current = false
    setIsHolding(false)
    setHoldProgress(0)
  }, [])

  const startHold = useCallback(() => {
    if (isHoldingRef.current) return
    isHoldingRef.current = true
    setIsHolding(true)
    setHoldProgress(0)
    startTimeRef.current = Date.now()

    holdTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const progress = Math.min(1, elapsed / HOLD_DURATION_MS)
      setHoldProgress(progress)

      if (progress >= 1) {
        if (holdTimerRef.current !== null) {
          clearInterval(holdTimerRef.current)
          holdTimerRef.current = null
        }
        isHoldingRef.current = false
        setIsHolding(false)
        setHoldProgress(0)
        raiseAlert('emergency', 'console', `${selectedIssue} emergency`, 'emergency')
      }
    }, 40)
  }, [selectedIssue])

  // Cleanup hold timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        clearInterval(holdTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={[
          hasOpenAlert
            ? { tone: 'danger', label: 'ALERT OPEN' }
            : { tone: 'neutral', label: 'NO OPEN ALERT' },
        ]}
      />

      {mission.commDelaySeconds > 0 && (
        <div className="rounded-md border border-border bg-surface-raised/40 px-4 py-3 text-sm text-text-secondary">
          <p className="m-0">
            A signal to Earth takes about{' '}
            <strong className="font-semibold text-text">
              {formatDelay(mission.commDelaySeconds)}
            </strong>{' '}
            each way from here. Start the first steps yourself.
          </p>
        </div>
      )}

      {hasOpenAlert && openAlert ? (
        <Card title="Alert sent">
          <div className="flex flex-col gap-5">
            <div className="rounded-md border border-danger/30 bg-danger/10 p-3.5 text-text">
              <p className="m-0 text-sm font-medium text-danger">
                Alert sent at {formatTime(openAlert.at)}
                {openAlert.origin === 'watch' ? ' (from Watch)' : ''}
              </p>
              <p className="m-0 mt-1 text-base font-semibold">Help has been asked for. Do these now:</p>
            </div>

            <ol className="m-0 list-decimal space-y-3.5 pl-6 text-base font-medium text-text">
              <li className="leading-relaxed">Tell the nearest crewmate out loud.</li>
              <li className="leading-relaxed">Stay with the person. Do not leave them alone.</li>
              <li className="leading-relaxed">Get the medical kit and follow its checklist.</li>
              <li className="leading-relaxed">Note the time and what happened, for the flight surgeon.</li>
            </ol>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {openAlert.origin === 'console' && cancelRemainingSec > 0 && (
                <Button
                  variant="quiet"
                  size="md"
                  onClick={() => cancelAlert(openAlert.id)}
                  aria-label="Cancel alert"
                >
                  Cancel ({cancelRemainingSec}s)
                </Button>
              )}
              <Button
                variant="quiet"
                size="md"
                onClick={() => askMedbot('emergency')}
              >
                Talk to the Med bot
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card title="What is wrong?">
          <div className="flex flex-col gap-6">
            <div>
              <p className="m-0 mb-2.5 text-xs font-mono uppercase tracking-wider text-text-muted">
                Choose the kind of emergency
              </p>
              <ChipGroup
                options={ISSUE_OPTIONS}
                selected={[selectedIssue]}
                onChange={(vals) => {
                  if (vals[0]) setSelectedIssue(vals[0])
                }}
              />
            </div>

            <div className="flex flex-col items-center justify-center py-4">
              <button
                type="button"
                aria-label="Hold to send alert"
                onPointerDown={(e) => {
                  if (e.button === 0) startHold()
                }}
                onPointerUp={stopHold}
                onPointerCancel={stopHold}
                onPointerLeave={stopHold}
                onKeyDown={(e) => {
                  if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                    e.preventDefault()
                    startHold()
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    stopHold()
                  }
                }}
                onBlur={stopHold}
                className="group relative inline-flex cursor-pointer items-center justify-center rounded-full touch-none select-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4"
              >
                <ProgressRing
                  value={holdProgress}
                  tone="danger"
                  size={160}
                  label="Hold to send alert"
                >
                  <span className="max-w-[110px] text-center text-sm font-semibold uppercase tracking-wide text-text leading-tight group-hover:text-danger transition-colors">
                    {isHolding ? 'Holding...' : 'Hold to send alert'}
                  </span>
                </ProgressRing>
              </button>
              <p className="mt-3.5 m-0 text-sm text-text-secondary text-center">
                Hold for two seconds. Let go to cancel.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card title="Alerts">
        {emergencyAlerts.length === 0 ? (
          <p className="m-0 text-sm text-text-muted">No alerts yet.</p>
        ) : (
          <ul className="m-0 list-none p-0 divide-y divide-border" aria-label="Alerts list">
            {emergencyAlerts.map((alert) => {
              const { tone, label } = statusToneAndLabel(alert.status)
              const isConsole = alert.origin === 'console'

              return (
                <li
                  key={alert.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-text-muted">
                        {formatTime(alert.at)}
                      </span>
                      <span className="text-xs font-medium text-text-secondary">
                        {isConsole ? 'This console' : 'Watch'}
                      </span>
                      <StatusPill tone={tone} label={label} />
                    </div>
                    <p className="m-0 text-base font-semibold text-text break-words">
                      {alert.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {alert.status === 'open' && (
                      <Button
                        variant="quiet"
                        size="md"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <footer className="mt-2 text-center text-xs text-text-muted">
        Demonstration. No real alert is sent to anyone. In a real emergency, call your local
        emergency number.
      </footer>
    </div>
  )
}
