import { useState } from 'react'
import { Button, ChipGroup, SectionLabel, TextField } from '@/design'
import {
  completeDeviceSetup,
  createProfile,
  setActiveProfile,
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

        <form
          aria-labelledby="device-setup-crew"
          className="flex flex-col gap-4 border-t border-border pt-5"
          onSubmit={(event) => {
            event.preventDefault()
            start()
          }}
        >
          <h2 id="device-setup-crew" className="m-0 text-lg font-semibold text-text">
            I&apos;m on the crew
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
