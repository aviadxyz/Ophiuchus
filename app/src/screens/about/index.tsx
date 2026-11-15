import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Card, ConfirmDialog, ScreenHeader, SectionLabel, StatusPill } from '@/design'
import {
  deleteProfileData,
  resetDemoProfile,
  setActiveProfile,
  useActiveProfile,
  useMission,
  useProfiles,
} from '@/data'
import { AddProfileForm } from './AddProfileForm'
import { meta } from './meta'

/** The build time written into the build, or the time the page was last modified when none is set. */
function buildTime(): string {
  const stamped = (import.meta.env as Record<string, string | undefined>).VITE_BUILD_TIME
  const date = new Date(stamped || document.lastModified)
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

const honestStatements = [
  'The crew are the team members who built this project.',
  'Sensor readings are real where the badge says LIVE. Everything marked SIMULATED is made up for the demo.',
  'The mission, Ophiuchus-1, is a scenario.',
  'Consumer watches are not medical devices, and their readings can be wrong.',
  'Ophiuchus is not a medical device. It does not diagnose. For any decision, talk to the flight surgeon.',
]

export default function AboutScreen() {
  const active = useActiveProfile()
  const profiles = useProfiles()
  const mission = useMission()
  const [adding, setAdding] = useState(false)
  const [confirming, setConfirming] = useState<'delete' | 'reset' | null>(null)

  return (
    <>
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={[
          { tone: 'neutral', label: `MISSION DAY ${mission.day}` },
          {
            tone: active.kind === 'demo' ? 'info' : 'ok',
            label: active.kind === 'demo' ? 'DEMO PROFILE' : 'CREW PROFILE',
          },
        ]}
      />

      <div className="flex flex-col gap-6">
        <Card title="What Ophiuchus is">
          <p className="m-0 max-w-description">
            Ophiuchus is a health console for astronauts. It turns sleep, food, water, exercise and
            mood into plain indicators, explains why each one matters in space, and says what to do
            next and when to tell the flight surgeon.
          </p>
        </Card>

        <Card title="What is real and what is not">
          <ul className="m-0 flex list-disc flex-col gap-2 pl-5">
            {honestStatements.map((text) => (
              <li key={text}>{text}</li>
            ))}
            <li>AI tools were used to build this project.</li>
          </ul>
        </Card>

        <Card title="Profiles">
          <p className="m-0 mb-4 max-w-description">
            The demo profile has two weeks of simulated history. A team member's profile starts
            empty and fills with their own readings and entries. Everything stays on this device.
          </p>
          <ul aria-label="Profiles" className="m-0 flex list-none flex-col gap-2 p-0">
            {profiles.map((profile) => {
              const isActive = profile.id === active.id
              return (
                <li
                  key={profile.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-bg px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-base font-semibold text-text">
                      {profile.displayName}
                    </p>
                    <p className="m-0 truncate text-xs text-text-muted">{profile.role}</p>
                  </div>
                  <StatusPill tone="neutral" label={profile.kind === 'demo' ? 'DEMO' : 'CREW'} />
                  {isActive ? (
                    <StatusPill tone="ok" label="ACTIVE" />
                  ) : (
                    <Button
                      variant="quiet"
                      onClick={() => setActiveProfile(profile.id)}
                      aria-label={`Switch to ${profile.displayName}`}
                    >
                      Switch
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          {!adding && (
            <div className="mt-4">
              <Button variant="quiet" icon={Plus} onClick={() => setAdding(true)}>
                Add my profile
              </Button>
            </div>
          )}
          {adding && <AddProfileForm onDone={() => setAdding(false)} />}
        </Card>

        <Card title="Your data">
          {active.kind === 'member' ? (
            <div className="flex flex-col gap-3">
              <p className="m-0 max-w-description">
                Delete {active.displayName}'s profile and everything recorded for it from this
                device. This cannot be undone.
              </p>
              <div>
                <Button variant="danger" onClick={() => setConfirming('delete')}>
                  Delete my data
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="m-0 max-w-description">
                Put the demo profile back to its starting two weeks. Anything you added to it is
                lost. To delete a team member's data, switch to their profile first.
              </p>
              <div>
                <Button variant="quiet" onClick={() => setConfirming('reset')}>
                  Reset demo data
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div>
          <SectionLabel as="p">Build time</SectionLabel>
          <p className="m-0 mt-1 text-base text-text-secondary">{buildTime()}</p>
        </div>
      </div>

      <ConfirmDialog
        open={confirming === 'delete'}
        title="Delete your data?"
        message={`This removes ${active.displayName}'s profile and everything recorded for it from this device. It cannot be undone.`}
        confirmLabel="Delete my data"
        onConfirm={() => {
          deleteProfileData(active.id)
          setConfirming(null)
        }}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === 'reset'}
        title="Reset demo data?"
        message="This puts the demo profile back to its starting two weeks. Anything you added to it is lost."
        confirmLabel="Reset demo data"
        onConfirm={() => {
          resetDemoProfile()
          setConfirming(null)
        }}
        onCancel={() => setConfirming(null)}
      />
    </>
  )
}
