// The crew-network write functions of CONTRACTS section 9. Each acts for the active profile.
// Demo profile: runs on the simulated crew in the browser and always succeeds.
// Member profile: goes through the endpoints; when they cannot be reached, returns `offline`
// (or marks a chat message `failed`) and changes nothing else.

import { newId } from '../dates'
import { getActiveProfile } from '../store'
import type { CrewProfile } from '../types'
import {
  apiJoin,
  apiLeave,
  apiMessage,
  apiPeople,
  apiRelation,
  socialEnabled,
} from './api'
import {
  clearSimulatedTimers,
  connectionFor,
  kickSync,
  later,
  refreshSharedMood,
} from './background'
import {
  buildSimulatedCrew,
  isSimulatedHandle,
  isSimulatedId,
  simulatedMood,
  simulatedReply,
  SIMULATED_ACCEPT_MS,
  SIMULATED_REPLY_MS,
} from './simulatedCrew'
import {
  getProfileSocial,
  removeProfileSocial,
  setProfileSocial,
  setReachable,
  updateProfileSocial,
  useSocialRuntime,
  type ProfileSocial,
} from './state'
import {
  HANDLE_PATTERN,
  MAX_MESSAGE_LENGTH,
  type ChatMessage,
  type JoinResult,
  type SendResult,
  type SocialPerson,
  type SocialRelation,
  type SocialWriteResult,
} from './types'

type Context = {
  profile: CrewProfile
  social: ProfileSocial
  mode: 'simulated' | 'live' | 'off'
  token: string | null
}

function context(): Context {
  const profile = getActiveProfile()
  const social = getProfileSocial(profile.id)
  return {
    profile,
    social,
    mode: connectionFor(profile, useSocialRuntime.getState().reachable),
    token: social.account?.token ?? null,
  }
}

/** Runs a network call for a member. Any failure marks the network unreachable. */
async function online<T>(run: (token: string) => Promise<T>, token: string | null): Promise<T | null> {
  if (!token || !socialEnabled()) return null
  try {
    const result = await run(token)
    setReachable(true)
    return result
  } catch {
    setReachable(false)
    return null
  }
}

function setRelation(
  profileId: string,
  socialId: string,
  relation: SocialRelation,
  person?: SocialPerson,
): void {
  updateProfileSocial(profileId, (p) => {
    const before = p.people[socialId] ?? person
    if (!before) return p
    const next: SocialPerson = {
      ...before,
      relation,
      mood:
        relation === 'friend'
          ? (before.mood ?? (isSimulatedId(socialId) ? simulatedMood(socialId, new Date()) : null))
          : null,
      unread: relation === 'friend' ? before.unread : 0,
    }
    const me = p.account?.socialId
    const messages =
      relation === 'friend'
        ? p.messages
        : p.messages.filter((m) => !(m.fromId === socialId && m.toId === me) && !(m.fromId === me && m.toId === socialId))
    return { ...p, people: { ...p.people, [socialId]: next }, messages }
  })
}

/** A person this profile can act on: known locally or found by a live search. */
function findPerson(socialId: string, social: ProfileSocial): SocialPerson | undefined {
  if (social.people[socialId]) return social.people[socialId]
  for (const results of Object.values(useSocialRuntime.getState().searches)) {
    const hit = results.find((p) => p.socialId === socialId)
    if (hit) return hit
  }
  return undefined
}

// ---------------------------------------------------------------------------------------------
// Joining and leaving
// ---------------------------------------------------------------------------------------------

export async function joinSocial(handle: string, shareMood: boolean): Promise<JoinResult> {
  const clean = handle.trim()
  if (!HANDLE_PATTERN.test(clean)) return 'invalid'
  const { profile, social } = context()
  if (social.account) return 'ok'
  const joinedAt = new Date().toISOString()

  if (profile.kind === 'demo') {
    if (isSimulatedHandle(clean)) return 'taken'
    const socialId = newId('social')
    const crew = buildSimulatedCrew(socialId, new Date())
    setProfileSocial(profile.id, {
      account: { profileId: profile.id, socialId, handle: clean, shareMood, joinedAt, token: null },
      people: crew.people,
      messages: crew.messages,
      cursor: null,
      sharedMood: null,
    })
    await refreshSharedMood(profile.id)
    return 'ok'
  }

  if (!socialEnabled()) return 'offline'
  let reply: Awaited<ReturnType<typeof apiJoin>>
  try {
    reply = await apiJoin(clean, profile.role || undefined)
    setReachable(true)
  } catch {
    setReachable(false)
    return 'offline'
  }
  if ('error' in reply) return reply.error
  setProfileSocial(profile.id, {
    account: {
      profileId: profile.id,
      socialId: reply.socialId,
      handle: clean,
      shareMood,
      joinedAt,
      token: reply.token,
    },
    people: {},
    messages: [],
    cursor: null,
    sharedMood: null,
  })
  await refreshSharedMood(profile.id)
  kickSync()
  return 'ok'
}

export async function leaveSocial(): Promise<SocialWriteResult> {
  const { profile, social, mode, token } = context()
  if (!social.account) return 'ok'
  if (profile.kind === 'demo') {
    clearSimulatedTimers()
    removeProfileSocial(profile.id)
    return 'ok'
  }
  if (mode === 'off') return 'offline'
  const ok = await online((t) => apiLeave(t), token)
  if (!ok) return 'offline'
  removeProfileSocial(profile.id)
  return 'ok'
}

export async function setShareMood(on: boolean): Promise<SocialWriteResult> {
  const { profile, social, mode } = context()
  if (!social.account) return 'ok'
  if (mode === 'off') return 'offline'
  updateProfileSocial(profile.id, (p) =>
    p.account ? { ...p, account: { ...p.account, shareMood: on } } : p,
  )
  return (await refreshSharedMood(profile.id)) ? 'ok' : 'offline'
}

// ---------------------------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------------------------

type RelationAction = 'request' | 'cancel' | 'accept' | 'decline' | 'remove'

const RULES: Record<RelationAction, { from: SocialRelation; to: SocialRelation }> = {
  request: { from: 'none', to: 'outgoing' },
  cancel: { from: 'outgoing', to: 'none' },
  accept: { from: 'incoming', to: 'friend' },
  decline: { from: 'incoming', to: 'none' },
  remove: { from: 'friend', to: 'none' },
}

async function changeRelation(socialId: string, action: RelationAction): Promise<SocialWriteResult> {
  const { profile, social, mode, token } = context()
  if (!social.account) return 'ok'
  const person = findPerson(socialId, social)
  const rule = RULES[action]
  if (!person || person.relation !== rule.from) return 'ok'

  if (mode === 'simulated') {
    setRelation(profile.id, socialId, rule.to, person)
    if (action === 'request' && isSimulatedId(socialId)) {
      later(() => {
        if (getProfileSocial(profile.id).people[socialId]?.relation === 'outgoing') {
          setRelation(profile.id, socialId, 'friend')
        }
      }, SIMULATED_ACCEPT_MS)
    }
    return 'ok'
  }
  if (mode === 'off') return 'offline'
  const ok = await online((t) => apiRelation(t, socialId, action), token)
  if (ok === null) return 'offline'
  if (ok) {
    setRelation(profile.id, socialId, rule.to, person)
    kickSync()
  }
  return 'ok'
}

export const sendFriendRequest = (socialId: string) => changeRelation(socialId, 'request')
export const cancelFriendRequest = (socialId: string) => changeRelation(socialId, 'cancel')
export const acceptFriendRequest = (socialId: string) => changeRelation(socialId, 'accept')
export const declineFriendRequest = (socialId: string) => changeRelation(socialId, 'decline')
export const removeFriend = (socialId: string) => changeRelation(socialId, 'remove')

// ---------------------------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------------------------

function setMessage(profileId: string, id: string, change: Partial<ChatMessage>): void {
  updateProfileSocial(profileId, (p) => ({
    ...p,
    messages: p.messages.map((m) => (m.id === id ? { ...m, ...change } : m)),
  }))
}

/**
 * Sends a message to a friend: 1 to 500 characters. Sending the same text again after a failure
 * replaces the failed message, so a retry never leaves a duplicate.
 */
export async function sendChatMessage(socialId: string, text: string): Promise<SendResult> {
  const clean = text.trim()
  if (clean.length < 1 || clean.length > MAX_MESSAGE_LENGTH) return 'invalid'
  const { profile, social, mode, token } = context()
  const me = social.account?.socialId
  if (!me || social.people[socialId]?.relation !== 'friend') return 'invalid'

  const message: ChatMessage = {
    id: newId('msg'),
    fromId: me,
    toId: socialId,
    at: new Date().toISOString(),
    text: clean,
    status: mode === 'simulated' ? 'sent' : mode === 'off' ? 'failed' : 'sending',
  }
  updateProfileSocial(profile.id, (p) => ({
    ...p,
    messages: [
      ...p.messages.filter((m) => !(m.status === 'failed' && m.toId === socialId && m.text === clean)),
      message,
    ],
  }))

  if (mode === 'simulated') {
    later(() => {
      const current = getProfileSocial(profile.id)
      const friend = current.people[socialId]
      if (!current.account || friend?.relation !== 'friend') return
      const theirs = current.messages.filter((m) => m.fromId === socialId).length
      updateProfileSocial(profile.id, (p) => ({
        ...p,
        people: { ...p.people, [socialId]: { ...friend, unread: friend.unread + 1 } },
        messages: [
          ...p.messages,
          {
            id: newId('msg'),
            fromId: socialId,
            toId: me,
            at: new Date().toISOString(),
            text: simulatedReply(theirs),
            status: 'sent',
          },
        ],
      }))
    }, SIMULATED_REPLY_MS)
    return 'ok'
  }
  if (mode === 'off') return 'offline'

  const serverId = await online((t) => apiMessage(t, socialId, clean), token)
  if (!serverId) {
    setMessage(profile.id, message.id, { status: 'failed' })
    return 'offline'
  }
  setMessage(profile.id, message.id, { id: serverId, status: 'sent' })
  return 'ok'
}

export function markConversationRead(socialId: string): void {
  const { profile } = context()
  updateProfileSocial(profile.id, (p) => {
    const person = p.people[socialId]
    if (!person || person.unread === 0) return p
    return { ...p, people: { ...p.people, [socialId]: { ...person, unread: 0 } } }
  })
}

// ---------------------------------------------------------------------------------------------
// Live search, used by useSocialSearch
// ---------------------------------------------------------------------------------------------

export async function searchPeopleLive(query: string): Promise<void> {
  const { mode, token } = context()
  if (mode !== 'live') return
  const people = await online((t) => apiPeople(t, query), token)
  if (!people) return
  useSocialRuntime.setState((s) => ({ searches: { ...s.searches, [query]: people } }))
}
