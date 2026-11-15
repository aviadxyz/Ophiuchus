// The demo profile's crew: six plainly invented people, all marked simulated. They never reach
// a member profile and nothing about them is sent anywhere.

import type { ChatMessage, SharedMood, SocialPerson, SocialRelation } from './types'

/** How long a simulated friend takes to answer a message. */
export const SIMULATED_REPLY_MS = 2000
/** How long a simulated person takes to accept a friend request. */
export const SIMULATED_ACCEPT_MS = 3000

type CrewMember = {
  socialId: string
  handle: string
  role: string
  start: Exclude<SocialRelation, 'outgoing'>
  mood: { score: number; tags: string[]; hoursAgo: number }
  conversation?: Array<{ fromMe: boolean; text: string; minutesAgo: number }>
}

export const SIMULATED_CREW: readonly CrewMember[] = [
  {
    socialId: 'sim-lunar-lark',
    handle: 'lunar_lark',
    role: 'Mission specialist',
    start: 'friend',
    mood: { score: 4, tags: ['Calm', 'Focused'], hoursAgo: 2 },
    conversation: [
      { fromMe: false, text: 'Saw the sunrise from the cupola this morning. Sixteen of them a day never gets old.', minutesAgo: 190 },
      { fromMe: true, text: 'Save me a seat for the next one.', minutesAgo: 180 },
      { fromMe: false, text: 'Deal. Bring the good coffee pouches.', minutesAgo: 175 },
    ],
  },
  {
    socialId: 'sim-kestrel-9',
    handle: 'kestrel_9',
    role: 'Flight engineer',
    start: 'friend',
    mood: { score: 2, tags: ['Tired', 'Homesick'], hoursAgo: 5 },
    conversation: [
      { fromMe: true, text: 'How did the pump swap go?', minutesAgo: 400 },
      { fromMe: false, text: 'Done, finally. Long shift. Missing home a bit today.', minutesAgo: 380 },
    ],
  },
  {
    socialId: 'sim-orbit-owl',
    handle: 'orbit_owl',
    role: 'Commander',
    start: 'incoming',
    mood: { score: 3, tags: ['Focused'], hoursAgo: 3 },
  },
  {
    socialId: 'sim-quiet-comet',
    handle: 'quiet_comet',
    role: 'Medical officer',
    start: 'none',
    mood: { score: 5, tags: ['Proud'], hoursAgo: 1 },
  },
  {
    socialId: 'sim-redshift',
    handle: 'redshift',
    role: 'Payload specialist',
    start: 'none',
    mood: { score: 3, tags: ['Stressed'], hoursAgo: 6 },
  },
  {
    socialId: 'sim-blue-marble',
    handle: 'blue_marble',
    role: 'Science officer',
    start: 'none',
    mood: { score: 4, tags: ['Calm'], hoursAgo: 4 },
  },
]

const REPLIES = [
  'Thanks for the message. It helps.',
  'Good to hear from you. Talk at dinner?',
  'Same here. One day at a time.',
  'Thanks for checking in. I am okay.',
]

export function isSimulatedId(socialId: string): boolean {
  return SIMULATED_CREW.some((c) => c.socialId === socialId)
}

export function isSimulatedHandle(handle: string): boolean {
  const lower = handle.toLowerCase()
  return SIMULATED_CREW.some((c) => c.handle.toLowerCase() === lower)
}

/** One of a few fixed, friendly replies. */
export function simulatedReply(count: number): string {
  return REPLIES[count % REPLIES.length] ?? REPLIES[0]
}

/** A simulated person's mood, timed relative to `now`. */
export function simulatedMood(socialId: string, now: Date): SharedMood | null {
  const member = SIMULATED_CREW.find((c) => c.socialId === socialId)
  if (!member) return null
  return {
    score: member.mood.score,
    tags: member.mood.tags.slice(0, 2),
    at: new Date(now.getTime() - member.mood.hoursAgo * 3_600_000).toISOString(),
    source: 'simulated',
  }
}

/** The crew as the demo profile first sees it after joining. */
export function buildSimulatedCrew(
  mySocialId: string,
  now: Date,
): { people: Record<string, SocialPerson>; messages: ChatMessage[] } {
  const people: Record<string, SocialPerson> = {}
  const messages: ChatMessage[] = []
  for (const member of SIMULATED_CREW) {
    people[member.socialId] = {
      socialId: member.socialId,
      handle: member.handle,
      role: member.role,
      relation: member.start,
      mood: member.start === 'friend' ? simulatedMood(member.socialId, now) : null,
      unread: member.start === 'friend' && member.conversation?.at(-1)?.fromMe === false ? 1 : 0,
      source: 'simulated',
    }
    for (const [index, line] of (member.conversation ?? []).entries()) {
      messages.push({
        id: `${member.socialId}-seed-${index}`,
        fromId: line.fromMe ? mySocialId : member.socialId,
        toId: line.fromMe ? member.socialId : mySocialId,
        at: new Date(now.getTime() - line.minutesAgo * 60_000).toISOString(),
        text: line.text,
        status: 'sent',
      })
    }
  }
  return { people, messages }
}
