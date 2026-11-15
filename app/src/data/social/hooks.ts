// The crew-network hooks of CONTRACTS section 9. Each reads the active profile. A mood is only
// ever given for a friend, and the token is never part of anything returned here.

import { useEffect, useMemo } from 'react'
import { getActiveProfile, useDataStore } from '../store'
import { searchPeopleLive } from './actions'
import { connectionFor, kickSync } from './background'
import { EMPTY_PROFILE_SOCIAL, useSocialRuntime, useSocialStore, type ProfileSocial } from './state'
import type {
  ChatMessage,
  FriendRequests,
  SharedMood,
  SocialAccountState,
  SocialPerson,
} from './types'

const MAX_SUGGESTIONS = 20
const SEARCH_DELAY_MS = 250

/** Counts mounted social hooks, so live sync runs every 3 seconds while the screen is in use. */
function useWatch(): void {
  useEffect(() => {
    useSocialRuntime.setState((s) => ({ watchers: s.watchers + 1 }))
    kickSync()
    return () => {
      useSocialRuntime.setState((s) => ({ watchers: Math.max(0, s.watchers - 1) }))
    }
  }, [])
}

function useMine(): { social: ProfileSocial; connection: SocialAccountState['connection'] } {
  const profile = useDataStore(getActiveProfile)
  const social = useSocialStore((s) => s.byProfile[profile.id] ?? EMPTY_PROFILE_SOCIAL)
  const reachable = useSocialRuntime((s) => s.reachable)
  return { social, connection: connectionFor(profile, reachable) }
}

/** What a screen may see of a person: the mood only for a friend. */
function view(person: SocialPerson): SocialPerson {
  return person.relation === 'friend' ? person : { ...person, mood: null }
}

function byHandle(a: SocialPerson, b: SocialPerson): number {
  return a.handle.localeCompare(b.handle)
}

export function useSocialAccount(): SocialAccountState {
  useWatch()
  const { social, connection } = useMine()
  const account = social.account
  return useMemo(
    () => ({
      account: account
        ? {
            profileId: account.profileId,
            socialId: account.socialId,
            handle: account.handle,
            shareMood: account.shareMood,
            joinedAt: account.joinedAt,
          }
        : null,
      connection,
    }),
    [account, connection],
  )
}

export function useSocialSearch(query: string): SocialPerson[] {
  useWatch()
  const { social, connection } = useMine()
  const q = query.trim().toLowerCase()
  const liveResults = useSocialRuntime((s) => s.searches[q])

  useEffect(() => {
    if (connection !== 'live' || !social.account) return
    const timer = setTimeout(() => void searchPeopleLive(q), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [connection, q, social.account])

  return useMemo(() => {
    const me = social.account?.socialId
    if (!me) return []
    const known = social.people
    const source =
      connection === 'live' && liveResults
        ? liveResults.map((p) => known[p.socialId] ?? p)
        : Object.values(known)
    const matches = source
      .filter((p) => p.socialId !== me)
      .filter((p) => (q ? p.handle.toLowerCase().includes(q) : true))
      .map(view)
      .sort(byHandle)
    return q ? matches : matches.slice(0, MAX_SUGGESTIONS)
  }, [social, connection, liveResults, q])
}

export function useFriends(): SocialPerson[] {
  useWatch()
  const { social } = useMine()
  return useMemo(() => {
    const me = social.account?.socialId
    const newest = new Map<string, string>()
    for (const m of social.messages) {
      const other = m.fromId === me ? m.toId : m.fromId
      const before = newest.get(other)
      if (!before || m.at > before) newest.set(other, m.at)
    }
    return Object.values(social.people)
      .filter((p) => p.relation === 'friend')
      .sort((a, b) => {
        const at = newest.get(a.socialId) ?? ''
        const bt = newest.get(b.socialId) ?? ''
        return at === bt ? byHandle(a, b) : bt.localeCompare(at)
      })
  }, [social])
}

export function useFriendRequests(): FriendRequests {
  useWatch()
  const { social } = useMine()
  return useMemo(() => {
    const people = Object.values(social.people).sort(byHandle)
    return {
      incoming: people.filter((p) => p.relation === 'incoming').map(view),
      outgoing: people.filter((p) => p.relation === 'outgoing').map(view),
    }
  }, [social])
}

export function useConversation(socialId: string): ChatMessage[] {
  useWatch()
  const { social } = useMine()
  return useMemo(() => {
    const me = social.account?.socialId
    if (!me) return []
    return social.messages
      .filter(
        (m) =>
          (m.fromId === socialId && m.toId === me) || (m.fromId === me && m.toId === socialId),
      )
      .sort((a, b) => a.at.localeCompare(b.at))
  }, [social, socialId])
}

export function useMySharedMood(): SharedMood | null {
  useWatch()
  return useMine().social.sharedMood
}
