// The client for the crew-network endpoints (CONTRACTS section 11). Used only for a member
// profile when VITE_SOCIAL_URL is set. The token travels in the Authorization header and is
// never logged. A network failure throws `SocialOffline`; the caller turns it into `offline`.

import { config } from '@/config'
import { sanitizeMessage, sanitizePerson } from './state'
import type { ChatMessage, SharedMood, SocialPerson } from './types'

const TIMEOUT_MS = 8000

export class SocialOffline extends Error {
  constructor() {
    super('The crew network cannot be reached.')
  }
}

export function socialEnabled(): boolean {
  return config.socialUrl.length > 0
}

function endpoint(path: string): string {
  const base = config.socialUrl
  const root = base.endsWith('/api/social') ? base : `${base}/api/social`
  return `${root}${path}`
}

type Reply = { status: number; body: Record<string, unknown> }

async function call(
  method: 'GET' | 'POST',
  path: string,
  token: string | null,
  body?: Record<string, unknown>,
): Promise<Reply> {
  if (!socialEnabled()) throw new SocialOffline()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(endpoint(path), {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    let parsed: unknown = {}
    try {
      parsed = await response.json()
    } catch {
      parsed = {}
    }
    if (response.status >= 500) throw new SocialOffline()
    return {
      status: response.status,
      body: typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {},
    }
  } catch (error) {
    if (error instanceof SocialOffline) throw error
    throw new SocialOffline()
  } finally {
    clearTimeout(timer)
  }
}

/** Sets the relation on every raw person before cleaning, so a friend's mood is kept. */
const withRelation = (v: unknown, relation: SocialPerson['relation']): unknown[] =>
  Array.isArray(v)
    ? v.map((p: unknown) => (typeof p === 'object' && p !== null ? { ...p, relation } : p))
    : []

const people = (v: unknown): SocialPerson[] =>
  Array.isArray(v)
    ? v.map((p) => sanitizePerson(p, 'entered')).filter((p): p is SocialPerson => p !== null)
    : []

export async function apiJoin(
  handle: string,
  role: string | undefined,
): Promise<{ socialId: string; token: string } | { error: 'taken' | 'invalid' }> {
  const { body } = await call('POST', '/join', null, { handle, ...(role ? { role } : {}) })
  if (typeof body.socialId === 'string' && typeof body.token === 'string') {
    return { socialId: body.socialId, token: body.token }
  }
  return { error: body.error === 'taken' ? 'taken' : 'invalid' }
}

/** Asks the network whether it is there. Used before a profile has joined and has a token. */
export async function apiPing(): Promise<boolean> {
  const { status } = await call('GET', '/ping', null)
  return status < 400
}

export async function apiLeave(token: string): Promise<boolean> {
  const { status } = await call('POST', '/leave', token, {})
  return status < 400
}

export async function apiPeople(token: string, query: string): Promise<SocialPerson[]> {
  const { status, body } = await call('GET', `/people?q=${encodeURIComponent(query)}`, token)
  if (status >= 400) return []
  // The server never sends moods or unread counts here.
  return people(body.people).map((p) => ({ ...p, mood: null, unread: 0 }))
}

export async function apiRelation(
  token: string,
  socialId: string,
  action: 'request' | 'cancel' | 'accept' | 'decline' | 'remove',
): Promise<boolean> {
  const { status } = await call('POST', '/relation', token, { socialId, action })
  return status < 400
}

export async function apiMood(token: string, mood: SharedMood | null): Promise<boolean> {
  const body = mood ? { score: mood.score, tags: mood.tags, at: mood.at } : { clear: true }
  const { status } = await call('POST', '/mood', token, body)
  return status < 400
}

export async function apiMessage(token: string, toId: string, text: string): Promise<string | null> {
  const { status, body } = await call('POST', '/messages', token, { toId, text })
  return status < 400 && typeof body.id === 'string' ? body.id : null
}

export type SyncResult = {
  friends: SocialPerson[]
  incoming: SocialPerson[]
  outgoing: SocialPerson[]
  messages: ChatMessage[]
  cursor: string | null
}

export async function apiSync(token: string, cursor: string | null): Promise<SyncResult | null> {
  const query = cursor ? `?after=${encodeURIComponent(cursor)}` : ''
  const { status, body } = await call('GET', `/sync${query}`, token)
  if (status >= 400) return null
  return {
    friends: people(withRelation(body.friends, 'friend')),
    incoming: people(body.incoming).map((p) => ({ ...p, relation: 'incoming', mood: null })),
    outgoing: people(body.outgoing).map((p) => ({ ...p, relation: 'outgoing', mood: null })),
    messages: Array.isArray(body.messages)
      ? body.messages.map(sanitizeMessage).filter((m): m is ChatMessage => m !== null)
      : [],
    cursor: typeof body.cursor === 'string' ? body.cursor : null,
  }
}

// ---- Crew challenges ----------------------------------------------------------------------

/** One person on a challenge board, as the server sends it: a handle and one score. */
export type RemoteChallengeEntry = { socialId: string; handle: string; score: number }

/** Sends one score, or `leave`. The body holds `id` and `score`, or `id` and `leave`, and nothing else. */
export async function apiChallenge(
  token: string,
  id: 'exercise' | 'nutrition',
  score: number | 'leave',
): Promise<boolean> {
  const body = score === 'leave' ? { id, leave: true } : { id, score }
  const { status } = await call('POST', '/challenge', token, body)
  return status < 400
}

const remoteEntries = (v: unknown): RemoteChallengeEntry[] =>
  Array.isArray(v)
    ? v.flatMap((e: unknown) => {
        if (typeof e !== 'object' || e === null) return []
        const { socialId, handle, score } = e as Record<string, unknown>
        if (typeof socialId !== 'string' || !socialId) return []
        if (typeof handle !== 'string' || !handle) return []
        if (typeof score !== 'number' || !Number.isFinite(score)) return []
        return [{ socialId, handle, score }]
      })
    : []

export async function apiChallenges(
  token: string,
): Promise<{ exercise: RemoteChallengeEntry[]; nutrition: RemoteChallengeEntry[] } | null> {
  const { status, body } = await call('GET', '/challenges', token)
  if (status >= 400) return null
  return { exercise: remoteEntries(body.exercise), nutrition: remoteEntries(body.nutrition) }
}
