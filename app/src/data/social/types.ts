// The four crew-network records of CONTRACTS section 8, plus the small result types the
// section 9 functions return. Field names are fixed by the contract.

import type { Source, Timestamp } from '../types'

export type SocialRelation = 'none' | 'outgoing' | 'incoming' | 'friend'

export type SocialAccount = {
  profileId: string
  socialId: string
  handle: string
  shareMood: boolean
  joinedAt: Timestamp
}

/** The score and up to two tags of the latest check-in from the last 24 hours. Never the note. */
export type SharedMood = {
  score: number
  tags: string[]
  at: Timestamp
  source: Source
}

export type SocialPerson = {
  socialId: string
  handle: string
  role?: string
  relation: SocialRelation
  /** Only ever present for a friend. */
  mood: SharedMood | null
  unread: number
  source: 'entered' | 'simulated'
}

export type ChatMessage = {
  id: string
  fromId: string
  toId: string
  at: Timestamp
  text: string
  status: 'sending' | 'sent' | 'failed'
}

/** `live`: real network reachable. `simulated`: demo profile. `off`: member, network not reachable. */
export type SocialConnection = 'live' | 'simulated' | 'off'

export type JoinResult = 'ok' | 'taken' | 'invalid' | 'offline'
export type SocialWriteResult = 'ok' | 'offline'
export type SendResult = 'ok' | 'invalid' | 'offline'

export type SocialAccountState = {
  account: SocialAccount | null
  connection: SocialConnection
}

export type FriendRequests = {
  incoming: SocialPerson[]
  outgoing: SocialPerson[]
}

/** 3 to 20 letters, digits or underscores. */
export const HANDLE_PATTERN = /^[A-Za-z0-9_]{3,20}$/
export const MAX_MESSAGE_LENGTH = 500
