import { useState } from 'react'
import { Button, Card, Switch, TextField } from '@/design'
import { joinSocial, useActiveProfile, type JoinResult } from '@/data'

const REASONS: Record<Exclude<JoinResult, 'ok'>, string> = {
  taken: 'That handle is already taken. Try another one.',
  invalid: 'Use 3 to 20 letters, digits or underscores, with no spaces.',
  offline: 'The crew network cannot be reached right now. Try again later.',
}

export function JoinCard() {
  const profile = useActiveProfile()
  // A team member joins under their first name, and is friends with the rest of the team at once.
  const onTeam = profile.id.startsWith('crew-')
  const [handle, setHandle] = useState(onTeam ? profile.displayName.toLowerCase() : '')
  const [shareMood, setShareMood] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [joining, setJoining] = useState(false)

  const join = async () => {
    setJoining(true)
    const result = await joinSocial(handle, shareMood)
    setJoining(false)
    setError(result === 'ok' ? undefined : REASONS[result])
  }

  return (
    <Card title="Join the crew network">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void join()
        }}
      >
        <TextField
          label="Your handle"
          value={handle}
          onChange={(value) => {
            setHandle(value)
            setError(undefined)
          }}
          hint="3 to 20 letters, digits or underscores. This is the only name other people see."
          error={error}
          maxLength={20}
          autoComplete="off"
        />
        <p className="m-0 text-base text-text-secondary">
          Friends see your handle, your role and, if you allow it, your mood. Your notes, readings
          and health data never leave this device.
        </p>
        <Switch label="Share my mood with friends" checked={shareMood} onChange={setShareMood} />
        <div>
          <Button type="submit" size="lg" disabled={joining || handle.trim().length === 0}>
            Join the crew network
          </Button>
        </div>
      </form>
    </Card>
  )
}
