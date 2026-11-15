import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Annoyed, Frown, Laugh, Meh, Smile } from 'lucide-react'
import { Button, Card, ChipGroup, SectionLabel, TextField } from '@/design'
import type { MoodCheckin } from '@/data'
import { addMoodCheckin, updateMoodCheckin } from '@/data'
import { checkinDate } from './patterns'
import { hasSelfHarmPhrase } from './safetyPhrases'

export type CheckinCardProps = {
  checkins: readonly MoodCheckin[]
  today: string
}

const SCORE_OPTIONS = [
  { score: 1, label: '1 Very low', icon: Frown },
  { score: 2, label: '2 Low', icon: Annoyed },
  { score: 3, label: '3 Okay', icon: Meh },
  { score: 4, label: '4 Good', icon: Smile },
  { score: 5, label: '5 Very good', icon: Laugh },
] as const

const TAG_OPTIONS = [
  'Tired',
  'Stressed',
  'Focused',
  'Calm',
  'Homesick',
  'Irritable',
  'Proud',
  'Lonely',
]

export function CheckinCard({ checkins, today }: CheckinCardProps) {
  const navigate = useNavigate()
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Today's latest check-in
  const todaysCheckins = checkins.filter((c) => checkinDate(c) === today)
  const todaysCheckin = todaysCheckins[0]

  const activeCheckin = todaysCheckin
  const showSelfHarmCard = hasSelfHarmPhrase(activeCheckin?.note)

  const handleSelectScore = (score: number) => {
    if (isEditing && activeCheckin) {
      updateMoodCheckin(activeCheckin.id, { score })
    } else {
      addMoodCheckin(score, [], '')
      setIsAddingNew(false)
      setIsEditing(true)
    }
  }

  const handleTagsChange = (tags: string[]) => {
    if (activeCheckin) {
      updateMoodCheckin(activeCheckin.id, { tags })
    }
  }

  const handleNoteChange = (note: string) => {
    if (activeCheckin) {
      updateMoodCheckin(activeCheckin.id, { note })
    }
  }

  const formatTime = (isoString: string) => {
    const d = new Date(isoString)
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card title="Daily check-in">
        {todaysCheckin && !isEditing && !isAddingNew ? (
          // View mode for today's check-in
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg p-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const opt =
                    SCORE_OPTIONS.find((o) => o.score === todaysCheckin.score) ?? SCORE_OPTIONS[2]
                  const Icon = opt.icon
                  return (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                      <Icon className="size-7" aria-hidden="true" />
                    </div>
                  )
                })()}
                <div>
                  <p className="m-0 text-lg font-semibold text-text">
                    {SCORE_OPTIONS.find((o) => o.score === todaysCheckin.score)?.label ??
                      `${todaysCheckin.score} Check-in`}
                  </p>
                  <p className="m-0 text-xs text-text-muted">
                    Logged today at {formatTime(todaysCheckin.at)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="quiet" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
                <Button variant="quiet" onClick={() => setIsAddingNew(true)}>
                  Add another
                </Button>
              </div>
            </div>

            {todaysCheckin.tags && todaysCheckin.tags.length > 0 && (
              <div>
                <SectionLabel as="p">Feelings</SectionLabel>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {todaysCheckin.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-surface-raised px-2.5 py-0.5 text-xs text-text-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {todaysCheckin.note && (
              <div>
                <SectionLabel as="p">Note</SectionLabel>
                <p
                  dir="auto"
                  className="m-0 mt-1 rounded-md border border-border bg-bg p-3 text-base whitespace-pre-wrap break-words text-text"
                >
                  {todaysCheckin.note}
                </p>
              </div>
            )}
          </div>
        ) : (
          // Check-in / edit form
          <div className="flex flex-col gap-5">
            <div>
              <p className="m-0 mb-3 text-base text-text-secondary">
                {isEditing ? 'Update your score:' : 'How are you feeling today? Tap to check in:'}
              </p>
              <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
                {SCORE_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  const isSelected = activeCheckin?.score === opt.score
                  return (
                    <button
                      key={opt.score}
                      type="button"
                      onClick={() => handleSelectScore(opt.score)}
                      className={[
                        'flex flex-col items-center justify-center gap-1.5 rounded-lg border p-2 text-center transition-colors select-none sm:p-3',
                        'cursor-pointer hover:bg-surface-raised',
                        isSelected
                          ? 'border-accent bg-accent/15 text-text'
                          : 'border-border bg-bg text-text-secondary',
                      ].join(' ')}
                      aria-label={opt.label}
                      aria-pressed={isSelected}
                    >
                      <Icon className="size-6 text-accent sm:size-7" aria-hidden="true" />
                      <span className="text-xs font-medium leading-tight sm:text-xs">
                        {opt.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {isEditing && activeCheckin && (
              <>
                <div className="flex flex-col gap-2">
                  <SectionLabel as="p">Add tags (optional)</SectionLabel>
                  <ChipGroup
                    options={TAG_OPTIONS}
                    selected={activeCheckin.tags}
                    onChange={handleTagsChange}
                    multiple
                    label="Mood tags"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <TextField
                    label="Note (optional)"
                    value={activeCheckin.note ?? ''}
                    onChange={handleNoteChange}
                    maxLength={500}
                    placeholder="Notes stay private on this device..."
                    hint={`${(activeCheckin.note ?? '').length}/500 characters`}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="m-0 text-xs text-text-muted">Changes are saved automatically.</p>
                  <Button variant="primary" onClick={() => setIsEditing(false)}>
                    Done
                  </Button>
                </div>
              </>
            )}

            {isAddingNew && todaysCheckin && (
              <div className="pt-2">
                <Button variant="quiet" onClick={() => setIsAddingNew(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Safety Card 2: Self-harm assistance */}
      {showSelfHarmCard && (
        <Card>
          <div className="flex flex-col gap-3">
            <p className="m-0 text-base font-semibold text-text">
              You don&apos;t have to carry this alone. Please reach out to your flight surgeon or a
              crewmate now.
            </p>
            <div>
              <Button variant="danger" onClick={() => navigate('/emergency')}>
                Emergency
              </Button>
            </div>
            <p className="m-0 text-xs text-text-muted">
              This is a demonstration. If you are in a real crisis, contact your local emergency
              services.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
