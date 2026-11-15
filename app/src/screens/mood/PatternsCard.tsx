import { Card } from '@/design'
import type { ExerciseSession, MoodCheckin, SleepRecord } from '@/data'
import {
  computeExerciseRule,
  computeSleepRule,
  computeTrendRule,
  type MoodTrend,
} from './patterns'

export type PatternsCardProps = {
  checkins: readonly MoodCheckin[]
  sleepRecords: readonly SleepRecord[]
  sessions: readonly ExerciseSession[]
  headerTrend: MoodTrend
}

export function PatternsCard({
  checkins,
  sleepRecords,
  sessions,
  headerTrend,
}: PatternsCardProps) {
  const sleepSentence = computeSleepRule(checkins, sleepRecords)
  const exerciseSentence = computeExerciseRule(checkins, sessions)
  const trendSentence = computeTrendRule(checkins, headerTrend)

  const sentences = [sleepSentence, exerciseSentence, trendSentence].filter(
    (s): s is string => typeof s === 'string' && s.length > 0,
  )

  return (
    <Card title="What seems to move your mood">
      {sentences.length === 0 ? (
        <p className="m-0 text-base text-text-secondary">
          A few more days of check-ins and patterns will show here.
        </p>
      ) : (
        <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-base text-text">
          {sentences.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}
