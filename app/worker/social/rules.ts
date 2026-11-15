// Pure checks for the crew network. No storage and no platform calls, so they can be tested.

/** 3 to 20 letters, digits or underscores (CONTRACTS section 8). */
export const HANDLE_PATTERN = /^[A-Za-z0-9_]{3,20}$/
export const MAX_MESSAGE_LENGTH = 500
export const MAX_ROLE_LENGTH = 40
export const MAX_TAG_LENGTH = 30

/**
 * The five people who built Ophiuchus. Their handles are friends with each other the moment each
 * one joins, with no request, because on this team everyone already knows everyone. A team handle
 * may also be joined from more than one device (a phone and a laptop), each getting its own token.
 */
export const TEAM_HANDLES: readonly string[] = ['rami', 'aviad', 'shoval', 'elia', 'tal']

export function isTeamHandle(handle: string): boolean {
  return TEAM_HANDLES.includes(handle.toLowerCase())
}

export function cleanHandle(value: unknown): string | null {
  return typeof value === 'string' && HANDLE_PATTERN.test(value) ? value : null
}

export function cleanRole(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const role = value.trim().slice(0, MAX_ROLE_LENGTH)
  return role.length > 0 ? role : null
}

export function cleanMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text.length >= 1 && text.length <= MAX_MESSAGE_LENGTH ? text : null
}

export type CleanMood = { score: number; tags: string[]; at: string }

/** A score of 1 to 5, at most two short tags and a valid time. Never a note. */
export function cleanMood(body: Record<string, unknown>): CleanMood | null {
  const { score, tags, at } = body
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) return null
  if (!Array.isArray(tags) || tags.length > 2) return null
  const cleanTags: string[] = []
  for (const tag of tags) {
    if (typeof tag !== 'string' || tag.length === 0 || tag.length > MAX_TAG_LENGTH) return null
    cleanTags.push(tag)
  }
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null
  return { score, tags: cleanTags, at }
}

/** The two ids of a pair in a fixed order, so one row stands for the relation in both directions. */
export function pairOf(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export type RelationAction = 'request' | 'cancel' | 'accept' | 'decline' | 'remove'

export function cleanAction(value: unknown): RelationAction | null {
  return value === 'request' ||
    value === 'cancel' ||
    value === 'accept' ||
    value === 'decline' ||
    value === 'remove'
    ? value
    : null
}

/** Escapes the wildcard characters of a LIKE pattern. */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}
