import { useNavigate } from 'react-router'
import { Button, Card, SectionLabel, Switch } from '@/design'
import {
  setFallDetection,
  setSleepingNow,
  setVitalsWatch,
  simulateAutoAlert,
  useActiveProfile,
  useAutoAlert,
  useRoom,
} from '@/data'
import { LIMITS } from './limits'

/** Whether alerts from here reach other devices. */
export function LinkedDevices() {
  const { code } = useRoom()
  const navigate = useNavigate()
  if (code) {
    return (
      <p className="m-0 rounded-md border border-border bg-surface-raised/40 px-4 py-3 text-sm text-text-secondary">
        Linked to crew room <strong className="font-mono font-semibold text-text">{code}</strong>.
        Alerts reach every device in this room.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-raised/40 px-4 py-3">
      <p className="m-0 text-sm text-text-secondary">
        This device is not linked. Alerts stay on this device.
      </p>
      <Button variant="quiet" onClick={() => navigate('/watch')}>
        Link a device
      </Button>
    </div>
  )
}

/** The two automatic watchers, the sleep switch, and a way to try them. */
export function AutoAlertsCard() {
  const { pending, fallDetection, vitalsWatch, motionAvailable, sleepingNow } = useAutoAlert()
  const profile = useActiveProfile()
  const seconds = LIMITS.countdownSeconds

  const fallHint = motionAvailable
    ? `Uses this device's motion sensor. Starts the countdown after a sudden hard movement, or after ${LIMITS.stillMinutes} minutes with no movement at all while you are awake. An alert is sent if you do not answer within ${seconds} seconds.`
    : 'Not available here: this device has no motion sensor the browser can read, or access to it was refused.'

  const vitalsHint =
    `Starts the same countdown when heart rate stays at ${LIMITS.heartRateHigh} bpm or more, or ` +
    `${LIMITS.heartRateLow} or less, or blood oxygen at ${LIMITS.spo2Low}% or less, for ` +
    `${LIMITS.sustainSeconds} seconds. Limits are for demonstration.` +
    (profile.kind === 'demo' ? ' Simulated readings never send an alert: use "Try it" below.' : '')

  return (
    <Card title="Automatic alerts">
      <div className="flex flex-col gap-5">
        <Switch
          label="Movement check on this device"
          hint={fallHint}
          checked={fallDetection && motionAvailable}
          disabled={!motionAvailable}
          onChange={setFallDetection}
        />
        <Switch
          label="Sleeping now"
          hint={`No movement is expected while you sleep, so it sends no alert. This is always the case from ${LIMITS.awakeUntil} to ${LIMITS.awakeFrom}; turn this on for a nap. It turns itself off at ${LIMITS.awakeFrom}. A sudden hard movement still starts the countdown.`}
          checked={sleepingNow}
          onChange={setSleepingNow}
        />
        <Switch
          label="Watch my vital signs"
          hint={vitalsHint}
          checked={vitalsWatch}
          onChange={setVitalsWatch}
        />

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <SectionLabel as="h3">Try it</SectionLabel>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="quiet"
              disabled={pending !== null}
              onClick={() => simulateAutoAlert('fall')}
            >
              Simulate no movement
            </Button>
            <Button
              variant="quiet"
              disabled={pending !== null}
              onClick={() => simulateAutoAlert('heart-rate')}
            >
              Simulate a heart-rate spike
            </Button>
          </div>
          <p className="m-0 text-sm text-text-muted">
            Starts the same {seconds} second countdown as a real detection. Nothing real is sent.
          </p>
        </div>
      </div>
    </Card>
  )
}
