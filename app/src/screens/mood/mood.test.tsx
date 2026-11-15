import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createProfile,
  resetDemoProfile,
  setActiveProfile,
  type ExerciseSession,
  type MoodCheckin,
  type SleepRecord,
} from '@/data'
import {
  compute7DayAverage,
  computeExerciseRule,
  computeSleepRule,
  computeTrendRule,
  computeTrendWord,
  isHeavyDaysConditionMet,
} from './patterns'
import { hasSelfHarmPhrase } from './safetyPhrases'
import MoodScreen from './index'

function makeCheckin(
  date: string,
  score: number,
  id = 'checkin-1',
  note?: string,
  tags: string[] = [],
): MoodCheckin {
  return {
    id,
    profileId: 'test-profile',
    at: `${date}T12:00:00.000Z`,
    score,
    tags,
    note,
    source: 'entered',
  }
}

describe('Mood screen calculations and safety rules', () => {
  describe('Trend word (Rising, Steady, Falling)', () => {
    const today = '2026-11-14'

    it('returns Steady when there is insufficient data', () => {
      expect(computeTrendWord([], today)).toBe('Steady')
      // Only recent days, no prior days
      const recentOnly = [makeCheckin('2026-11-14', 4), makeCheckin('2026-11-13', 4)]
      expect(computeTrendWord(recentOnly, today)).toBe('Steady')
    })

    it('returns Rising when recent 3 days are at least 0.3 higher than prior 4 days', () => {
      const checkins = [
        // Prior 4 days (Nov 8 - 11): average = 2.5
        makeCheckin('2026-11-08', 2),
        makeCheckin('2026-11-09', 3),
        makeCheckin('2026-11-10', 2),
        makeCheckin('2026-11-11', 3),
        // Recent 3 days (Nov 12 - 14): average = 4.0
        makeCheckin('2026-11-12', 4),
        makeCheckin('2026-11-13', 4),
        makeCheckin('2026-11-14', 4),
      ]
      expect(computeTrendWord(checkins, today)).toBe('Rising')
    })

    it('returns Falling when recent 3 days are at least 0.3 lower than prior 4 days', () => {
      const checkins = [
        // Prior 4 days (Nov 8 - 11): average = 4.5
        makeCheckin('2026-11-08', 5),
        makeCheckin('2026-11-09', 4),
        makeCheckin('2026-11-10', 5),
        makeCheckin('2026-11-11', 4),
        // Recent 3 days (Nov 12 - 14): average = 2.5
        makeCheckin('2026-11-12', 2),
        makeCheckin('2026-11-13', 3),
        makeCheckin('2026-11-14', 2),
      ]
      expect(computeTrendWord(checkins, today)).toBe('Falling')
    })

    it('returns Steady when difference between periods is less than 0.3', () => {
      const checkins = [
        makeCheckin('2026-11-08', 4),
        makeCheckin('2026-11-09', 4),
        makeCheckin('2026-11-10', 4),
        makeCheckin('2026-11-11', 4),
        makeCheckin('2026-11-12', 4),
        makeCheckin('2026-11-13', 4),
        makeCheckin('2026-11-14', 4),
      ]
      expect(computeTrendWord(checkins, today)).toBe('Steady')
    })
  })

  describe('7-day average', () => {
    const today = '2026-11-14'

    it('computes correct average to one decimal place', () => {
      const checkins = [
        makeCheckin('2026-11-14', 4),
        makeCheckin('2026-11-13', 5),
        makeCheckin('2026-11-12', 3),
      ]
      expect(compute7DayAverage(checkins, today)).toBe(4.0)
    })

    it('ignores check-ins older than 7 days', () => {
      const checkins = [
        makeCheckin('2026-11-14', 4),
        makeCheckin('2026-11-01', 1), // > 7 days ago
      ]
      expect(compute7DayAverage(checkins, today)).toBe(4.0)
    })

    it('returns null when no check-ins in the 7-day window', () => {
      expect(compute7DayAverage([], today)).toBeNull()
    })
  })

  describe('Pattern Rule 1: Sleep', () => {
    it('returns null when there are fewer than 2 short nights or 2 longer nights', () => {
      const checkins = [makeCheckin('2026-11-10', 2), makeCheckin('2026-11-11', 4)]
      const sleep: SleepRecord[] = [
        { id: 's1', profileId: 'p', date: '2026-11-09', hours: 5.0, source: 'simulated' },
        { id: 's2', profileId: 'p', date: '2026-11-10', hours: 7.0, source: 'simulated' },
      ]
      expect(computeSleepRule(checkins, sleep)).toBeNull()
    })

    it('returns sentence when difference is 0.5 or more', () => {
      const sleep: SleepRecord[] = [
        { id: 's1', profileId: 'p', date: '2026-11-08', hours: 5.0, source: 'simulated' },
        { id: 's2', profileId: 'p', date: '2026-11-09', hours: 5.2, source: 'simulated' },
        { id: 's3', profileId: 'p', date: '2026-11-10', hours: 7.5, source: 'simulated' },
        { id: 's4', profileId: 'p', date: '2026-11-11', hours: 7.8, source: 'simulated' },
      ]
      const checkins = [
        // Days after short nights (Nov 9 and Nov 10): avg = 2.5
        makeCheckin('2026-11-09', 3),
        makeCheckin('2026-11-10', 2),
        // Days after long nights (Nov 11 and Nov 12): avg = 4.5
        makeCheckin('2026-11-11', 4),
        makeCheckin('2026-11-12', 5),
      ]

      expect(computeSleepRule(checkins, sleep)).toBe(
        'Your mood was lower on days after short nights.',
      )
    })

    it('returns null when difference is under 0.5', () => {
      const sleep: SleepRecord[] = [
        { id: 's1', profileId: 'p', date: '2026-11-08', hours: 5.0, source: 'simulated' },
        { id: 's2', profileId: 'p', date: '2026-11-09', hours: 5.2, source: 'simulated' },
        { id: 's3', profileId: 'p', date: '2026-11-10', hours: 7.5, source: 'simulated' },
        { id: 's4', profileId: 'p', date: '2026-11-11', hours: 7.8, source: 'simulated' },
      ]
      const checkins = [
        // Short night after: avg = 3.9
        makeCheckin('2026-11-09', 4),
        makeCheckin('2026-11-10', 4),
        // Long night after: avg = 4.0
        makeCheckin('2026-11-11', 4),
        makeCheckin('2026-11-12', 4),
      ]

      expect(computeSleepRule(checkins, sleep)).toBeNull()
    })
  })

  describe('Pattern Rule 2: Exercise', () => {
    it('returns null when not enough days with or without exercise', () => {
      const checkins = [makeCheckin('2026-11-10', 4)]
      const sessions: ExerciseSession[] = []
      expect(computeExerciseRule(checkins, sessions)).toBeNull()
    })

    it('returns sentence when mood on exercise days is at least 0.5 higher', () => {
      const sessions: ExerciseSession[] = [
        {
          id: 'ex1',
          profileId: 'p',
          date: '2026-11-10',
          device: 'cycle',
          kind: 'aerobic',
          plannedMinutes: 60,
          actualMinutes: 60,
          status: 'done',
          source: 'entered',
        },
        {
          id: 'ex2',
          profileId: 'p',
          date: '2026-11-11',
          device: 'treadmill',
          kind: 'aerobic',
          plannedMinutes: 60,
          actualMinutes: 45,
          status: 'changed',
          source: 'entered',
        },
        {
          id: 'ex3',
          profileId: 'p',
          date: '2026-11-12',
          device: 'resistive',
          kind: 'resistive',
          plannedMinutes: 60,
          actualMinutes: 0,
          status: 'skipped',
          source: 'entered',
        },
        {
          id: 'ex4',
          profileId: 'p',
          date: '2026-11-13',
          device: 'cycle',
          kind: 'aerobic',
          plannedMinutes: 60,
          actualMinutes: 0,
          status: 'planned',
          source: 'entered',
        },
      ]

      const checkins = [
        // Exercise days (10 & 11): avg = 4.5
        makeCheckin('2026-11-10', 4),
        makeCheckin('2026-11-11', 5),
        // Non-exercise days (12 & 13): avg = 3.0
        makeCheckin('2026-11-12', 3),
        makeCheckin('2026-11-13', 3),
      ]

      expect(computeExerciseRule(checkins, sessions)).toBe(
        'Your mood was a little higher on days you exercised.',
      )
    })

    it('returns null when exercise days mood difference is under 0.5', () => {
      const sessions: ExerciseSession[] = [
        {
          id: 'ex1',
          profileId: 'p',
          date: '2026-11-10',
          device: 'cycle',
          kind: 'aerobic',
          plannedMinutes: 60,
          actualMinutes: 60,
          status: 'done',
          source: 'entered',
        },
        {
          id: 'ex2',
          profileId: 'p',
          date: '2026-11-11',
          device: 'treadmill',
          kind: 'aerobic',
          plannedMinutes: 60,
          actualMinutes: 60,
          status: 'done',
          source: 'entered',
        },
      ]

      const checkins = [
        makeCheckin('2026-11-10', 4),
        makeCheckin('2026-11-11', 4),
        makeCheckin('2026-11-12', 4),
        makeCheckin('2026-11-13', 4),
      ]

      expect(computeExerciseRule(checkins, sessions)).toBeNull()
    })
  })

  describe('Pattern Rule 3: Trend', () => {
    const sixCheckins = [
      makeCheckin('2026-11-09', 4),
      makeCheckin('2026-11-10', 3),
      makeCheckin('2026-11-11', 3),
      makeCheckin('2026-11-12', 4),
      makeCheckin('2026-11-13', 4),
      makeCheckin('2026-11-14', 5),
    ]

    it('returns null when fewer than 6 days with check-ins', () => {
      const fiveCheckins = sixCheckins.slice(0, 5)
      expect(computeTrendRule(fiveCheckins, 'Rising')).toBeNull()
    })

    it('returns null when trend is Steady', () => {
      expect(computeTrendRule(sixCheckins, 'Steady')).toBeNull()
    })

    it('returns rising sentence when header trend is Rising and >= 6 days', () => {
      expect(computeTrendRule(sixCheckins, 'Rising')).toBe('Your mood has been rising this week.')
    })

    it('returns dipping sentence when header trend is Falling and >= 6 days', () => {
      expect(computeTrendRule(sixCheckins, 'Falling')).toBe('Your mood has been dipping this week.')
    })
  })

  describe('Safety Condition 1: Three heavy days', () => {
    it('returns false when fewer than 3 days with check-ins', () => {
      const checkins = [makeCheckin('2026-11-14', 1), makeCheckin('2026-11-13', 2)]
      expect(isHeavyDaysConditionMet(checkins)).toBe(false)
    })

    it('returns true when last 3 days with check-ins all average <= 2', () => {
      const checkins = [
        makeCheckin('2026-11-14', 2),
        makeCheckin('2026-11-13', 1),
        makeCheckin('2026-11-12', 2),
        makeCheckin('2026-11-05', 5), // Older day should not break the last 3 days
      ]
      expect(isHeavyDaysConditionMet(checkins)).toBe(true)
    })

    it('returns false when any of the last 3 days averages > 2', () => {
      const checkins = [
        makeCheckin('2026-11-14', 2),
        makeCheckin('2026-11-13', 3), // > 2
        makeCheckin('2026-11-12', 1),
      ]
      expect(isHeavyDaysConditionMet(checkins)).toBe(false)
    })
  })

  describe('Safety Condition 2: Self-harm phrases detection', () => {
    it('detects phrases in the crisis list case-insensitively', () => {
      expect(hasSelfHarmPhrase('I want to hurt myself')).toBe(true)
      expect(hasSelfHarmPhrase('FEEL LIKE I WANT TO DIE')).toBe(true)
      expect(hasSelfHarmPhrase('thought about suicide today')).toBe(true)
      expect(hasSelfHarmPhrase('Better off dead')).toBe(true)
      expect(hasSelfHarmPhrase('just want to end it all')).toBe(true)
    })

    it('returns false for benign, emoji, or non-crisis text', () => {
      expect(hasSelfHarmPhrase(undefined)).toBe(false)
      expect(hasSelfHarmPhrase('')).toBe(false)
      expect(hasSelfHarmPhrase('Feeling tired after a long spacewalk')).toBe(false)
      expect(hasSelfHarmPhrase('Had a great call with home 😊🚀')).toBe(false)
      expect(hasSelfHarmPhrase('הכל בסדר היום, מרגיש טוב ומרוכז')).toBe(false)
    })

    it('correctly handles 500-character long notes and mixed content', () => {
      const longSafeText = 'Everything went according to schedule today. '.repeat(10).slice(0, 500)
      expect(hasSelfHarmPhrase(longSafeText)).toBe(false)

      const longCrisisText = `${longSafeText.slice(0, 400)} want to die today.`
      expect(hasSelfHarmPhrase(longCrisisText)).toBe(true)
    })
  })

  describe('MoodScreen Component Integration', () => {
    beforeEach(() => {
      act(() => {
        resetDemoProfile()
        setActiveProfile('demo')
      })
    })

    it('renders on the demo profile: shows sleep pattern sentence and check-in due', () => {
      render(
        <MemoryRouter>
          <MoodScreen />
        </MemoryRouter>,
      )

      // Header eyebrow and pills
      expect(screen.getByText('DOMAIN · MOOD')).toBeDefined()
      expect(screen.getByText(/check-in due/i)).toBeDefined()

      // The sleep pattern sentence appears on demo profile
      expect(
        screen.getByText('Your mood was lower on days after short nights.'),
      ).toBeDefined()

      // Timeline card
      expect(screen.getByText('14-day timeline')).toBeDefined()

      // Breathing button exists
      expect(screen.getByText('Breathe for a minute')).toBeDefined()

      // Heavy days safety card is NOT shown on demo profile
      expect(screen.queryByText(/The last few days look heavy/)).toBeNull()
    })

    it('allows a one-tap check-in, shows edit mode, and can be reset', async () => {
      render(
        <MemoryRouter>
          <MoodScreen />
        </MemoryRouter>,
      )

      // Tap "4 Good" button
      const goodBtn = screen.getByRole('button', { name: '4 Good' })
      await act(async () => {
        fireEvent.click(goodBtn)
      })

      // ScreenHeader pill updates to Check-in done
      expect(screen.getByText(/check-in done/i)).toBeDefined()

      // Tags and note fields appear
      expect(screen.getByText('Add tags (optional)')).toBeDefined()
      const noteInput = screen.getByLabelText('Note (optional)')
      expect(noteInput).toBeDefined()

      // Type note with emoji, Hebrew, and text up to 500 chars
      const hebrewNote = 'מרגיש מעולה היום! 🚀 Everything is great.'
      await act(async () => {
        fireEvent.change(noteInput, { target: { value: hebrewNote } })
      })
      expect(screen.getByDisplayValue(hebrewNote)).toBeDefined()

      // Done editing
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Done' }))
      })

      // Shows logged check-in in check-in card and timeline inspector
      expect(screen.getAllByText('4 Good').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(hebrewNote).length).toBeGreaterThanOrEqual(1)

      // Resetting demo data clears the check-in
      act(() => {
        resetDemoProfile()
      })
      expect(screen.getByText(/check-in due/i)).toBeDefined()
    })

    it('shows safety card 2 when a self-harm phrase is typed in note', async () => {
      render(
        <MemoryRouter>
          <MoodScreen />
        </MemoryRouter>,
      )

      // Tap "2 Low" button
      const lowBtn = screen.getByRole('button', { name: '2 Low' })
      await act(async () => {
        fireEvent.click(lowBtn)
      })

      const noteInput = screen.getByLabelText('Note (optional)')
      await act(async () => {
        fireEvent.change(noteInput, { target: { value: 'Feeling like I want to hurt myself' } })
      })

      // Crisis Safety Card appears directly under the check-in
      expect(
        screen.getByText(
          "You don't have to carry this alone. Please reach out to your flight surgeon or a crewmate now.",
        ),
      ).toBeDefined()
      expect(
        screen.getByText(
          'This is a demonstration. If you are in a real crisis, contact your local emergency services.',
        ),
      ).toBeDefined()
      expect(screen.getByRole('button', { name: 'Emergency' })).toBeDefined()
    })

    it('renders on a new member profile: empty patterns text and timeline gaps', () => {
      act(() => {
        const id = createProfile({ displayName: 'New Astronaut' })
        setActiveProfile(id)
      })

      render(
        <MemoryRouter>
          <MoodScreen />
        </MemoryRouter>,
      )

      expect(screen.getByText(/check-in due/i)).toBeDefined()
      expect(screen.getByText(/no check-ins/i)).toBeDefined()
      expect(
        screen.getByText('A few more days of check-ins and patterns will show here.'),
      ).toBeDefined()
    })
  })
})
