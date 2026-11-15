// How a shared mood is shown everywhere on this screen: a word and a face, never a number,
// and never by color alone.

import { Annoyed, EyeOff, Frown, Laugh, Meh, Smile, type LucideIcon } from 'lucide-react'
import type { Tone } from '@/design'
import type { SharedMood, SocialPerson } from '@/data'

export type MoodDisplay = {
  word: string
  Icon: LucideIcon
  tone: Tone
  /** The tags joined with " · ", or empty. */
  tagsText: string
  /** "2 h ago", or empty when nothing is shared. */
  agoText: string
}

const BY_SCORE: Record<number, { word: string; Icon: LucideIcon; tone: Tone }> = {
  1: { word: 'VERY LOW', Icon: Frown, tone: 'warn' },
  2: { word: 'LOW', Icon: Annoyed, tone: 'warn' },
  3: { word: 'OKAY', Icon: Meh, tone: 'neutral' },
  4: { word: 'GOOD', Icon: Smile, tone: 'ok' },
  5: { word: 'VERY GOOD', Icon: Laugh, tone: 'ok' },
}

const NOT_SHARED: MoodDisplay = {
  word: 'NOT SHARED',
  Icon: EyeOff,
  tone: 'neutral',
  tagsText: '',
  agoText: '',
}

/** How long ago, in plain words: "just now", "12 min ago", "2 h ago", "3 d ago". */
export function timeAgo(at: string, now: Date = new Date()): string {
  const ms = now.getTime() - Date.parse(at)
  if (!Number.isFinite(ms)) return ''
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

export function moodDisplay(mood: SharedMood | null, now: Date = new Date()): MoodDisplay {
  const look = mood ? BY_SCORE[mood.score] : undefined
  if (!mood || !look) return NOT_SHARED
  return {
    ...look,
    tagsText: mood.tags.slice(0, 2).join(' · '),
    agoText: timeAgo(mood.at, now),
  }
}

/**
 * "Crew mood: 3 good or better, 1 low, 1 not shared". Groups with nobody are left out.
 * Null when there are no friends.
 */
export function crewMoodLine(friends: readonly SocialPerson[]): string | null {
  if (friends.length === 0) return null
  let good = 0
  let okay = 0
  let low = 0
  let hidden = 0
  for (const friend of friends) {
    const score = friend.mood?.score
    if (score === undefined) hidden++
    else if (score >= 4) good++
    else if (score === 3) okay++
    else low++
  }
  const parts = [
    good > 0 ? `${good} good or better` : '',
    okay > 0 ? `${okay} okay` : '',
    low > 0 ? `${low} low` : '',
    hidden > 0 ? `${hidden} not shared` : '',
  ].filter(Boolean)
  return `Crew mood: ${parts.join(', ')}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "14:05" for today, "2 Nov" for an earlier day. */
export function messageTime(at: string, now: Date = new Date()): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`
}
