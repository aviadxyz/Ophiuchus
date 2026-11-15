import { useState } from 'react'
import { Card, SectionLabel, SourceBadge } from '@/design'
import type { DateString, MoodCheckin, SleepRecord } from '@/data'
import { addDays, moodWord } from '@/data'
import { groupCheckinsByDay } from './patterns'

export type TimelineCardProps = {
  checkins: readonly MoodCheckin[]
  sleepRecords: readonly SleepRecord[]
  today: DateString
}

function scoreTone(score: number): {
  bg: string
  border: string
  text: string
  dotClass: string
} {
  if (score <= 1) {
    return {
      bg: 'bg-danger/20',
      border: 'border-danger',
      text: 'text-danger',
      dotClass: 'bg-danger text-bg',
    }
  }
  if (score === 2) {
    return {
      bg: 'bg-warn/20',
      border: 'border-warn',
      text: 'text-warn',
      dotClass: 'bg-warn text-bg',
    }
  }
  if (score === 3) {
    return {
      bg: 'bg-surface-raised',
      border: 'border-border',
      text: 'text-text-secondary',
      dotClass: 'bg-text-secondary text-bg',
    }
  }
  if (score === 4) {
    return {
      bg: 'bg-accent/20',
      border: 'border-accent/50',
      text: 'text-accent',
      dotClass: 'bg-accent text-bg',
    }
  }
  return {
    bg: 'bg-accent/25',
    border: 'border-accent',
    text: 'text-accent',
    dotClass: 'bg-accent text-bg',
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "2 Nov" from "2026-11-02". */
function dayAndMonth(d: DateString): string {
  const [, month, day] = d.split('-')
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ''}`
}

export function TimelineCard({ checkins, sleepRecords, today }: TimelineCardProps) {
  const [selectedDate, setSelectedDate] = useState<DateString>(today)

  // 14 calendar dates ending at today, oldest first
  const dates: DateString[] = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))

  const dayMoods = groupCheckinsByDay(checkins)
  const moodByDate = new Map(dayMoods.map((d) => [d.date, d]))
  const sleepByDate = new Map(sleepRecords.map((s) => [s.date, s]))

  const selectedDayMood = moodByDate.get(selectedDate)
  const selectedSleep = sleepByDate.get(selectedDate)

  // Summary for screen readers
  const daysWithCheckins = dayMoods.filter((d) => d.date >= dates[0] && d.date <= today)
  const avg =
    daysWithCheckins.length > 0
      ? (
          daysWithCheckins.reduce((sum, d) => sum + d.avgScore, 0) / daysWithCheckins.length
        ).toFixed(1)
      : 'no'

  const formatShortDay = (d: DateString) => (d === today ? 'Today' : dayAndMonth(d))

  const formatDayHeading = (d: DateString) => {
    if (d === today) return 'Today'
    const weekday = WEEKDAYS[new Date(`${d}T12:00:00`).getDay()] ?? ''
    return `${weekday} ${dayAndMonth(d)}`
  }

  const formatTime = (isoString: string) => {
    const d = new Date(isoString)
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <Card title="14-day timeline">
      {/* Screen reader summary */}
      <p className="sr-only">
        Fourteen-day mood and sleep history: average mood is {avg} across {daysWithCheckins.length}{' '}
        days with check-ins.
      </p>

      <div className="flex flex-col gap-4">
        {/* Timeline visualization container */}
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-2 sm:p-4">
          {/* Header labels */}
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-mono uppercase tracking-wider">Mood score (1 to 5)</span>
            <span className="font-mono uppercase tracking-wider">Tap a day to inspect</span>
          </div>

          {/* Top section: Mood score plot (14 columns) */}
          <div className="relative h-28 w-full border-b border-border/60 pt-2 pb-1">
            {/* Guide lines for scores 5, 3, 1 */}
            <div className="pointer-events-none absolute inset-x-0 top-2 border-b border-border/20 text-[9px] text-text-muted">
              <span className="absolute -top-2 right-1 font-mono">5 Very good</span>
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-14 border-b border-border/20 text-[9px] text-text-muted">
              <span className="absolute -top-2 right-1 font-mono">3 Okay</span>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-2 border-b border-border/20 text-[9px] text-text-muted">
              <span className="absolute -top-2 right-1 font-mono">1 Very low</span>
            </div>

            {/* 14 columns of mood markers */}
            <div className="grid h-full grid-cols-[repeat(14,minmax(0,1fr))] gap-0.5">
              {dates.map((d) => {
                const dayMood = moodByDate.get(d)
                const isSelected = d === selectedDate
                const score = dayMood?.avgScore

                // Vertical positioning: 1 at bottom, 5 at top
                // 1 -> bottom: 8px; 5 -> bottom: 84px
                const bottomPx = score !== undefined ? Math.round(((score - 1) / 4) * 76 + 8) : 0
                const tone = score !== undefined ? scoreTone(score) : null

                return (
                  <div
                    key={d}
                    className={`relative flex h-full flex-col items-center justify-end rounded-t ${
                      isSelected ? 'bg-surface-raised/40' : ''
                    }`}
                  >
                    {score !== undefined && tone ? (
                      <div
                        style={{ bottom: `${bottomPx}px` }}
                        className={[
                          'absolute flex size-5.5 items-center justify-center rounded-full border shadow-sm sm:size-6',
                          'transition-transform select-none',
                          tone.border,
                          tone.dotClass,
                          isSelected ? 'scale-115 ring-2 ring-accent' : '',
                        ].join(' ')}
                        title={`${d}: mood ${score}`}
                      >
                        <span className="text-[10px] font-bold sm:text-xs">
                          {Number.isInteger(score) ? score : score.toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      // Gap marker
                      <div
                        style={{ bottom: '8px' }}
                        className="absolute size-1.5 rounded-full bg-border"
                        title={`${d}: no check-in`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Middle section: Day labels (interactive selector buttons) */}
          <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-0.5 py-1">
            {dates.map((d, index) => {
              const isSelected = d === selectedDate
              const isToday = d === today
              const hasCheckin = moodByDate.has(d)
              // Under 1024 px only every other date fits; counting back from today keeps Today shown.
              const labelWhenNarrow = (dates.length - 1 - index) % 2 === 0
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={[
                    'flex flex-col items-center justify-center rounded py-1 transition-colors',
                    'cursor-pointer focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none',
                    isSelected
                      ? 'border border-accent bg-accent/15 text-text'
                      : 'border border-transparent hover:bg-surface-raised text-text-muted',
                  ].join(' ')}
                  aria-pressed={isSelected}
                  aria-label={`${formatDayHeading(d)}${hasCheckin ? ', has check-in' : ''}`}
                >
                  <span
                    className={[
                      'whitespace-nowrap text-[9px] sm:text-[11px] font-medium leading-none',
                      labelWhenNarrow ? '' : 'invisible lg:visible',
                      isToday ? 'font-bold text-accent' : '',
                    ].join(' ')}
                  >
                    {formatShortDay(d)}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Bottom section: Sleep hours axis (drawn underneath on the same axis) */}
          <div className="flex flex-col gap-1 border-t border-border/60 pt-2">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span className="font-mono uppercase tracking-wider">Sleep hours</span>
              <span className="text-[11px] text-text-muted">6h target marked</span>
            </div>
            <div className="grid h-16 grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-0.5 pt-1">
              {dates.map((d) => {
                const sleep = sleepByDate.get(d)
                const isSelected = d === selectedDate
                const hours = sleep?.hours
                const isShort = hours !== undefined && hours < 6.0
                // Max sleep representation is 9 hours
                const heightPct = hours !== undefined ? Math.min(100, (hours / 9) * 100) : 0

                return (
                  <div
                    key={d}
                    className={`relative flex h-full flex-col items-center justify-end rounded-b ${
                      isSelected ? 'bg-surface-raised/40' : ''
                    }`}
                    title={hours !== undefined ? `${d}: ${hours}h sleep` : `${d}: no sleep logged`}
                  >
                    {hours !== undefined ? (
                      <div className="flex w-full flex-col items-center gap-0.5">
                        <span
                          className={`text-[8px] sm:text-[10px] font-mono leading-none ${
                            isShort ? 'font-bold text-warn' : 'text-text-muted'
                          }`}
                        >
                          {hours.toFixed(1)}
                        </span>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-2.5 sm:w-4 rounded-t ${
                            isShort ? 'bg-warn' : 'bg-surface-raised border border-border'
                          } ${isSelected ? 'ring-1 ring-accent' : ''}`}
                        />
                      </div>
                    ) : (
                      <div className="mb-1 text-[9px] text-text-muted">—</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Selected Day Inspector */}
        <div className="rounded-lg border border-border bg-bg p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <div>
              <p className="m-0 text-base font-semibold text-text">
                {formatDayHeading(selectedDate)}
              </p>
              <p className="m-0 text-xs text-text-muted">
                {selectedSleep
                  ? `Sleep: ${selectedSleep.hours}h (${selectedSleep.hours < 6 ? 'Short night' : 'Rested'})`
                  : 'Sleep: Not logged'}
              </p>
            </div>
            {selectedDayMood && (
              <span className="font-mono text-xs text-text-secondary">
                Daily average: {selectedDayMood.avgScore}
              </span>
            )}
          </div>

          {selectedDayMood && selectedDayMood.checkins.length > 0 ? (
            <div className="flex flex-col gap-3">
              {selectedDayMood.checkins.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-text">
                        {c.score} {moodWord(c.score)}
                      </span>
                      <span className="text-xs text-text-muted">at {formatTime(c.at)}</span>
                    </div>
                    <SourceBadge source={c.source} />
                  </div>

                  {c.tags && c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border bg-surface-raised px-2 py-0.5 text-xs text-text-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {c.note && (
                    <div className="mt-1 border-t border-border/60 pt-2">
                      <SectionLabel as="p">Note</SectionLabel>
                      <p
                        dir="auto"
                        className="m-0 mt-1 text-sm whitespace-pre-wrap break-words text-text-secondary"
                      >
                        {c.note}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 text-sm text-text-muted">No mood check-ins recorded for this day.</p>
          )}
        </div>
      </div>
    </Card>
  )
}
