// The crew network's own small store, kept per profile and saved under ophiuchus:v1:social.
// It holds the account (with its token), the people this profile knows, the conversations and
// the mood that was last shared. The token never leaves this folder.

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { safeStorage, STORAGE_PREFIX } from '../persistence'
import type { ChatMessage, SharedMood, SocialAccount, SocialPerson } from './types'

export const SOCIAL_STORE_KEY = `${STORAGE_PREFIX}social`

/** Messages kept per profile on this device. */
const MAX_MESSAGES = 1000

export type StoredAccount = SocialAccount & {
  /** From `join` on the real network. Null for the demo profile. Never given to a screen. */
  token: string | null
}

export type ProfileSocial = {
  account: StoredAccount | null
  people: Record<string, SocialPerson>
  messages: ChatMessage[]
  cursor: string | null
  /** Exactly what friends see right now: what was last published. */
  sharedMood: SharedMood | null
}

type SocialState = { byProfile: Record<string, ProfileSocial> }

/** The same object every time, so hooks that read a profile with nothing stored stay stable. */
export const EMPTY_PROFILE_SOCIAL: ProfileSocial = Object.freeze({
  account: null,
  people: Object.freeze({}) as Record<string, SocialPerson>,
  messages: Object.freeze([]) as unknown as ChatMessage[],
  cursor: null,
  sharedMood: null,
})

// ---------------------------------------------------------------------------------------------
// Reading saved data: anything malformed is dropped, never thrown
// ---------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isSource = (v: unknown) =>
  v === 'live' || v === 'entered' || v === 'imported' || v === 'simulated'

export function sanitizeMood(v: unknown): SharedMood | null {
  if (!isObj(v)) return null
  const score = v.score
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) return null
  if (!isStr(v.at) || !isSource(v.source)) return null
  const tags = Array.isArray(v.tags) ? v.tags.filter(isStr).slice(0, 2) : []
  return { score, tags, at: v.at, source: v.source as SharedMood['source'] }
}

export function sanitizePerson(v: unknown, fallbackSource: SocialPerson['source']): SocialPerson | null {
  if (!isObj(v) || !isStr(v.socialId) || !isStr(v.handle)) return null
  const relation = ['none', 'outgoing', 'incoming', 'friend'].includes(v.relation as string)
    ? (v.relation as SocialPerson['relation'])
    : 'none'
  const unread = typeof v.unread === 'number' && v.unread > 0 ? Math.floor(v.unread) : 0
  return {
    socialId: v.socialId,
    handle: v.handle,
    ...(isStr(v.role) ? { role: v.role } : {}),
    relation,
    mood: relation === 'friend' ? sanitizeMood(v.mood) : null,
    unread,
    source: v.source === 'simulated' || v.source === 'entered' ? v.source : fallbackSource,
  }
}

export function sanitizeMessage(v: unknown): ChatMessage | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.fromId) || !isStr(v.toId) || !isStr(v.at)) return null
  if (typeof v.text !== 'string' || v.text.length === 0) return null
  const status = ['sending', 'sent', 'failed'].includes(v.status as string)
    ? (v.status as ChatMessage['status'])
    : 'sent'
  return { id: v.id, fromId: v.fromId, toId: v.toId, at: v.at, text: v.text, status }
}

function sanitizeAccount(v: unknown, profileId: string): StoredAccount | null {
  if (!isObj(v) || !isStr(v.socialId) || !isStr(v.handle) || !isStr(v.joinedAt)) return null
  return {
    profileId,
    socialId: v.socialId,
    handle: v.handle,
    shareMood: v.shareMood === true,
    joinedAt: v.joinedAt,
    token: isStr(v.token) ? v.token : null,
  }
}

function sanitizeProfileSocial(v: unknown, profileId: string): ProfileSocial | null {
  if (!isObj(v)) return null
  const account = sanitizeAccount(v.account, profileId)
  if (!account) return null
  const fallback = account.token ? 'entered' : 'simulated'
  const people: Record<string, SocialPerson> = {}
  if (isObj(v.people)) {
    for (const raw of Object.values(v.people)) {
      const person = sanitizePerson(raw, fallback)
      if (person) people[person.socialId] = person
    }
  }
  const messages = Array.isArray(v.messages)
    ? v.messages.map(sanitizeMessage).filter((m): m is ChatMessage => m !== null)
    : []
  return {
    account,
    people,
    // A message still "sending" when the page closed was never confirmed.
    messages: messages.map((m) => (m.status === 'sending' ? { ...m, status: 'failed' } : m)),
    cursor: isStr(v.cursor) ? v.cursor : null,
    sharedMood: sanitizeMood(v.sharedMood),
  }
}

// ---------------------------------------------------------------------------------------------
// The saved store
// ---------------------------------------------------------------------------------------------

export const useSocialStore = create<SocialState>()(
  persist(() => ({ byProfile: {} }), {
    name: SOCIAL_STORE_KEY,
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    merge: (persisted, current) => {
      if (!isObj(persisted) || !isObj(persisted.byProfile)) return current
      const byProfile: Record<string, ProfileSocial> = {}
      for (const [profileId, raw] of Object.entries(persisted.byProfile)) {
        const clean = sanitizeProfileSocial(raw, profileId)
        if (clean) byProfile[profileId] = clean
      }
      return { ...current, byProfile }
    },
  }),
)

export function getProfileSocial(profileId: string): ProfileSocial {
  return useSocialStore.getState().byProfile[profileId] ?? EMPTY_PROFILE_SOCIAL
}

/** Changes one profile's social state. Does nothing for a profile that has not joined. */
export function updateProfileSocial(
  profileId: string,
  change: (current: ProfileSocial) => ProfileSocial,
): void {
  useSocialStore.setState((state) => {
    const current = state.byProfile[profileId]
    if (!current) return {}
    const next = change(current)
    const messages =
      next.messages.length > MAX_MESSAGES ? next.messages.slice(-MAX_MESSAGES) : next.messages
    return { byProfile: { ...state.byProfile, [profileId]: { ...next, messages } } }
  })
}

export function setProfileSocial(profileId: string, value: ProfileSocial): void {
  useSocialStore.setState((state) => ({ byProfile: { ...state.byProfile, [profileId]: value } }))
}

/** Forgets everything social for one profile on this device. */
export function removeProfileSocial(profileId: string): void {
  useSocialStore.setState((state) => {
    if (!(profileId in state.byProfile)) return {}
    const { [profileId]: removed, ...rest } = state.byProfile
    void removed
    return { byProfile: rest }
  })
}

// ---------------------------------------------------------------------------------------------
// State that is never saved
// ---------------------------------------------------------------------------------------------

type SocialRuntime = {
  /** The real network answered the last call. */
  reachable: boolean
  /** Live search results by query, as the server sent them. */
  searches: Record<string, SocialPerson[]>
  /** How many social hooks are mounted, to poll faster while the Social screen is in use. */
  watchers: number
}

export const useSocialRuntime = create<SocialRuntime>()(() => ({
  reachable: false,
  searches: {},
  watchers: 0,
}))

export function setReachable(reachable: boolean): void {
  if (useSocialRuntime.getState().reachable !== reachable) useSocialRuntime.setState({ reachable })
}
