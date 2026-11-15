// Words and order for the crew challenge boards. Pure, so they can be tested.

import type { ChallengeEntry, ChallengeId } from '@/data'

type ChallengeText = {
  title: string
  compares: string
  /** What friends who take part see, for the confirmation. */
  shared: string
  /** The highest score, to draw the bar. */
  max: number
  noScore: string
  earnedText: string
  earnedLabel: string
  earnedPath: string
}

export const CHALLENGE_TEXT: Record<ChallengeId, ChallengeText> = {
  exercise: {
    title: 'Exercise this week',
    compares: 'The share of your planned exercise minutes you have done this week.',
    shared: 'the share of your planned exercise minutes you have done this week',
    max: 100,
    noScore: 'No exercise is planned for you this week yet.',
    earnedText: 'Your score grows as you mark sessions done in',
    earnedLabel: 'Physical activity',
    earnedPath: '/physical-activity',
  },
  nutrition: {
    title: 'Food and water this week',
    compares: 'The days this week your energy, water and protein were all on target.',
    shared: 'how many days this week your energy, water and protein were all on target',
    max: 7,
    noScore: 'Nothing eaten or drunk is logged for you this week yet.',
    earnedText: 'Your score grows as you log meals and drinks in',
    earnedLabel: 'Nutrition',
    earnedPath: '/nutrition',
  },
}

export function confirmMessage(id: ChallengeId): string {
  return (
    `Your friends who also take part will see one number: ${CHALLENGE_TEXT[id].shared}. ` +
    'They never see your meals, your minutes, your body mass or anything else. ' +
    'You can leave at any time and your number is removed at once.'
  )
}

/** "68% of the plan" or "4 of 7 days". */
export function scoreWords(id: ChallengeId, score: number): string {
  return id === 'exercise' ? `${score}% of the plan` : `${score} of 7 days`
}

/** Positions for entries already sorted highest first. Equal scores share a position. */
export function positions(entries: readonly ChallengeEntry[]): number[] {
  return entries.map((entry) => 1 + entries.filter((other) => other.score > entry.score).length)
}
