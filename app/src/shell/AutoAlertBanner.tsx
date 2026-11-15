import { useEffect, useId, useRef } from 'react'
import { cancelAutoAlert, useAutoAlert } from '@/data'
import { ProgressRing } from '@/design'

const COUNTDOWN_SECONDS = 10

const DETECTED: Record<'fall' | 'heart-rate' | 'oxygen', string> = {
  fall: 'A fall was detected',
  'heart-rate': 'Heart rate far out of range for 20 seconds',
  oxygen: 'Blood oxygen low for 20 seconds',
}

/** The automatic-alert countdown, above the content on every screen, with one way out. */
export function AutoAlertBanner() {
  const { pending } = useAutoAlert()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const textId = useId()
  const showing = pending !== null

  useEffect(() => {
    if (showing) buttonRef.current?.focus()
  }, [showing])

  if (!pending) return null
  const seconds = pending.secondsLeft
  return (
    <div
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={textId}
      className="mb-6 flex flex-col items-stretch gap-4 rounded-lg border border-emergency/35 bg-emergency/12 p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <ProgressRing
          value={seconds / COUNTDOWN_SECONDS}
          tone="danger"
          size={72}
          label="Seconds left before the alert is sent"
        >
          <span className="font-mono text-2xl font-semibold text-text">{seconds}</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="m-0 font-mono text-label font-medium uppercase tracking-wider text-emergency">
            Automatic alert
          </p>
          <p id={titleId} className="m-0 text-lg font-semibold break-words text-text">
            {DETECTED[pending.cause]}
          </p>
          <p id={textId} className="m-0 text-base break-words text-text-secondary">
            An emergency alert is sent in {seconds} {seconds === 1 ? 'second' : 'seconds'} unless
            you answer.
          </p>
        </div>
      </div>
      <button
        ref={buttonRef}
        type="button"
        onClick={cancelAutoAlert}
        className="inline-flex min-h-14 shrink-0 cursor-pointer items-center justify-center rounded-md bg-emergency px-6 text-lg font-semibold text-bg select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
      >
        I'm OK, cancel
      </button>
    </div>
  )
}
