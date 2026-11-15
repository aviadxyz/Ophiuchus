import { useState } from 'react'
import { Button, ChipGroup, SectionLabel, Switch, TextField } from '@/design'
import {
  completeDeviceSetup,
  createProfile,
  setActiveProfile,
  updateProfile,
  useDevice,
  useProfiles,
} from '@/data'

const CREW_ROLES = [
  'Commander',
  'Pilot',
  'Flight engineer',
  'Mission specialist',
  'Flight surgeon',
] as const

/** The first-open choice of who is using this device. Shown instead of the console until made. */
export function DeviceSetup() {
  const profiles = useProfiles()
  const { kind } = useDevice()
  const [name, setName] = useState('')
  const [role, setRole] = useState<string[]>([])
  const ready = name.trim().length > 0 && role.length === 1
  // The team's own profiles exist on every device. They start empty and fill with live data.
  const team = profiles.filter((profile) => profile.kind === 'member' && profile.id.startsWith('crew-'))
  const [member, setMember] = useState<string[]>([])
  const [shareWithCrew, setShareWithCrew] = useState(true)
  const [shareWithMedbot, setShareWithMedbot] = useState(true)

  const startAsMember = () => {
    const id = member[0]
    if (!id) return
    updateProfile(id, { consent: { relay: shareWithCrew, assistant: shareWithMedbot } })
    setActiveProfile(id)
    completeDeviceSetup()
  }

  const chooseDemo = () => {
    const demo = profiles.find((profile) => profile.kind === 'demo')
    if (demo) setActiveProfile(demo.id)
    completeDeviceSetup()
  }

  const start = () => {
    if (!ready) return
    const id = createProfile({ displayName: name.trim(), role: role[0] })
    setActiveProfile(id)
    completeDeviceSetup()
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-bg py-4 sm:items-center sm:px-page sm:py-8">
      <main
        id="main"
        aria-labelledby="device-setup-title"
        className="flex w-full max-w-dialog flex-col gap-6 bg-surface p-page-phone sm:rounded-lg sm:border sm:border-border sm:p-card"
      >
        <div className="flex flex-col gap-2">
          <SectionLabel>Ophiuchus</SectionLabel>
          <h1 id="device-setup-title" className="m-0 text-title font-semibold text-text">
            Who is using this device?
          </h1>
        </div>

        <div className="flex flex-col">
          <Button size={kind === 'phone' ? 'md' : 'lg'} onClick={chooseDemo}>
            Look around with the demo crew member
          </Button>
        </div>

        {team.length > 0 && (
          <section
            aria-labelledby="device-setup-team"
            className="flex flex-col gap-4 border-t border-border pt-5"
          >
            <h2 id="device-setup-team" className="m-0 text-lg font-semibold text-text">
              I&apos;m on the team
            </h2>
            <ChipGroup
              label="Team member"
              options={team.map((profile) => ({ value: profile.id, label: profile.displayName }))}
              selected={member}
              onChange={setMember}
            />
            {member.length === 1 && (
              <>
                <p className="m-0 text-sm text-text-secondary">
                  Your profile starts empty and fills with what this device records. Nothing is
                  simulated.
                </p>
                <Switch
                  label="Share my alerts and live readings with the crew's devices"
                  checked={shareWithCrew}
                  onChange={setShareWithCrew}
                  hint="Needed for an emergency on this device to show on the others."
                />
                <Switch
                  label="Let the Med bot see my summary"
                  checked={shareWithMedbot}
                  onChange={setShareWithMedbot}
                  hint="Mood notes are never included."
                />
                <div>
                  <Button onClick={startAsMember}>Start as my profile</Button>
                </div>
              </>
            )}
          </section>
        )}

        <form
          aria-labelledby="device-setup-crew"
          className="flex flex-col gap-4 border-t border-border pt-5"
          onSubmit={(event) => {
            event.preventDefault()
            start()
          }}
        >
          <h2 id="device-setup-crew" className="m-0 text-lg font-semibold text-text">
            Someone else on the crew
          </h2>
          <TextField
            label="Display name"
            value={name}
            onChange={setName}
            maxLength={40}
            autoComplete="off"
            hint="Stays on this device. It is never sent anywhere."
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Role</span>
            <ChipGroup label="Role" options={[...CREW_ROLES]} selected={role} onChange={setRole} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="quiet" disabled={!ready}>
              Start
            </Button>
            {!ready && (
              <span className="text-xs text-text-muted">
                Enter a name and pick a role to start.
              </span>
            )}
          </div>
        </form>

        <p className="m-0 text-xs text-text-muted">Demonstration. Not a medical device.</p>
      </main>
    </div>
  )
}
