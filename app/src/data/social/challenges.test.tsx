// Crew challenges in the data layer. Every person and reading here is invented; the member
// profile is a test profile, never a real one.

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addWater,
  createProfile,
  deleteProfileData,
  joinSocial,
  resetDemoProfile,
  setActiveProfile,
  setChallengeJoined,
  useChallenges,
} from '@/data'
import { foods } from '../foods'
import { targetsFor } from '../targets'
import type { CrewProfile, ExerciseSession, ProfileData } from '../types'
import { clearSimulatedTimers } from './background'
import { exerciseScore, nutritionScore, weekSoFar } from './challengeScores'
import {
  pushScores,
  resetChallengesForTests,
  SIMULATED_CHALLENGE_SCORES,
  useChallengeStore,
} from './challenges'
import { setProfileSocial, useSocialStore } from './state'

vi.mock('@/config', () => ({
  config: { chatUrl: '', eventsUrl: '', socialUrl: 'https://crew.test' },
}))

// ---------------------------------------------------------------------------------------------
// A fake crew network that records every request
// ---------------------------------------------------------------------------------------------

type Sent = { method: string; path: string; body: Record<string, unknown> | null }
let sent: Sent[] = []
const MY_ID = 's_test_me'
const FRIEND_ID = 's_test_friend'

function fakeNetwork(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.pathname.replace(/^\/api\/social/, '')
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null
    sent.push({ method: init?.method ?? 'GET', path, body })
    const reply = (value: unknown) =>
      new Response(JSON.stringify(value), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    if (path === '/sync') {
      return reply({
        friends: [{ socialId: FRIEND_ID, handle: 'test_friend' }],
        incoming: [],
        outgoing: [],
        messages: [],
        cursor: '0',
      })
    }
    if (path === '/challenges') {
      return reply({
        exercise: [
          { socialId: FRIEND_ID, handle: 'test_friend', score: 55 },
          { socialId: 's_test_stranger', handle: 'test_stranger', score: 99 },
        ],
        nutrition: [],
      })
    }
    return reply({ ok: true })
  }) as unknown as typeof fetch
}

const challengeCalls = () => sent.filter((s) => s.path === '/challenge' || s.path === '/challenges')

function resetAll() {
  clearSimulatedTimers()
  resetChallengesForTests()
  useSocialStore.setState({ byProfile: {} })
  sent = []
}

/** A member profile already on the network, with an invented token. */
function memberOnNetwork(): string {
  const id = createProfile({ displayName: 'Test member', role: 'Flight engineer' })
  setActiveProfile(id)
  setProfileSocial(id, {
    account: {
      profileId: id,
      socialId: MY_ID,
      handle: 'test_me',
      shareMood: false,
      joinedAt: new Date().toISOString(),
      token: 't'.repeat(64),
    },
    people: {
      [FRIEND_ID]: {
        socialId: FRIEND_ID,
        handle: 'test_friend',
        relation: 'friend',
        mood: null,
        unread: 0,
        source: 'entered',
      },
    },
    messages: [],
    cursor: null,
    sharedMood: null,
  })
  return id
}

// ---------------------------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------------------------

const profile: CrewProfile = {
  id: 'score-test',
  displayName: 'Score test',
  role: 'Flight engineer',
  kind: 'demo',
  massKg: 70,
  consent: { relay: false, assistant: false },
  createdAt: '2026-11-01T08:00:00.000Z',
}

const session = (
  date: string,
  plannedMinutes: number,
  status: ExerciseSession['status'],
  actualMinutes: number,
  device: ExerciseSession['device'] = 'treadmill',
): ExerciseSession => ({
  id: `s-${date}-${plannedMinutes}-${status}-${device}`,
  profileId: profile.id,
  date,
  device,
  kind: 'aerobic',
  plannedMinutes,
  actualMinutes,
  status,
  source: 'simulated',
})

describe('challenge scores', () => {
  it('runs a week from Monday', () => {
    // 19 November 2026 is a Thursday; 22 November a Sunday.
    expect(weekSoFar('2026-11-19')).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
    ])
    expect(weekSoFar('2026-11-22')).toHaveLength(7)
    expect(weekSoFar('2026-11-16')).toEqual(['2026-11-16'])
  })

  it('gives the share of planned exercise minutes done this week', () => {
    const sessions = [
      session('2026-11-15', 60, 'done', 60), // last week: not counted
      session('2026-11-16', 60, 'done', 60),
      session('2026-11-17', 30, 'skipped', 0),
      session('2026-11-18', 30, 'changed', 15),
      session('2026-11-19', 30, 'planned', 0),
      session('2026-11-19', 20, 'done', 20, 'game'), // extra minutes, not part of the plan
    ]
    // Planned 150 minutes, done 60 + 15 + 20 = 95: 63%.
    expect(exerciseScore(sessions, '2026-11-19')).toBe(63)
    expect(exerciseScore([session('2026-11-16', 30, 'done', 90)], '2026-11-19')).toBe(100)
    expect(exerciseScore([session('2026-11-16', 30, 'planned', 0)], '2026-11-19')).toBe(0)
    // No plan this week: no score, not zero.
    expect(exerciseScore([session('2026-11-15', 60, 'done', 60)], '2026-11-19')).toBeNull()
    expect(exerciseScore([], '2026-11-19')).toBeNull()
  })

  it('counts the days with energy, water and protein all on target', () => {
    const targets = targetsFor(profile, new Date(2026, 6, 1))
    const food = foods.find((f) => f.kcal > 0 && f.proteinG > 0)
    if (!food) throw new Error('The food list has no food with energy and protein.')
    const portions = Math.ceil(
      Math.max(targets.energyKcal.value / food.kcal, targets.proteinG.value / food.proteinG),
    )
    const at = (date: string) => new Date(`${date}T12:00:00`).toISOString()
    const fullDay = (date: string) => ({
      meals: [
        {
          id: `m-${date}`,
          profileId: profile.id,
          at: at(date),
          foodId: food.id,
          portions,
          source: 'simulated' as const,
        },
      ],
      water: [
        {
          id: `w-${date}`,
          profileId: profile.id,
          at: at(date),
          ml: targets.waterMl.value,
          source: 'simulated' as const,
        },
      ],
    })
    const days = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-19'].map(fullDay)
    const data: ProfileData = {
      sleep: [],
      sessions: [],
      moods: [],
      bodyMass: [],
      vitals: [],
      meals: days.flatMap((d) => d.meals),
      water: [
        ...days.flatMap((d) => d.water),
        // Wednesday: water only, and too little.
        { id: 'w-wed', profileId: profile.id, at: at('2026-11-18'), ml: 300, source: 'simulated' },
      ],
    }
    // Thursday 23:30, so today is compared with the full target. Sunday 15th is last week.
    const now = new Date('2026-11-19T23:30:00')
    expect(nutritionScore(data, targets, now)).toBe(3)
    // Nothing eaten or drunk this week: no score.
    const lastWeekOnly: ProfileData = { ...data, meals: days[0]!.meals, water: days[0]!.water }
    expect(nutritionScore(lastWeekOnly, targets, now)).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------
// Joining, sending and boards
// ---------------------------------------------------------------------------------------------

describe('crew challenges', () => {
  let memberId: string | null = null

  beforeEach(() => {
    localStorage.clear()
    resetDemoProfile()
    setActiveProfile('demo')
    resetAll()
    vi.stubGlobal('fetch', fakeNetwork())
  })

  afterEach(() => {
    setActiveProfile('demo')
    if (memberId) deleteProfileData(memberId)
    memberId = null
    resetAll()
    vi.unstubAllGlobals()
  })

  it('needs a social account', async () => {
    expect(await setChallengeJoined('exercise', true)).toBe('not-joined')
    const { result } = renderHook(() => useChallenges())
    expect(result.current.exercise).toMatchObject({ id: 'exercise', joined: false, entries: [] })
    expect(result.current.nutrition).toMatchObject({ id: 'nutrition', joined: false, entries: [] })
  })

  it('fills the demo boards from the simulated crew, on the device only', async () => {
    await joinSocial('demo_star', false)
    const { result } = renderHook(() => useChallenges())
    expect(result.current.exercise.joined).toBe(false)

    await act(async () => {
      expect(await setChallengeJoined('exercise', true)).toBe('ok')
      expect(await setChallengeJoined('nutrition', true)).toBe('ok')
    })
    for (const board of [result.current.exercise, result.current.nutrition]) {
      expect(board.joined).toBe(true)
      const others = board.entries.filter((e) => !e.me)
      expect(others.map((e) => e.handle).sort()).toEqual(['kestrel_9', 'lunar_lark'])
      for (const entry of board.entries) expect(entry.source).toBe('simulated')
      expect(
        others.every((e) => e.score === SIMULATED_CHALLENGE_SCORES[e.socialId]?.[board.id]),
      ).toBe(true)
      const scores = board.entries.map((e) => e.score)
      expect(scores).toEqual([...scores].sort((a, b) => b - a))
      if (board.myScore !== null) expect(board.entries.filter((e) => e.me)).toHaveLength(1)
    }

    await act(async () => {
      await setChallengeJoined('exercise', false)
    })
    expect(result.current.exercise).toMatchObject({ joined: false, entries: [] })
    expect(result.current.nutrition.joined).toBe(true)
    expect(challengeCalls()).toEqual([])
  })

  it('never carries a challenge over to another profile', async () => {
    await joinSocial('demo_star', false)
    await setChallengeJoined('exercise', true)
    memberId = memberOnNetwork()
    const { result } = renderHook(() => useChallenges())
    expect(result.current.exercise.joined).toBe(false)
    setActiveProfile('demo')
    expect(useChallengeStore.getState().byProfile.demo?.joined.exercise).toBe(true)
  })

  it('sends nothing for a member who has not joined a challenge', async () => {
    memberId = memberOnNetwork()
    addWater(400)
    await pushScores()
    const { unmount } = renderHook(() => useChallenges())
    await act(async () => {
      await Promise.resolve()
    })
    unmount()
    expect(challengeCalls()).toEqual([])
  })

  it('sends only id and score, then id and leave', async () => {
    memberId = memberOnNetwork()
    await setChallengeJoined('exercise', true)
    const posts = () => sent.filter((s) => s.path === '/challenge')
    // A new member has today's plan and nothing done yet: a real score of 0.
    expect(posts()).toEqual([
      { method: 'POST', path: '/challenge', body: { id: 'exercise', score: 0 } },
    ])

    await setChallengeJoined('exercise', false)
    expect(posts().at(-1)).toEqual({
      method: 'POST',
      path: '/challenge',
      body: { id: 'exercise', leave: true },
    })
    for (const call of challengeCalls()) {
      if (call.method === 'GET') {
        expect(call.body).toBeNull()
        continue
      }
      const keys = Object.keys(call.body ?? {}).sort()
      expect([
        ['id', 'score'],
        ['id', 'leave'],
      ]).toContainEqual(keys)
    }
  })

  it('does not send nutrition as zero when nothing is logged this week', async () => {
    memberId = memberOnNetwork()
    await setChallengeJoined('nutrition', true)
    expect(sent.filter((s) => s.path === '/challenge')).toEqual([])
    const { result } = renderHook(() => useChallenges())
    expect(result.current.nutrition).toMatchObject({ joined: true, myScore: null })
    expect(result.current.nutrition.entries.some((e) => e.me)).toBe(false)
  })

  it('sends a changed score at most once a minute', async () => {
    memberId = memberOnNetwork()
    const t0 = new Date()
    await setChallengeJoined('exercise', true)
    const posts = () => sent.filter((s) => s.path === '/challenge')
    expect(posts()).toHaveLength(1)
    // Mark today's sessions done: the score changes.
    const { useDataStore } = await import('../store')
    useDataStore.setState((s) => {
      const data = s.data[memberId!]
      if (!data) return {}
      const sessions = data.sessions.map((x) => ({
        ...x,
        status: 'done' as const,
        actualMinutes: x.plannedMinutes,
      }))
      return { data: { ...s.data, [memberId!]: { ...data, sessions } } }
    })
    await pushScores(new Date(t0.getTime() + 10_000))
    expect(posts()).toHaveLength(1)
    await pushScores(new Date(t0.getTime() + 61_000))
    expect(posts()).toHaveLength(2)
    expect(posts()[1]?.body).toEqual({ id: 'exercise', score: 100 })
  })

  it('shows friends from the network, never a stranger, with my score from this device', async () => {
    memberId = memberOnNetwork()
    const { result } = renderHook(() => useChallenges())
    await act(async () => {
      await setChallengeJoined('exercise', true)
    })
    const board = result.current.exercise
    expect(board.entries.map((e) => [e.handle, e.score, e.me, e.source])).toEqual([
      ['test_friend', 55, false, 'entered'],
      ['test_me', 0, true, 'entered'],
    ])
  })
})
