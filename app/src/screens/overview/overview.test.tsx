import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import {
  createProfile,
  resetDemoProfile,
  setActiveProfile,
  type DaySummary,
  type ExerciseSession,
  type MetricId,
  type MetricValue,
} from '@/data'
import OverviewScreen from './index'
import { routine } from './routine'
import { systemStatus, worstLevel } from './systemStatus'
import { systems } from './systems'

function mockMetric(level: 'ok' | 'watch' | 'act' | 'none', value: number | null = 100): MetricValue {
  return {
    value,
    targetId: 'energyKcal',
    level,
    source: 'entered',
  }
}

function emptySummary(date = '2026-11-14'): DaySummary {
  const mIds: MetricId[] = [
    'sleepHours',
    'energyKcal',
    'waterMl',
    'proteinG',
    'sodiumMg',
    'calciumMg',
    'ironMg',
    'vitaminDIu',
    'omega3G',
    'potassiumMg',
    'exerciseMinutes',
    'moodScore',
    'bodyMassKg',
    'heartRate',
  ]
  const metrics = Object.fromEntries(mIds.map((id) => [id, mockMetric('none', null)])) as Record<
    MetricId,
    MetricValue
  >

  return {
    date,
    ...metrics,
  }
}

describe('worstLevel', () => {
  it('handles empty list', () => {
    expect(worstLevel([])).toBe('none')
  })

  it('handles all none', () => {
    expect(worstLevel(['none'])).toBe('none')
    expect(worstLevel(['none', 'none', 'none'])).toBe('none')
  })

  it('ignores none when mixed with other levels', () => {
    expect(worstLevel(['none', 'ok'])).toBe('ok')
    expect(worstLevel(['ok', 'none'])).toBe('ok')
    expect(worstLevel(['none', 'watch'])).toBe('watch')
    expect(worstLevel(['none', 'act'])).toBe('act')
    expect(worstLevel(['none', 'ok', 'none', 'watch'])).toBe('watch')
  })

  it('correctly resolves each pair of levels', () => {
    expect(worstLevel(['ok', 'ok'])).toBe('ok')
    expect(worstLevel(['ok', 'watch'])).toBe('watch')
    expect(worstLevel(['watch', 'ok'])).toBe('watch')
    expect(worstLevel(['ok', 'act'])).toBe('act')
    expect(worstLevel(['act', 'ok'])).toBe('act')
    expect(worstLevel(['watch', 'watch'])).toBe('watch')
    expect(worstLevel(['watch', 'act'])).toBe('act')
    expect(worstLevel(['act', 'watch'])).toBe('act')
    expect(worstLevel(['act', 'act'])).toBe('act')
    expect(worstLevel(['none', 'none'])).toBe('none')
  })
})

describe('systemStatus', () => {
  it('returns untracked for a system with no metric ids', () => {
    const eyesSystem = systems.find((s) => s.id === 'eyes')!
    expect(eyesSystem.metricIds).toHaveLength(0)

    const summary = emptySummary()
    expect(systemStatus(eyesSystem, summary)).toBe('untracked')
  })

  it('returns none for a tracked system with no data today', () => {
    const brainSystem = systems.find((s) => s.id === 'brain')!
    expect(brainSystem.metricIds.length).toBeGreaterThan(0)

    const summary = emptySummary()
    expect(systemStatus(brainSystem, summary)).toBe('none')
  })

  it('evaluates tracked systems properly based on worst level', () => {
    const brainSystem = systems.find((s) => s.id === 'brain')! // sleepHours, moodScore
    const summary = emptySummary()
    summary.sleepHours = mockMetric('ok', 8)
    summary.moodScore = mockMetric('watch', 3)

    expect(systemStatus(brainSystem, summary)).toBe('watch')

    summary.sleepHours = mockMetric('act', 4)
    expect(systemStatus(brainSystem, summary)).toBe('act')

    summary.sleepHours = mockMetric('ok', 8)
    summary.moodScore = mockMetric('ok', 4)
    expect(systemStatus(brainSystem, summary)).toBe('ok')
  })
})

describe('routine', () => {
  const fixedNow = new Date('2026-11-14T12:00:00')

  it('handles each item when due and when done', () => {
    const summary = emptySummary('2026-11-14')

    // Initial state: everything due or not planned
    const itemsInitial = routine({ today: summary }, fixedNow)
    const sleepInit = itemsInitial.find((i) => i.id === 'sleep')!
    const hrInit = itemsInitial.find((i) => i.id === 'heart-rate')!
    const moodInit = itemsInitial.find((i) => i.id === 'mood')!
    const exerciseInit = itemsInitial.find((i) => i.id === 'exercise')!
    const waterInit = itemsInitial.find((i) => i.id === 'water')!
    const vitDInit = itemsInitial.find((i) => i.id === 'vitamin-d')!
    const weighInInit = itemsInitial.find((i) => i.id === 'weigh-in')!

    expect(sleepInit.state).toBe('due')
    expect(sleepInit.actionRoute).toBe('/sleep')
    expect(hrInit.state).toBe('due')
    expect(hrInit.actionRoute).toBe('/physical-activity')
    expect(moodInit.state).toBe('due')
    expect(moodInit.actionRoute).toBe('/mood')
    expect(exerciseInit.state).toBe('not-planned')
    expect(waterInit.state).toBe('due')
    expect(waterInit.actionLabel).toBe('Add 250 ml')
    expect(vitDInit.state).toBe('due')
    expect(vitDInit.actionRoute).toBe('/nutrition')
    expect(weighInInit.state).toBe('due')
    expect(weighInInit.actionRoute).toBe('/nutrition')

    // Now populate data so that each item is done
    summary.sleepHours = mockMetric('ok', 7.5)
    summary.waterMl = { value: 2200, targetId: 'waterMl', level: 'ok', source: 'entered' }
    summary.vitaminDIu = mockMetric('ok', 800)

    const itemsDone = routine(
      {
        today: summary,
        latestVitals: {
          latest: {
            id: 'v1',
            profileId: 'demo',
            at: '2026-11-14T09:30:00Z',
            heartRate: 68,
            source: 'live',
          },
          connection: 'live',
        },
        moodCheckins: [
          {
            id: 'm1',
            profileId: 'demo',
            at: '2026-11-14T08:15:00Z',
            score: 4,
            tags: ['calm'],
            source: 'entered',
          },
        ],
        exerciseSessions: [
          {
            id: 's1',
            profileId: 'demo',
            date: '2026-11-14',
            device: 'cycle',
            kind: 'aerobic',
            plannedMinutes: 30,
            actualMinutes: 30,
            status: 'done',
            source: 'entered',
          },
        ],
        bodyMassSeries: [
          { date: '2026-11-12', value: 72.4, source: 'entered' },
          { date: '2026-11-14', value: 72.1, source: 'entered' },
        ],
      },
      fixedNow,
    )

    const sleepDone = itemsDone.find((i) => i.id === 'sleep')!
    const hrDone = itemsDone.find((i) => i.id === 'heart-rate')!
    const moodDone = itemsDone.find((i) => i.id === 'mood')!
    const exerciseDone = itemsDone.find((i) => i.id === 'exercise')!
    const waterDone = itemsDone.find((i) => i.id === 'water')!
    const vitDDone = itemsDone.find((i) => i.id === 'vitamin-d')!
    const weighInDone = itemsDone.find((i) => i.id === 'weigh-in')!

    expect(sleepDone.state).toBe('done')
    expect(sleepDone.detail).toBe('7.5 h')
    expect(hrDone.state).toBe('done')
    expect(hrDone.detail).toContain('68 bpm')
    expect(hrDone.source).toBe('live')
    expect(moodDone.state).toBe('done')
    expect(exerciseDone.state).toBe('done')
    expect(exerciseDone.detail).toBe('1 of 1 sessions')
    expect(waterDone.state).toBe('done')
    expect(waterDone.detail).toBe('2.2 L')
    expect(vitDDone.state).toBe('done')
    expect(weighInDone.state).toBe('done')
    expect(weighInDone.detail).toBe('72.1 kg')
  })

  it('correctly handles exercise sessions: no sessions, skipped, and all done', () => {
    const summary = emptySummary('2026-11-14')

    // No sessions: not-planned
    const resNoSessions = routine({ today: summary, exerciseSessions: [] }, fixedNow)
    expect(resNoSessions.find((i) => i.id === 'exercise')?.state).toBe('not-planned')

    // With one skipped: due with '1 skipped'
    const skippedSession: ExerciseSession = {
      id: 's-skip',
      profileId: 'demo',
      date: '2026-11-14',
      device: 'treadmill',
      kind: 'aerobic',
      plannedMinutes: 30,
      actualMinutes: 0,
      status: 'skipped',
      source: 'entered',
    }
    const resSkipped = routine(
      { today: summary, exerciseSessions: [skippedSession] },
      fixedNow,
    )
    const exSkipped = resSkipped.find((i) => i.id === 'exercise')!
    expect(exSkipped.state).toBe('due')
    expect(exSkipped.detail).toBe('1 skipped')

    // With all done: done with '2 of 2 sessions'
    const doneSession1: ExerciseSession = {
      id: 's1',
      profileId: 'demo',
      date: '2026-11-14',
      device: 'cycle',
      kind: 'aerobic',
      plannedMinutes: 30,
      actualMinutes: 30,
      status: 'done',
      source: 'entered',
    }
    const doneSession2: ExerciseSession = {
      id: 's2',
      profileId: 'demo',
      date: '2026-11-14',
      device: 'resistive',
      kind: 'resistive',
      plannedMinutes: 45,
      actualMinutes: 40,
      status: 'changed',
      source: 'entered',
    }

    const resAllDone = routine(
      { today: summary, exerciseSessions: [doneSession1, doneSession2] },
      fixedNow,
    )
    const exAllDone = resAllDone.find((i) => i.id === 'exercise')!
    expect(exAllDone.state).toBe('done')
    expect(exAllDone.detail).toBe('2 of 2 sessions')
  })
})

describe('systems.ts', () => {
  const expectedIds = [
    'brain',
    'eyes',
    'ears',
    'face',
    'heart',
    'lungs',
    'digestive',
    'kidneys',
    'spine',
    'bones',
    'muscles',
    'reproductive',
    'blood',
    'immune',
    'skin',
    'hormones',
  ]

  it('has exactly the sixteen ids in docs/SCREENS.md with no empty text', () => {
    expect(systems).toHaveLength(16)
    const actualIds = systems.map((s) => s.id)
    expect(actualIds).toEqual(expectedIds)

    for (const sys of systems) {
      expect(sys.id.trim().length).toBeGreaterThan(0)
      expect(sys.label.trim().length).toBeGreaterThan(0)
      expect(sys.bodySystem.trim().length).toBeGreaterThan(0)
      expect(['organ', 'whole-body']).toContain(sys.kind)
      expect(sys.whatItDoes.trim().length).toBeGreaterThan(0)
      expect(sys.inSpace.trim().length).toBeGreaterThan(0)
      expect(sys.howChecked.trim().length).toBeGreaterThan(0)
      expect(sys.routes.length).toBeGreaterThan(0)
    }

    const organCount = systems.filter((s) => s.kind === 'organ').length
    const wholeBodyCount = systems.filter((s) => s.kind === 'whole-body').length
    expect(organCount).toBe(12)
    expect(wholeBodyCount).toBe(4)
  })
})

describe('OverviewScreen UI', () => {
  it('renders all sections on the demo profile, handles water increment and drawer interaction', async () => {
    resetDemoProfile()
    setActiveProfile('demo')

    const { unmount } = render(
      <MemoryRouter>
        <OverviewScreen />
      </MemoryRouter>,
    )

    // Header
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByText(/DOMAIN · OVERVIEW/i)).toBeInTheDocument()
    expect(screen.getByText(/MISSION DAY/i)).toBeInTheDocument()

    // 5 Tiles
    expect(screen.getAllByText('Sleep').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Energy').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Water').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Exercise').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Mood').length).toBeGreaterThanOrEqual(1)

    // Routine Card
    expect(screen.getByRole('heading', { level: 2, name: "Today's routine" })).toBeInTheDocument()

    // "Add 250 ml" button works
    const addWaterBtn = screen.queryByRole('button', { name: 'Add 250 ml' })
    if (addWaterBtn) {
      await userEvent.click(addWaterBtn)
    }

    // Body systems: Both the SVG marker and the list item are controls with role="button"
    const brainBtns = screen.getAllByRole('button', { name: /Brain and mind/i })
    expect(brainBtns.length).toBe(2) // 1 in figure, 1 in list
    await userEvent.click(brainBtns[1]) // click list button

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Brain and mind' })).toBeInTheDocument()
    expect(screen.getByText('Based on what you logged today. It is not a medical finding.')).toBeInTheDocument()
    expect(screen.getByText(/WHAT IT DOES/i)).toBeInTheDocument()
    expect(screen.getByText(/IN SPACE/i)).toBeInTheDocument()
    expect(screen.getByText(/HOW IT IS CHECKED ON A MISSION/i)).toBeInTheDocument()
    expect(screen.getByText(/NASA HRP, Risk of Behavioral Conditions/i)).toBeInTheDocument()

    // Close drawer
    const closeBtn = screen.getByRole('button', { name: 'Close' })
    await userEvent.click(closeBtn)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Now test clicking from the SVG marker (brainBtns[0])
    await userEvent.click(brainBtns[0])
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Untracked system drawer shows untracked explanation
    const eyesBtns = screen.getAllByRole('button', { name: /Eyes and vision/i })
    expect(eyesBtns.length).toBe(2)
    await userEvent.click(eyesBtns[0])
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This demo does not measure this system. Here is what space does to it and how it would be checked on a mission.',
      ),
    ).toBeInTheDocument()

    // Close
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    unmount()
  })

  it('renders blank profile cleanly with NO DATA, NOT TRACKED, and no errors', async () => {
    const blankId = createProfile({
      displayName: 'Empty Astronaut',
      role: 'Specialist',
    })
    setActiveProfile(blankId)

    const { unmount } = render(
      <MemoryRouter>
        <OverviewScreen />
      </MemoryRouter>,
    )

    // Tracked systems show NO DATA
    expect(screen.getAllByText('NO DATA').length).toBeGreaterThan(0)
    // Untracked systems show NOT TRACKED
    expect(screen.getAllByText('NOT TRACKED').length).toBeGreaterThan(0)

    // Reset back to demo profile
    setActiveProfile('demo')
    unmount()
  })
})
