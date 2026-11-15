// Crew challenges (CONTRACTS sections 8, 9 and 11): `useChallenges` and `setChallengeJoined`.
//
// Nobody is in a challenge until they switch it on. Which challenges a profile has joined is kept
// per profile on this device, under ophiuchus:v1:challenges, and is forgotten when that profile's
// social account goes. While a challenge is joined the score is worked out here from the store
// and sent by itself: when it changes, at most once a minute. The only thing ever sent is
// `{ id, score }` or `{ id, leave: true }`. The demo profile never touches the network: its
// boards come from the simulated crew with fixed scores.

import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { onMinuteTick, useNow } from '../clock'
import { emptyProfileData } from '../compute'
import { safeStorage, STORAGE_PREFIX } from '../persistence'
import { getActiveProfile, useDataStore } from '../store'
import type { CrewProfile } from '../types'
import { apiChallenge, apiChallenges, socialEnabled, type RemoteChallengeEntry } from './api'
import { CHALLENGE_IDS, scoresFor, type ChallengeId } from './challengeScores'
import { isSimulatedId } from './simulatedCrew'
import {
  EMPTY_PROFILE_SOCIAL,
  getProfileSocial,
  setReachable,
  useSocialStore,
  type ProfileSocial,
} from './state'

export type { ChallengeId } from './challengeScores'

export type ChallengeEntry = {
  socialId: string
  handle: string
  score: number
  me: boolean
  source: 'entered' | 'simulated'
}

export type ChallengeBoard = {
  id: ChallengeId
  /** Is the active profile taking part. */
  joined: boolean
  /** Worked out on this device. Null when the data gives no score yet. */
  myScore: number | null
  /** Highest score first. Empty when not joined. */
  entries: ChallengeEntry[]
}

export type ChallengeBoards = Record<ChallengeId, ChallengeBoard>
export type ChallengeJoinResult = 'ok' | 'not-joined'

export const CHALLENGE_STORE_KEY = `${STORAGE_PREFIX}challenges`
const SEND_GAP_MS = 60_000
/** A score that has not changed is sent again after a day, so the server's 8-day expiry never hides it. */
const RESEND_MS = 24 * 60 * 60_000
const BOARD_POLL_MS = 15_000

/**
 * Fixed scores for the demo profile's simulated crew. Only friends who take part appear on a
 * board, as on the real network; someone without a score here does not take part.
 */
export const SIMULATED_CHALLENGE_SCORES: Readonly<
  Record<string, Partial<Record<ChallengeId, number>>>
> = {
  'sim-lunar-lark': { exercise: 82, nutrition: 5 },
  'sim-kestrel-9': { exercise: 64, nutrition: 3 },
  'sim-orbit-owl': { exercise: 91, nutrition: 5 },
  'sim-quiet-comet': { nutrition: 6 },
  'sim-redshift': { exercise: 47 },
  'sim-blue-marble': { exercise: 73, nutrition: 4 },
}

// ---------------------------------------------------------------------------------------------
// Saved per profile
// ---------------------------------------------------------------------------------------------

type ProfileChallenges = {
  /** The social account this belongs to. Another account (or none) starts over. */
  socialId: string
  joined: Record<ChallengeId, boolean>
  /** A score may be on the server and must be removed if the profile is no longer taking part. */
  onServer: Record<ChallengeId, boolean>
}

type ChallengeState = { byProfile: Record<string, ProfileChallenges> }

const noChallenges = (): Record<ChallengeId, boolean> => ({ exercise: false, nutrition: false })

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const flags = (v: unknown): Record<ChallengeId, boolean> => ({
  exercise: isObj(v) && v.exercise === true,
  nutrition: isObj(v) && v.nutrition === true,
})

export const useChallengeStore = create<ChallengeState>()(
  persist(() => ({ byProfile: {} }), {
    name: CHALLENGE_STORE_KEY,
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    merge: (persisted, current) => {
      if (!isObj(persisted) || !isObj(persisted.byProfile)) return current
      const byProfile: Record<string, ProfileChallenges> = {}
      for (const [profileId, raw] of Object.entries(persisted.byProfile)) {
        if (!isObj(raw) || typeof raw.socialId !== 'string' || !raw.socialId) continue
        byProfile[profileId] = {
          socialId: raw.socialId,
          joined: flags(raw.joined),
          onServer: flags(raw.onServer),
        }
      }
      return { ...current, byProfile }
    },
  }),
)

/** This profile's challenges, but only for the social account it has now. */
function challengesOf(profileId: string, social: ProfileSocial): ProfileChallenges | null {
  const stored = useChallengeStore.getState().byProfile[profileId]
  const socialId = social.account?.socialId
  return stored && socialId && stored.socialId === socialId ? stored : null
}

function writeChallenges(
  profileId: string,
  socialId: string,
  change: (current: ProfileChallenges) => ProfileChallenges,
): void {
  useChallengeStore.setState((state) => {
    const before = state.byProfile[profileId]
    const current =
      before && before.socialId === socialId
        ? before
        : { socialId, joined: noChallenges(), onServer: noChallenges() }
    return { byProfile: { ...state.byProfile, [profileId]: change(current) } }
  })
}

function forgetChallenges(profileId: string): void {
  useChallengeStore.setState((state) => {
    if (!(profileId in state.byProfile)) return {}
    const { [profileId]: removed, ...rest } = state.byProfile
    void removed
    return { byProfile: rest }
  })
  for (const key of [...lastSent.keys()]) if (key.startsWith(`${profileId}|`)) lastSent.delete(key)
  useChallengeRuntime.setState((s) => {
    if (!(profileId in s.boards)) return {}
    const { [profileId]: removed, ...rest } = s.boards
    void removed
    return { boards: rest }
  })
}

// ---------------------------------------------------------------------------------------------
// Never saved
// ---------------------------------------------------------------------------------------------

type RemoteBoards = Record<ChallengeId, RemoteChallengeEntry[]>

type ChallengeRuntime = {
  /** The last boards the server sent, per profile. */
  boards: Record<string, RemoteBoards>
  /** How many `useChallenges` hooks are mounted: boards are fetched only while one is. */
  watchers: number
}

export const useChallengeRuntime = create<ChallengeRuntime>()(() => ({ boards: {}, watchers: 0 }))

/** What was last sent for `profileId|challengeId`, and when. */
const lastSent = new Map<string, { score: number; at: number }>()
const inFlight = new Set<string>()

// ---------------------------------------------------------------------------------------------
// Sending scores
// ---------------------------------------------------------------------------------------------

function profileById(profileId: string): CrewProfile | undefined {
  return useDataStore.getState().profiles.find((p) => p.id === profileId)
}

function currentScores(profile: CrewProfile, now: Date): Record<ChallengeId, number | null> {
  const data = useDataStore.getState().data[profile.id] ?? emptyProfileData()
  return scoresFor(profile, data, now)
}

let retryTimer: ReturnType<typeof setTimeout> | undefined

function retryAt(ms: number): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(
    () => {
      retryTimer = undefined
      void pushScores()
    },
    Math.max(1000, ms),
  )
}

/**
 * Brings the server in line with this device for every member profile: a joined challenge with
 * a score sends it (when it changed, at most once a minute); a challenge left, or one with no
 * score any more, sends `leave` if a score may still be there. A profile that never joined sends
 * nothing.
 */
export async function pushScores(now: Date = new Date()): Promise<void> {
  if (!socialEnabled()) return
  const work: Promise<void>[] = []
  let soonest = Infinity
  for (const profileId of Object.keys(useChallengeStore.getState().byProfile)) {
    const social = getProfileSocial(profileId)
    const token = social.account?.token
    const mine = challengesOf(profileId, social)
    const profile = profileById(profileId)
    if (!token || !mine || !profile || profile.kind === 'demo') continue
    const socialId = mine.socialId
    const scores = currentScores(profile, now)

    for (const id of CHALLENGE_IDS) {
      const key = `${profileId}|${id}`
      if (inFlight.has(key)) continue
      const want = mine.joined[id] ? scores[id] : null

      if (want === null) {
        if (!mine.onServer[id]) continue
        inFlight.add(key)
        work.push(
          send(token, id, 'leave')
            .then((ok) => {
              if (!ok) return
              lastSent.delete(key)
              writeChallenges(profileId, socialId, (c) => ({
                ...c,
                onServer: { ...c.onServer, [id]: false },
              }))
            })
            .finally(() => inFlight.delete(key)),
        )
        continue
      }

      const last = lastSent.get(key)
      const age = last ? now.getTime() - last.at : Infinity
      if (last && last.score === want && age < RESEND_MS) continue
      if (age < SEND_GAP_MS) {
        soonest = Math.min(soonest, SEND_GAP_MS - age)
        continue
      }
      inFlight.add(key)
      writeChallenges(profileId, socialId, (c) => ({
        ...c,
        onServer: { ...c.onServer, [id]: true },
      }))
      work.push(
        send(token, id, want)
          .then((ok) => {
            if (ok) lastSent.set(key, { score: want, at: now.getTime() })
          })
          .finally(() => inFlight.delete(key)),
      )
    }
  }
  if (Number.isFinite(soonest)) retryAt(soonest)
  await Promise.all(work)
}

async function send(token: string, id: ChallengeId, score: number | 'leave'): Promise<boolean> {
  try {
    const ok = await apiChallenge(token, id, score)
    setReachable(true)
    return ok
  } catch {
    setReachable(false)
    return false
  }
}

// ---------------------------------------------------------------------------------------------
// Fetching boards
// ---------------------------------------------------------------------------------------------

/** Fetches the active profile's boards, only when it takes part in at least one challenge. */
export async function fetchBoards(): Promise<void> {
  const profile = getActiveProfile()
  if (profile.kind === 'demo' || !socialEnabled()) return
  const social = getProfileSocial(profile.id)
  const token = social.account?.token
  const mine = challengesOf(profile.id, social)
  if (!token || !mine || !CHALLENGE_IDS.some((id) => mine.joined[id])) return
  try {
    const boards = await apiChallenges(token)
    setReachable(true)
    if (boards)
      useChallengeRuntime.setState((s) => ({ boards: { ...s.boards, [profile.id]: boards } }))
  } catch {
    setReachable(false)
  }
}

let pollTimer: ReturnType<typeof setInterval> | undefined

function hidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

function tick(): void {
  if (hidden()) return
  void pushScores().then(fetchBoards)
}

/** Polls every 15 seconds while a board is on screen, never while the page is hidden. */
function updatePolling(): void {
  const want = socialEnabled() && useChallengeRuntime.getState().watchers > 0
  if (want && !pollTimer) {
    pollTimer = setInterval(tick, BOARD_POLL_MS)
    tick()
  } else if (!want && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
}

// ---------------------------------------------------------------------------------------------
// Writing (CONTRACTS section 9)
// ---------------------------------------------------------------------------------------------

/** Takes the active profile in or out of a challenge. Off removes its score from the network at once. */
export async function setChallengeJoined(
  challengeId: ChallengeId,
  on: boolean,
): Promise<ChallengeJoinResult> {
  if (!CHALLENGE_IDS.includes(challengeId)) return 'not-joined'
  const profile = getActiveProfile()
  const account = getProfileSocial(profile.id).account
  if (!account) return 'not-joined'
  writeChallenges(profile.id, account.socialId, (c) => ({
    ...c,
    joined: { ...c.joined, [challengeId]: on },
  }))
  lastSent.delete(`${profile.id}|${challengeId}`)
  if (!on) {
    useChallengeRuntime.setState((s) => {
      const boards = s.boards[profile.id]
      if (!boards) return {}
      return { boards: { ...s.boards, [profile.id]: { ...boards, [challengeId]: [] } } }
    })
  }
  await pushScores()
  if (on) await fetchBoards()
  return 'ok'
}

// ---------------------------------------------------------------------------------------------
// Reading (CONTRACTS section 9)
// ---------------------------------------------------------------------------------------------

const byScore = (a: ChallengeEntry, b: ChallengeEntry) =>
  b.score - a.score || a.handle.localeCompare(b.handle)

/** One board: the active profile's own score from this device, and the others' as received. */
export function buildBoard(
  id: ChallengeId,
  joined: boolean,
  myScore: number | null,
  me: { socialId: string; handle: string; source: ChallengeEntry['source'] } | null,
  others: readonly ChallengeEntry[],
): ChallengeBoard {
  if (!joined || !me) return { id, joined: false, myScore, entries: [] }
  const entries = others.filter((e) => e.socialId !== me.socialId).map((e) => ({ ...e, me: false }))
  if (myScore !== null) entries.push({ ...me, score: myScore, me: true })
  return { id, joined: true, myScore, entries: entries.sort(byScore) }
}

/** The demo profile's friends who take part, with their fixed simulated scores. */
function simulatedOthers(social: ProfileSocial, id: ChallengeId): ChallengeEntry[] {
  return Object.values(social.people).flatMap((person) => {
    const score = SIMULATED_CHALLENGE_SCORES[person.socialId]?.[id]
    if (person.relation !== 'friend' || !isSimulatedId(person.socialId) || score === undefined) {
      return []
    }
    return [
      {
        socialId: person.socialId,
        handle: person.handle,
        score,
        me: false,
        source: 'simulated' as const,
      },
    ]
  })
}

/** Received entries, kept only for people this device also knows as friends. */
function remoteOthers(
  social: ProfileSocial,
  entries: readonly RemoteChallengeEntry[],
): ChallengeEntry[] {
  return entries
    .filter((e) => social.people[e.socialId]?.relation === 'friend')
    .map((e) => ({ ...e, me: false, source: 'entered' as const }))
}

const NO_DATA = emptyProfileData()

export function useChallenges(): ChallengeBoards {
  useEffect(() => {
    useChallengeRuntime.setState((s) => ({ watchers: s.watchers + 1 }))
    updatePolling()
    return () => {
      useChallengeRuntime.setState((s) => ({ watchers: Math.max(0, s.watchers - 1) }))
      updatePolling()
    }
  }, [])

  const profile = useDataStore(getActiveProfile)
  const data = useDataStore((s) => s.data[s.activeProfileId] ?? NO_DATA)
  const social = useSocialStore((s) => s.byProfile[profile.id] ?? EMPTY_PROFILE_SOCIAL)
  const stored = useChallengeStore((s) => s.byProfile[profile.id])
  const remote = useChallengeRuntime((s) => s.boards[profile.id])
  const now = useNow()

  return useMemo(() => {
    const account = social.account
    const mine = stored && account && stored.socialId === account.socialId ? stored : null
    const scores = scoresFor(profile, data, now)
    const demo = profile.kind === 'demo'
    const me = account
      ? {
          socialId: account.socialId,
          handle: account.handle,
          source: demo ? ('simulated' as const) : ('entered' as const),
        }
      : null
    const board = (id: ChallengeId) =>
      buildBoard(
        id,
        mine?.joined[id] ?? false,
        scores[id],
        me,
        demo ? simulatedOthers(social, id) : remoteOthers(social, remote?.[id] ?? []),
      )
    return { exercise: board('exercise'), nutrition: board('nutrition') }
  }, [profile, data, social, stored, remote, now])
}

// ---------------------------------------------------------------------------------------------
// Install once
// ---------------------------------------------------------------------------------------------

let installed = false
let pushTimer: ReturnType<typeof setTimeout> | undefined

/** Coalesces a burst of store changes into one push. */
function schedulePush(): void {
  if (!socialEnabled()) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = undefined
    void pushScores()
  }, 500)
}

export function installChallenges(): void {
  if (installed) return
  installed = true

  // A profile whose social account went (left, deleted, demo reset) or changed starts over.
  const dropOrphans = () => {
    const social = useSocialStore.getState().byProfile
    for (const [profileId, mine] of Object.entries(useChallengeStore.getState().byProfile)) {
      if (social[profileId]?.account?.socialId !== mine.socialId) forgetChallenges(profileId)
    }
  }
  dropOrphans()
  useSocialStore.subscribe(dropOrphans)
  useChallengeStore.persist.onFinishHydration(dropOrphans)

  useDataStore.subscribe((state, prev) => {
    if (state.data !== prev.data || state.profiles !== prev.profiles) schedulePush()
  })
  onMinuteTick(schedulePush)

  if (typeof window !== 'undefined' && socialEnabled()) {
    document.addEventListener('visibilitychange', () => {
      if (!hidden() && pollTimer) tick()
    })
    schedulePush()
  }
}

/** For tests: forgets what was sent and stops every timer. */
export function resetChallengesForTests(): void {
  lastSent.clear()
  inFlight.clear()
  if (retryTimer) clearTimeout(retryTimer)
  if (pushTimer) clearTimeout(pushTimer)
  if (pollTimer) clearInterval(pollTimer)
  retryTimer = pushTimer = pollTimer = undefined
  useChallengeStore.setState({ byProfile: {} })
  useChallengeRuntime.setState({ boards: {}, watchers: 0 })
}
