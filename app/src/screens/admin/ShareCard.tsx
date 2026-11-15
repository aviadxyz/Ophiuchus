import { useState } from 'react'
import { Card, ConfirmDialog, SourceBadge, Switch } from '@/design'
import { setGroundShare, useActiveProfile, useGroundShare } from '@/data'
import { ago, clockTime, SHARE_CONFIRM } from './text'

/** "Send my record to Earth": the active profile's own ground sharing switch. */
export function ShareCard({ now }: { now: number }) {
  const profile = useActiveProfile()
  const share = useGroundShare()
  const [confirming, setConfirming] = useState(false)
  const demo = profile.kind === 'demo'

  return (
    <Card title="Send my record to Earth">
      <div className="flex flex-col gap-4">
        <p className="m-0 max-w-description text-base text-text-secondary">
          The medical team on Earth sees nothing of yours until you switch this on.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          <SourceBadge source={demo ? 'simulated' : 'entered'} />
          <span>
            {demo
              ? 'Simulated demo profile. Nothing from it ever leaves this device.'
              : 'Real crew profile. Your own entries and readings.'}
          </span>
        </div>
        <Switch
          label={`Share ${profile.displayName}'s record with the ground team`}
          checked={share.on}
          onChange={(on) => {
            if (on) setConfirming(true)
            else void setGroundShare(false)
          }}
        />
        <p className="m-0 text-base text-text-secondary" role="status">
          {stateText(share, demo, now)}
        </p>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Share your record with the ground team?"
        message={SHARE_CONFIRM}
        confirmLabel="Share my record"
        cancelLabel="Not now"
        onConfirm={() => {
          setConfirming(false)
          void setGroundShare(true)
        }}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  )
}

function stateText(share: ReturnType<typeof useGroundShare>, demo: boolean, now: number): string {
  if (demo) {
    return share.on
      ? 'Shared on this device only. Your record appears in the simulated crew below.'
      : 'Not shared.'
  }
  const last = share.lastSentAt
    ? ` The last record that arrived was sent at ${clockTime(share.lastSentAt, now)}.`
    : ''
  if (!share.on) {
    if (share.state === 'sending') return 'Deleting your record from the server.'
    if (share.state === 'failed') {
      return 'The server cannot be reached, so your record is not deleted yet. It will be tried again in a minute.'
    }
    return 'Not shared. Nothing of yours is on the server.'
  }
  if (share.state === 'sent' && share.lastSentAt) {
    return `Last sent at ${clockTime(share.lastSentAt, now)}, ${ago(share.lastSentAt, now)}. It is sent again when your record changes, at most once a minute.`
  }
  if (share.state === 'failed') {
    return `The server cannot be reached, so the last send failed. It will be tried again in a minute.${last}`
  }
  return 'Sending your record now.'
}
