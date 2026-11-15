import { useMemo } from 'react'
import { Button, Card, GameLinks, ScreenHeader, type HeaderPill } from '@/design'
import {
  addDays,
  toDateString,
  useExerciseSessions,
  useMoodCheckins,
  useSleep,
} from '@/data'
import { askMedbot } from '@/ophi'
import { CheckinCard } from './CheckinCard'
import { meta } from './meta'
import {
  checkinDate,
  compute7DayAverage,
  computeTrendWord,
  isHeavyDaysConditionMet,
} from './patterns'
import { PatternsCard } from './PatternsCard'
import { TimelineCard } from './TimelineCard'
import { TryNowCard } from './TryNowCard'

export default function MoodScreen() {
  const today = useMemo(() => toDateString(new Date()), [])
  const fourteenDaysAgo = useMemo(() => addDays(today, -13), [today])

  const moodCheckins = useMoodCheckins(14)
  const sleepRecords = useSleep(14)
  const exerciseSessions = useExerciseSessions(fourteenDaysAgo, today)

  const hasCheckinToday = moodCheckins.some((c) => checkinDate(c) === today)
  const sevenDayAvg = compute7DayAverage(moodCheckins, today)
  const trendWord = computeTrendWord(moodCheckins, today)
  const showHeavyDaysCard = isHeavyDaysConditionMet(moodCheckins)

  const pills: HeaderPill[] = [
    hasCheckinToday
      ? { tone: 'ok', label: 'Check-in done' }
      : { tone: 'warn', label: 'Check-in due' },
    sevenDayAvg !== null
      ? {
          tone: sevenDayAvg >= 3.5 ? 'ok' : sevenDayAvg >= 2.5 ? 'neutral' : 'warn',
          label: `${sevenDayAvg.toFixed(1)} avg`,
        }
      : { tone: 'neutral', label: 'No check-ins' },
    {
      tone: trendWord === 'Rising' ? 'ok' : trendWord === 'Falling' ? 'warn' : 'neutral',
      label: trendWord,
    },
  ]

  return (
    <>
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={pills}
      />

      <div className="flex flex-col gap-6">
        {/* 1. Main check-in card and optional crisis safety card */}
        <CheckinCard checkins={moodCheckins} today={today} />

        {/* 2. Safety Card 1: Calm support card when last 3 days average <= 2 */}
        {showHeavyDaysCard && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="m-0 max-w-description text-base text-text">
                The last few days look heavy. It might help to talk it through with the Med bot or
                your flight surgeon.
              </p>
              <Button variant="quiet" onClick={() => askMedbot('mood')}>
                Talk to the Med bot
              </Button>
            </div>
          </Card>
        )}

        {/* 3. 14-day timeline with daily mood scores and sleep underneath */}
        <TimelineCard checkins={moodCheckins} sleepRecords={sleepRecords} today={today} />

        {/* 4. What seems to move your mood */}
        <PatternsCard
          checkins={moodCheckins}
          sleepRecords={sleepRecords}
          sessions={exerciseSessions}
          headerTrend={trendWord}
        />

        {/* 5. Try now actions */}
        <TryNowCard />

        {/* 6. Privacy line */}
        <p className="m-0 text-sm text-text-muted">
          Your notes stay on this device. They are never sent to the Med bot or anyone else.
        </p>

        {/* 7. Games */}
        <GameLinks screenId="mood" />
      </div>
    </>
  )
}
