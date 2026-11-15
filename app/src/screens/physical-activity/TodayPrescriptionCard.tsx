import { useState } from 'react'
import { Info, Undo2, Check, Clock, X } from 'lucide-react'
import type { ExerciseSession } from '@/data'
import { logGameMinutes, setSessionStatus } from '@/data'
import {
  Button,
  Card,
  ChipGroup,
  DetailDrawer,
  EmptyState,
  NumberField,
  StatusPill,
} from '@/design'
import { DEVICE_LABELS } from './compute'

const SKIP_REASONS = [
  'Schedule conflict',
  'Equipment issue',
  'Not feeling well',
  'Other',
]

const DEVICE_GUIDANCE: Record<
  ExerciseSession['device'],
  { protects: string; tips: string[] }
> = {
  resistive: {
    protects:
      'High-load resistive exercise protects bone mineral density in weight-bearing hips and spine and prevents skeletal muscle atrophy.',
    tips: [
      'Maintain steady cadence through full range of motion; avoid locking joints at peak extension.',
      'Check bar alignment and harness tethering to ensure symmetric bilateral loading.',
      'Breathe continuously throughout the repetition; avoid Valsalva maneuver under heavy loads.',
    ],
  },
  treadmill: {
    protects:
      'Treadmill running provides axial heel-strike loading to stimulate bone remodeling and sustain cardiovascular endurance.',
    tips: [
      'Adjust harness bungees to maintain approximately 70% of equivalent Earth body weight.',
      'Keep eyes forward with upright posture; avoid gripping side stabilizer bars.',
      'Adopt a midfoot strike to evenly distribute impact shock through lower extremity joints.',
    ],
  },
  cycle: {
    protects:
      'Cycle ergometer training preserves aerobic stroke volume, leg power, and maximal oxygen consumption (VO2 max).',
    tips: [
      'Fasten clip-in pedal straps and adjust seat height before starting your warm-up.',
      'Target a cadence between 70 and 85 RPM within your prescribed aerobic training heart rate.',
      'Relax neck, shoulders, and grip to minimize unnecessary tension in zero gravity.',
    ],
  },
  game: {
    protects:
      'Interactive movement games combine aerobic heart rate elevation with coordination, balance, and cognitive engagement.',
    tips: [
      'Position yourself with a clear line of sight to the camera tracker and clear the exercise zone.',
      'Perform full-body expressive movements to sustain elevated cardiovascular activity.',
    ],
  },
  other: {
    protects:
      'Supplemental conditioning routines support overall muscular endurance, joint mobility, and operational mission stamina.',
    tips: [
      'Track total elapsed time accurately and note any unexpected joint soreness or discomfort.',
      'Discontinue immediately and notify the flight surgeon if feeling lightheaded or nauseated.',
    ],
  },
}

export type TodayPrescriptionCardProps = {
  sessions: ExerciseSession[]
}

export function TodayPrescriptionCard({ sessions }: TodayPrescriptionCardProps) {
  // Drawer state for viewing form tips and protection details
  const [activeDrawerSession, setActiveDrawerSession] = useState<ExerciseSession | null>(null)

  // Editing state for "Done with changes" (session id -> minutes number)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [customMinutes, setCustomMinutes] = useState<number | null>(null)
  const [customMinutesError, setCustomMinutesError] = useState<string | undefined>(undefined)

  // Skipping state for "Skip" (session id -> selected reason string)
  const [skippingSessionId, setSkippingSessionId] = useState<string | null>(null)
  const [selectedSkipReason, setSelectedSkipReason] = useState<string>(SKIP_REASONS[0]!)

  // Manual session logging (when today has 0 planned sessions)
  const [loggingManual, setLoggingManual] = useState(false)
  const [manualMinutes, setManualMinutes] = useState<number | null>(30)
  const [manualMinutesError, setManualMinutesError] = useState<string | undefined>(undefined)

  const handleMarkDone = (session: ExerciseSession) => {
    setSessionStatus(session.id, 'done', session.plannedMinutes)
  }

  const handleStartDoneWithChanges = (session: ExerciseSession) => {
    setEditingSessionId(session.id)
    setSkippingSessionId(null)
    setCustomMinutes(session.actualMinutes > 0 ? session.actualMinutes : session.plannedMinutes)
    setCustomMinutesError(undefined)
  }

  const handleConfirmChanges = (session: ExerciseSession) => {
    if (customMinutes === null || customMinutes < 1 || customMinutes > 240) {
      setCustomMinutesError('Enter actual duration between 1 and 240 minutes.')
      return
    }
    setSessionStatus(session.id, 'changed', customMinutes)
    setEditingSessionId(null)
  }

  const handleStartSkip = (session: ExerciseSession) => {
    setSkippingSessionId(session.id)
    setEditingSessionId(null)
    setSelectedSkipReason(SKIP_REASONS[0]!)
  }

  const handleConfirmSkip = (session: ExerciseSession) => {
    setSessionStatus(session.id, 'skipped', 0, selectedSkipReason)
    setSkippingSessionId(null)
  }

  const handleUndo = (session: ExerciseSession) => {
    setSessionStatus(session.id, 'planned')
  }

  const handleLogManual = () => {
    if (manualMinutes === null || manualMinutes < 1 || manualMinutes > 240) {
      setManualMinutesError('Enter session duration between 1 and 240 minutes.')
      return
    }
    logGameMinutes('manual', manualMinutes)
    setLoggingManual(false)
    setManualMinutes(30)
    setManualMinutesError(undefined)
  }

  return (
    <>
      <Card title="Today's prescription">
        {sessions.length === 0 ? (
          <div>
            <EmptyState
              message="No sessions planned today."
              actionLabel="Log a session"
              onAction={() => setLoggingManual(true)}
            />
            {loggingManual && (
              <div className="mt-4 rounded-lg border border-border bg-surface-raised p-4">
                <h3 className="m-0 mb-3 text-base font-semibold text-text">Log an aerobic session</h3>
                <div className="max-w-xs">
                  <NumberField
                    label="Minutes"
                    value={manualMinutes}
                    onChange={(v) => {
                      setManualMinutes(v)
                      if (v !== null && v >= 1 && v <= 240) {
                        setManualMinutesError(undefined)
                      }
                    }}
                    min={1}
                    max={240}
                    unit="min"
                    error={manualMinutesError}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="primary" size="md" onClick={handleLogManual}>
                    Save session
                  </Button>
                  <Button
                    variant="quiet"
                    size="md"
                    onClick={() => {
                      setLoggingManual(false)
                      setManualMinutesError(undefined)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
            {sessions.map((session) => {
              const isFinished = session.status !== 'planned'
              const isEditing = editingSessionId === session.id
              const isSkipping = skippingSessionId === session.id
              const deviceName = DEVICE_LABELS[session.device] ?? session.device
              const kindLabel = session.kind === 'resistive' ? 'Resistive' : 'Aerobic'

              return (
                <li key={session.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3">
                    {/* Header line of the session */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-text break-words">
                            {deviceName}
                          </span>
                          <span className="font-mono text-pill uppercase tracking-wider text-text-muted">
                            {kindLabel} · {session.plannedMinutes} min planned
                          </span>
                          {session.status === 'done' && (
                            <StatusPill tone="ok" label="DONE" />
                          )}
                          {session.status === 'changed' && (
                            <StatusPill tone="info" label="CHANGED" />
                          )}
                          {session.status === 'skipped' && (
                            <StatusPill tone="danger" label="SKIPPED" />
                          )}
                        </div>
                        {session.detail && (
                          <p className="m-0 mt-1 text-sm text-text-secondary break-words">
                            {session.detail}
                          </p>
                        )}
                      </div>

                      {/* Info / tips drawer button */}
                      <button
                        type="button"
                        onClick={() => setActiveDrawerSession(session)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-text"
                        aria-label={`View tips and guidance for ${deviceName}`}
                      >
                        <Info aria-hidden="true" className="size-4 text-accent" />
                        <span>Form tips</span>
                      </button>
                    </div>

                    {/* Result and actions */}
                    {isFinished ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-raised p-3">
                        <div className="text-sm">
                          {session.status === 'done' && (
                            <span className="text-text">
                              Completed <strong>{session.actualMinutes} min</strong>.
                            </span>
                          )}
                          {session.status === 'changed' && (
                            <span className="text-text">
                              Completed with changes: <strong>{session.actualMinutes} min</strong>{' '}
                              (planned {session.plannedMinutes} min).
                            </span>
                          )}
                          {session.status === 'skipped' && (
                            <span className="text-text-muted">
                              Session skipped
                              {session.skipReason ? `: ${session.skipReason}` : ''}.
                            </span>
                          )}
                        </div>
                        <Button
                          variant="quiet"
                          size="md"
                          icon={Undo2}
                          onClick={() => handleUndo(session)}
                        >
                          Undo
                        </Button>
                      </div>
                    ) : (
                      <>
                        {!isEditing && !isSkipping && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              variant="primary"
                              size="md"
                              icon={Check}
                              onClick={() => handleMarkDone(session)}
                            >
                              Done
                            </Button>
                            <Button
                              variant="quiet"
                              size="md"
                              icon={Clock}
                              onClick={() => handleStartDoneWithChanges(session)}
                            >
                              Done with changes
                            </Button>
                            <Button
                              variant="quiet"
                              size="md"
                              icon={X}
                              onClick={() => handleStartSkip(session)}
                            >
                              Skip
                            </Button>
                          </div>
                        )}

                        {/* Inline Done with Changes input */}
                        {isEditing && (
                          <div className="rounded-md border border-border bg-surface-raised p-3">
                            <h4 className="m-0 mb-2 text-sm font-semibold text-text">
                              Enter actual completed duration
                            </h4>
                            <div className="max-w-xs">
                              <NumberField
                                label="Actual minutes"
                                value={customMinutes}
                                onChange={(v) => {
                                  setCustomMinutes(v)
                                  if (v !== null && v >= 1 && v <= 240) {
                                    setCustomMinutesError(undefined)
                                  }
                                }}
                                min={1}
                                max={240}
                                unit="min"
                                error={customMinutesError}
                              />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                variant="primary"
                                size="md"
                                onClick={() => handleConfirmChanges(session)}
                              >
                                Save changes
                              </Button>
                              <Button
                                variant="quiet"
                                size="md"
                                onClick={() => {
                                  setEditingSessionId(null)
                                  setCustomMinutesError(undefined)
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Inline Skip reason selection */}
                        {isSkipping && (
                          <div className="rounded-md border border-border bg-surface-raised p-3">
                            <h4 className="m-0 mb-2 text-sm font-semibold text-text">
                              Select reason for skipping
                            </h4>
                            <ChipGroup
                              options={SKIP_REASONS}
                              selected={[selectedSkipReason]}
                              onChange={(sel) => {
                                const first = sel[0]
                                if (first) setSelectedSkipReason(first)
                              }}
                              multiple={false}
                              label="Skip reasons"
                            />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                variant="danger"
                                size="md"
                                onClick={() => handleConfirmSkip(session)}
                              >
                                Confirm skip
                              </Button>
                              <Button
                                variant="quiet"
                                size="md"
                                onClick={() => setSkippingSessionId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* Detail drawer for form tips and device protection */}
      {activeDrawerSession && (
        <DetailDrawer
          open={Boolean(activeDrawerSession)}
          title={DEVICE_LABELS[activeDrawerSession.device] ?? activeDrawerSession.device}
          onClose={() => setActiveDrawerSession(null)}
        >
          {(() => {
            const guidance =
              DEVICE_GUIDANCE[activeDrawerSession.device] ?? DEVICE_GUIDANCE.other
            return (
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="m-0 mb-2 font-mono text-eyebrow uppercase tracking-wider text-text-muted">
                    Countermeasure protection
                  </h3>
                  <p className="m-0 text-base leading-relaxed text-text">
                    {guidance.protects}
                  </p>
                </div>

                <div>
                  <h3 className="m-0 mb-3 font-mono text-eyebrow uppercase tracking-wider text-text-muted">
                    Form tips & protocol
                  </h3>
                  <ul className="m-0 list-disc space-y-2.5 pl-5 text-sm text-text-secondary">
                    {guidance.tips.map((tip) => (
                      <li key={tip} className="leading-normal">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-md border border-border bg-surface-raised p-3 text-xs text-text-muted">
                  Planned for this session: {activeDrawerSession.plannedMinutes} min (
                  {activeDrawerSession.kind === 'resistive' ? 'Resistive' : 'Aerobic'}).
                  {activeDrawerSession.detail ? ` Details: ${activeDrawerSession.detail}.` : ''}
                </div>
              </div>
            )
          })()}
        </DetailDrawer>
      )}
    </>
  )
}
