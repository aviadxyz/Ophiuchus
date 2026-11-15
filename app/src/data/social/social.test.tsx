import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptFriendRequest,
  addMoodCheckin,
  cancelFriendRequest,
  createProfile,
  declineFriendRequest,
  deleteProfileData,
  joinSocial,
  leaveSocial,
  markConversationRead,
  removeFriend,
  resetDemoProfile,
  sendChatMessage,
  sendFriendRequest,
  setActiveProfile,
  setShareMood,
  useConversation,
  useFriendRequests,
  useFriends,
  useMySharedMood,
  useSocialAccount,
  useSocialSearch,
} from '@/data'
import { clearSimulatedTimers } from './background'
import { SIMULATED_ACCEPT_MS, SIMULATED_CREW, SIMULATED_REPLY_MS } from './simulatedCrew'
import { getProfileSocial, setProfileSocial, SOCIAL_STORE_KEY, useSocialStore } from './state'

function resetSocial() {
  clearSimulatedTimers()
  useSocialStore.setState({ byProfile: {} })
}

describe('crew network on the demo profile (simulated)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDemoProfile()
    setActiveProfile('demo')
    resetSocial()
  })
  afterEach(() => {
    vi.useRealTimers()
    resetSocial()
  })

  it('starts not joined, in simulated mode, with nobody to find', () => {
    const { result } = renderHook(() => ({
      account: useSocialAccount(),
      search: useSocialSearch(''),
    }))
    expect(result.current.account).toEqual({ account: null, connection: 'simulated' })
    expect(result.current.search).toEqual([])
  })

  it('checks the handle and never takes a simulated crew handle', async () => {
    expect(await joinSocial('ab', false)).toBe('invalid')
    expect(await joinSocial('has space', false)).toBe('invalid')
    expect(await joinSocial('a'.repeat(21), false)).toBe('invalid')
    expect(await joinSocial('LUNAR_LARK', false)).toBe('taken')
    expect(await joinSocial('demo_star', false)).toBe('ok')
  })

  it('gives two friends with moods, one waiting request and three people to find', async () => {
    await joinSocial('demo_star', false)
    const { result } = renderHook(() => ({
      account: useSocialAccount(),
      friends: useFriends(),
      requests: useFriendRequests(),
      search: useSocialSearch(''),
    }))
    expect(result.current.account.account?.handle).toBe('demo_star')
    expect(result.current.account.account).not.toHaveProperty('token')

    const friends = result.current.friends
    expect(friends).toHaveLength(2)
    for (const friend of friends) {
      expect(friend.source).toBe('simulated')
      expect(friend.mood?.source).toBe('simulated')
      expect(friend.mood?.tags.length).toBeLessThanOrEqual(2)
    }
    expect(result.current.requests.incoming).toHaveLength(1)
    expect(result.current.requests.incoming[0].mood).toBeNull()
    expect(result.current.requests.outgoing).toHaveLength(0)

    const strangers = result.current.search.filter((p) => p.relation === 'none')
    expect(strangers).toHaveLength(3)
    expect(strangers.every((p) => p.mood === null)).toBe(true)
    expect(result.current.search).toHaveLength(SIMULATED_CREW.length)

    const conversation = renderHook(() => useConversation(friends[0].socialId)).result.current
    expect(conversation.length).toBeGreaterThan(0)
  })

  it('finds people by part of their handle, ignoring case', async () => {
    await joinSocial('demo_star', false)
    const { result } = renderHook(() => useSocialSearch('COMET'))
    expect(result.current.map((p) => p.handle)).toEqual(['quiet_comet'])
  })

  it('accepts a request to a simulated person after about three seconds', async () => {
    vi.useFakeTimers()
    await joinSocial('demo_star', false)
    expect(await sendFriendRequest('sim-redshift')).toBe('ok')
    expect(getProfileSocial('demo').people['sim-redshift'].relation).toBe('outgoing')
    act(() => vi.advanceTimersByTime(SIMULATED_ACCEPT_MS))
    const person = getProfileSocial('demo').people['sim-redshift']
    expect(person.relation).toBe('friend')
    expect(person.mood?.score).toBeGreaterThanOrEqual(1)
  })

  it('cancels, accepts, declines and removes without skipping a step', async () => {
    vi.useFakeTimers()
    await joinSocial('demo_star', false)
    const people = () => getProfileSocial('demo').people

    await sendFriendRequest('sim-blue-marble')
    await cancelFriendRequest('sim-blue-marble')
    act(() => vi.advanceTimersByTime(SIMULATED_ACCEPT_MS))
    expect(people()['sim-blue-marble'].relation).toBe('none')

    await acceptFriendRequest('sim-quiet-comet') // not incoming: nothing happens
    expect(people()['sim-quiet-comet'].relation).toBe('none')

    await acceptFriendRequest('sim-orbit-owl')
    expect(people()['sim-orbit-owl'].relation).toBe('friend')

    await removeFriend('sim-lunar-lark')
    expect(people()['sim-lunar-lark'].relation).toBe('none')
    expect(people()['sim-lunar-lark'].mood).toBeNull()
    const { result } = renderHook(() => useConversation('sim-lunar-lark'))
    expect(result.current).toEqual([])
  })

  it('declines an incoming request', async () => {
    await joinSocial('demo_star', false)
    await declineFriendRequest('sim-orbit-owl')
    expect(getProfileSocial('demo').people['sim-orbit-owl'].relation).toBe('none')
  })

  it('answers a chat message after about two seconds and counts it as unread', async () => {
    vi.useFakeTimers()
    await joinSocial('demo_star', false)
    markConversationRead('sim-kestrel-9')
    expect(await sendChatMessage('sim-kestrel-9', '  Hang in there  ')).toBe('ok')

    const { result } = renderHook(() => ({
      conversation: useConversation('sim-kestrel-9'),
      friends: useFriends(),
    }))
    expect(result.current.conversation.at(-1)).toMatchObject({ text: 'Hang in there', status: 'sent' })
    expect(result.current.friends[0].socialId).toBe('sim-kestrel-9') // newest message first

    act(() => vi.advanceTimersByTime(SIMULATED_REPLY_MS))
    expect(result.current.conversation.at(-1)?.fromId).toBe('sim-kestrel-9')
    expect(result.current.friends.find((f) => f.socialId === 'sim-kestrel-9')?.unread).toBe(1)

    act(() => markConversationRead('sim-kestrel-9'))
    expect(result.current.friends.find((f) => f.socialId === 'sim-kestrel-9')?.unread).toBe(0)
  })

  it('refuses an empty, too long or non-friend message', async () => {
    await joinSocial('demo_star', false)
    expect(await sendChatMessage('sim-kestrel-9', '   ')).toBe('invalid')
    expect(await sendChatMessage('sim-kestrel-9', 'x'.repeat(501))).toBe('invalid')
    expect(await sendChatMessage('sim-redshift', 'Hello')).toBe('invalid')
    expect(await sendChatMessage('sim-kestrel-9', 'x'.repeat(500))).toBe('ok')
  })

  it('shares the latest check-in, never the note, and clears when sharing is off', async () => {
    await joinSocial('demo_star', true)
    const { result } = renderHook(() => useMySharedMood())

    act(() => addMoodCheckin(2, ['Tired', 'Lonely', 'Stressed'], 'A private note'))
    expect(result.current).toMatchObject({ score: 2, tags: ['Tired', 'Lonely'], source: 'entered' })
    expect(JSON.stringify(result.current)).not.toContain('private note')
    expect(JSON.stringify(useSocialStore.getState())).not.toContain('private note')

    await act(async () => {
      await setShareMood(false)
    })
    expect(result.current).toBeNull()

    await act(async () => {
      await setShareMood(true)
    })
    expect(result.current?.score).toBe(2)
  })

  it('leaving removes the account, friendships and messages from this device', async () => {
    await joinSocial('demo_star', true)
    expect(await leaveSocial()).toBe('ok')
    expect(useSocialStore.getState().byProfile.demo).toBeUndefined()
    const { result } = renderHook(() => ({ account: useSocialAccount(), friends: useFriends() }))
    expect(result.current.account.account).toBeNull()
    expect(result.current.friends).toEqual([])
  })

  it('starts the crew over when the demo profile is reset', async () => {
    await joinSocial('demo_star', false)
    resetDemoProfile()
    expect(useSocialStore.getState().byProfile.demo).toBeUndefined()
  })
})

describe('crew network on a member profile without VITE_SOCIAL_URL', () => {
  let memberId = ''

  beforeEach(() => {
    localStorage.clear()
    resetDemoProfile()
    resetSocial()
    memberId = createProfile({ displayName: 'Test member', role: 'Flight engineer' })
    setActiveProfile(memberId)
  })
  afterEach(() => {
    setActiveProfile('demo')
    deleteProfileData(memberId)
    resetSocial()
  })

  it('reports off and returns offline or empty results without error', async () => {
    const { result } = renderHook(() => ({
      account: useSocialAccount(),
      search: useSocialSearch(''),
      friends: useFriends(),
      requests: useFriendRequests(),
      conversation: useConversation('sim-kestrel-9'),
      mood: useMySharedMood(),
    }))
    expect(result.current.account).toEqual({ account: null, connection: 'off' })
    expect(result.current.search).toEqual([])
    expect(result.current.friends).toEqual([])
    expect(result.current.requests).toEqual({ incoming: [], outgoing: [] })
    expect(result.current.conversation).toEqual([])
    expect(result.current.mood).toBeNull()

    expect(await joinSocial('member_one', true)).toBe('offline')
    expect(await joinSocial('x', true)).toBe('invalid')
    expect(await leaveSocial()).toBe('ok')
    expect(await setShareMood(true)).toBe('ok')
    expect(await sendFriendRequest('sim-redshift')).toBe('ok')
    expect(await sendChatMessage('sim-kestrel-9', 'Hello')).toBe('invalid')
    expect(() => markConversationRead('sim-kestrel-9')).not.toThrow()
    expect(useSocialStore.getState().byProfile[memberId]).toBeUndefined()
  })

  it('never receives a simulated person, even after the demo profile joined', async () => {
    setActiveProfile('demo')
    await joinSocial('demo_star', false)
    setActiveProfile(memberId)
    const { result } = renderHook(() => ({
      search: useSocialSearch(''),
      friends: useFriends(),
      requests: useFriendRequests(),
    }))
    expect(result.current.search).toEqual([])
    expect(result.current.friends).toEqual([])
    expect(result.current.requests.incoming).toEqual([])
  })

  it('keeps what was last received when the network is off, and refuses writes', async () => {
    setProfileSocial(memberId, {
      account: {
        profileId: memberId,
        socialId: 'me-1',
        handle: 'member_one',
        shareMood: false,
        joinedAt: new Date().toISOString(),
        token: 'made-up-token',
      },
      people: {
        'p-1': { socialId: 'p-1', handle: 'friend_one', relation: 'friend', mood: null, unread: 0, source: 'entered' },
      },
      messages: [],
      cursor: null,
      sharedMood: null,
    })
    const { result } = renderHook(() => ({ account: useSocialAccount(), friends: useFriends() }))
    expect(result.current.account.connection).toBe('off')
    expect(result.current.friends.map((f) => f.handle)).toEqual(['friend_one'])
    expect(result.current.friends[0].source).toBe('entered')

    expect(await sendChatMessage('p-1', 'Hello')).toBe('offline')
    expect(getProfileSocial(memberId).messages.at(-1)?.status).toBe('failed')
    // A retry of the same text replaces the failed message instead of adding another
    expect(await sendChatMessage('p-1', 'Hello')).toBe('offline')
    expect(getProfileSocial(memberId).messages).toHaveLength(1)

    expect(await removeFriend('p-1')).toBe('offline')
    expect(await setShareMood(true)).toBe('offline')
    expect(await leaveSocial()).toBe('offline')
    expect(getProfileSocial(memberId).people['p-1'].relation).toBe('friend')
  })

  it('forgets everything social when the profile is deleted', () => {
    setProfileSocial(memberId, {
      account: {
        profileId: memberId,
        socialId: 'me-1',
        handle: 'member_one',
        shareMood: false,
        joinedAt: new Date().toISOString(),
        token: null,
      },
      people: {},
      messages: [],
      cursor: null,
      sharedMood: null,
    })
    setActiveProfile('demo')
    deleteProfileData(memberId)
    expect(useSocialStore.getState().byProfile[memberId]).toBeUndefined()
  })
})

describe('saved social data', () => {
  afterEach(() => {
    localStorage.clear()
    resetSocial()
  })

  it('survives corrupted or malformed storage without crashing', async () => {
    localStorage.setItem(SOCIAL_STORE_KEY, '{not json')
    await expect(useSocialStore.persist.rehydrate()).resolves.not.toThrow()
    expect(useSocialStore.getState().byProfile).toEqual({})

    localStorage.setItem(
      SOCIAL_STORE_KEY,
      JSON.stringify({ state: { byProfile: { demo: { account: 7, people: 'x' } } }, version: 1 }),
    )
    await useSocialStore.persist.rehydrate()
    expect(useSocialStore.getState().byProfile).toEqual({})
  })
})
