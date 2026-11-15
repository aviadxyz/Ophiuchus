// What the crew network does by itself, watching the main store from inside this folder:
//   - publishes the shared mood whenever check-ins change (or a check-in turns 24 hours old),
//   - forgets everything social when a profile is deleted, and leaves the network for it,
//   - starts the demo crew over when the demo profile is rebuilt,
//   - in live mode, syncs every 3 seconds while a social hook is mounted, every 30 seconds
//     otherwise, and not at all while the tab is hidden.

import { onMinuteTick } from '../clock'
import { getActiveProfile, useDataStore } from '../store'
import type { CrewProfile } from '../types'
import { apiLeave, apiMood, apiPing, apiSync, socialEnabled, type SyncResult } from './api'
import {
  getProfileSocial,
  removeProfileSocial,
  setReachable,
  updateProfileSocial,
  useSocialRuntime,
  useSocialStore,
} from './state'
import type { SharedMood, SocialConnection, SocialPerson } from './types'

const DAY_MS = 24 * 60 * 60_000
const FAST_POLL_MS = 3000
const SLOW_POLL_MS = 30_000

/** The connection state for a profile, as `useSocialAccount` reports it. */
export function connectionFor(profile: CrewProfile, reachable: boolean): SocialConnection {
  if (profile.kind === 'demo') return 'simulated'
  return socialEnabled() && reachable ? 'live' : 'off'
}

// ---------------------------------------------------------------------------------------------
// Simulated timers (demo replies and accepted requests)
// ---------------------------------------------------------------------------------------------

const timers = new Set<ReturnType<typeof setTimeout>>()

export function later(run: () => void, ms: number): void {
  const timer = setTimeout(() => {
    timers.delete(timer)
    run()
  }, ms)
  timers.add(timer)
}

export function clearSimulatedTimers(): void {
  for (const timer of timers) clearTimeout(timer)
  timers.clear()
}

// ---------------------------------------------------------------------------------------------
// Mood sharing
// ---------------------------------------------------------------------------------------------

/** What friends should see: the latest check-in from the last 24 hours, score and two tags only. */
export function desiredMood(profileId: string, now: Date = new Date()): SharedMood | null {
  const social = getProfileSocial(profileId)
  if (!social.account?.shareMood) return null
  const moods = useDataStore.getState().data[profileId]?.moods ?? []
  const nowMs = now.getTime()
  let latest: (typeof moods)[number] | null = null
  let latestMs = -Infinity
  for (const mood of moods) {
    const at = Date.parse(mood.at)
    if (!Number.isFinite(at) || at < nowMs - DAY_MS || at > nowMs + 60_000) continue
    if (at > latestMs) {
      latest = mood
      latestMs = at
    }
  }
  if (!latest) return null
  return { score: latest.score, tags: latest.tags.slice(0, 2), at: latest.at, source: latest.source }
}

const moodKey = (m: SharedMood | null) =>
  m ? `${m.score}|${m.tags.join(',')}|${m.at}|${m.source}` : 'none'

const publishing = new Set<string>()

/**
 * Brings the published mood in line with the check-ins and the sharing switch.
 * Returns false when the real network could not be reached.
 */
export async function refreshSharedMood(profileId: string): Promise<boolean> {
  const social = getProfileSocial(profileId)
  const account = social.account
  if (!account) return true
  const want = desiredMood(profileId)
  if (moodKey(want) === moodKey(social.sharedMood)) return true

  if (!account.token) {
    // Demo profile: nothing leaves the browser.
    updateProfileSocial(profileId, (p) => ({ ...p, sharedMood: want }))
    return true
  }
  if (publishing.has(profileId)) return false
  publishing.add(profileId)
  try {
    const ok = await apiMood(account.token, want)
    setReachable(true)
    if (ok) updateProfileSocial(profileId, (p) => ({ ...p, sharedMood: want }))
    return ok
  } catch {
    setReachable(false)
    return false
  } finally {
    publishing.delete(profileId)
  }
}

function refreshAllMoods(): void {
  for (const profileId of Object.keys(useSocialStore.getState().byProfile)) {
    void refreshSharedMood(profileId)
  }
}

// ---------------------------------------------------------------------------------------------
// Leaving
// ---------------------------------------------------------------------------------------------

/** Removes a profile from the network (best effort) and everything social from this device. */
export function forgetProfile(profileId: string): void {
  const token = getProfileSocial(profileId).account?.token
  removeProfileSocial(profileId)
  if (token) void apiLeave(token).catch(() => undefined)
}

// ---------------------------------------------------------------------------------------------
// Live sync
// ---------------------------------------------------------------------------------------------

export function applySync(profileId: string, result: SyncResult): void {
  updateProfileSocial(profileId, (p) => {
    const me = p.account?.socialId
    const people: Record<string, SocialPerson> = {}
    // Anyone not in the lists is no longer connected; keep their handle for search.
    for (const person of Object.values(p.people)) {
      people[person.socialId] = { ...person, relation: 'none', mood: null, unread: 0 }
    }
    for (const person of [...result.friends, ...result.incoming, ...result.outgoing]) {
      const before = p.people[person.socialId]
      people[person.socialId] = {
        ...person,
        source: 'entered',
        unread: person.relation === 'friend' ? (before?.unread ?? 0) : 0,
      }
    }
    const byId = new Map(p.messages.map((m) => [m.id, m]))
    for (const message of result.messages) {
      const isNew = !byId.has(message.id)
      byId.set(message.id, { ...message, status: 'sent' })
      const sender = people[message.fromId]
      if (isNew && message.fromId !== me && sender?.relation === 'friend') {
        people[message.fromId] = { ...sender, unread: sender.unread + 1 }
      }
    }
    const cutoff = Date.now() - DAY_MS
    const messages = [...byId.values()]
      .filter((m) => Date.parse(m.at) >= cutoff || m.status !== 'sent')
      .filter((m) => {
        const other = m.fromId === me ? m.toId : m.fromId
        return people[other]?.relation === 'friend'
      })
      .sort((a, b) => a.at.localeCompare(b.at))
    return { ...p, people, messages, cursor: result.cursor ?? p.cursor }
  })
}

let syncing = false

export async function syncNow(): Promise<void> {
  const profile = getActiveProfile()
  if (profile.kind === 'demo' || !socialEnabled()) return
  const social = getProfileSocial(profile.id)
  const token = social.account?.token
  if (syncing) return
  if (!token) {
    // Not joined yet: only find out whether the network is there, so the screen can offer to join.
    syncing = true
    try {
      setReachable(await apiPing())
    } catch {
      setReachable(false)
    } finally {
      syncing = false
    }
    return
  }
  syncing = true
  try {
    await refreshSharedMood(profile.id)
    const result = await apiSync(token, social.cursor)
    setReachable(true)
    if (result) applySync(profile.id, result)
  } catch {
    setReachable(false)
  } finally {
    syncing = false
  }
}

let pollTimer: ReturnType<typeof setTimeout> | undefined

function hidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

function schedulePoll(): void {
  if (pollTimer) clearTimeout(pollTimer)
  if (!socialEnabled()) return
  const ms = useSocialRuntime.getState().watchers > 0 ? FAST_POLL_MS : SLOW_POLL_MS
  pollTimer = setTimeout(() => {
    void (hidden() ? Promise.resolve() : syncNow()).then(schedulePoll)
  }, ms)
}

/** Syncs now and restarts the poll at the right pace. Does nothing without VITE_SOCIAL_URL. */
export function kickSync(): void {
  if (!socialEnabled()) return
  void syncNow()
  schedulePoll()
}

// ---------------------------------------------------------------------------------------------
// Install once
// ---------------------------------------------------------------------------------------------

let installed = false

export function installSocial(): void {
  if (installed) return
  installed = true

  const dropOrphans = (profiles: CrewProfile[]) => {
    for (const profileId of Object.keys(useSocialStore.getState().byProfile)) {
      if (!profiles.some((p) => p.id === profileId)) forgetProfile(profileId)
    }
  }
  dropOrphans(useDataStore.getState().profiles)

  useDataStore.subscribe((state, prev) => {
    if (state.profiles !== prev.profiles) {
      dropOrphans(state.profiles)
      const demo = state.profiles.find((p) => p.kind === 'demo')
      const prevDemo = prev.profiles.find((p) => p.kind === 'demo')
      if (demo && prevDemo && demo !== prevDemo) {
        // The demo profile was rebuilt: its crew starts over too.
        clearSimulatedTimers()
        removeProfileSocial(demo.id)
      }
    }
    if (state.data !== prev.data || state.profiles !== prev.profiles) refreshAllMoods()
    if (state.activeProfileId !== prev.activeProfileId) kickSync()
  })

  onMinuteTick(refreshAllMoods)

  if (typeof window !== 'undefined' && socialEnabled()) {
    document.addEventListener('visibilitychange', () => {
      if (!hidden()) kickSync()
    })
    kickSync()
  }
}
