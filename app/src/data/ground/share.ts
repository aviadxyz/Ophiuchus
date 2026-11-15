// Sending the active profile's GroundReport (CONTRACTS section 9): `setGroundShare` and
// `useGroundShare`.
//
// Off for every profile until that person switches it on. The setting, with a random
// `reportId` and `key`, is kept per profile in the store. While it is on for the active member
// profile, the report is sent once at once, then when it changes (at most once a minute), and
// once when the page becomes visible again. Nothing is sent while the page is hidden. Switching
// off sends `remove` first and forgets the ids only once the server has it. The demo profile
// never touches the network.

import { useMemo } from 'react'
import { create } from 'zustand'
import { getActiveProfile, setStoredGroundShare, useDataStore } from '../store'
import { useRuntime } from '../runtime'
import { apiRemoveReport, apiSendReport, groundEnabled } from './api'
import { buildGroundReport, reportFingerprint } from './report'
import type { GroundShare, GroundShareState } from './types'

export const SEND_GAP_MS = 60_000

type ProfileRuntime = { state: Exclude<GroundShareState, 'off'>; lastSentAt: string | null }

/** Never saved: how the last send went, per profile. */
export const useGroundShareRuntime = create<{ byProfile: Record<string, ProfileRuntime> }>()(
  () => ({ byProfile: {} }),
)

function setProfileRuntime(profileId: string, runtime: ProfileRuntime | null): void {
  useGroundShareRuntime.setState((s) => {
    if (runtime) return { byProfile: { ...s.byProfile, [profileId]: runtime } }
    if (!(profileId in s.byProfile)) return {}
    const { [profileId]: removed, ...rest } = s.byProfile
    void removed
    return { byProfile: rest }
  })
}

const lastSentAtOf = (profileId: string) =>
  useGroundShareRuntime.getState().byProfile[profileId]?.lastSentAt ?? null

/** What was last stored on the server per profile, and when the last attempt was. */
const lastSent = new Map<string, string>()
const lastAttempt = new Map<string, number>()

/** Every network call runs one after another, so a `remove` never overtakes a send in flight. */
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job)
  queue = next.catch(() => undefined)
  return next
}

function hidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

function settingOf(profileId: string) {
  return useDataStore.getState().groundShare[profileId]
}

let retryTimer: ReturnType<typeof setTimeout> | undefined

function retryIn(ms: number): void {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(
    () => {
      retryTimer = undefined
      void pushGround()
    },
    Math.max(1000, ms),
  )
}

function forget(profileId: string): void {
  setStoredGroundShare(profileId, null)
  setProfileRuntime(profileId, null)
  lastSent.delete(profileId)
  lastAttempt.delete(profileId)
}

/** Removes one profile's report from the server. True when it is gone. */
async function removeOne(profileId: string): Promise<boolean> {
  const setting = settingOf(profileId)
  if (!setting) return true
  if (setting.on) return false
  const result = await apiRemoveReport(setting.reportId, setting.key)
  // Switched on again while the remove was on its way: keep the ids, the next send restores it.
  if (settingOf(profileId)?.on) return false
  if (result === 'done') {
    forget(profileId)
    return true
  }
  setProfileRuntime(profileId, { state: 'failed', lastSentAt: lastSentAtOf(profileId) })
  return false
}

/** Removes every report this device no longer shares: switched off, or the profile deleted. */
async function removePending(): Promise<boolean> {
  const state = useDataStore.getState()
  let allDone = true
  for (const [profileId, setting] of Object.entries(state.groundShare)) {
    const profile = state.profiles.find((p) => p.id === profileId)
    if (profile?.kind === 'demo') {
      if (!setting.on) forget(profileId)
      continue
    }
    if (profile && setting.on) continue
    if (setting.on) setStoredGroundShare(profileId, { ...setting, on: false })
    if (!groundEnabled()) {
      allDone = false
      continue
    }
    if (!(await removeOne(profileId))) allDone = false
  }
  return allDone
}

/** Sends the active profile's report when it is shared and has changed, at most once a minute. */
async function sendActive(force: boolean, now: number): Promise<void> {
  const profile = getActiveProfile()
  const setting = settingOf(profile.id)
  if (!setting?.on || profile.kind !== 'member') return
  if (!groundEnabled()) {
    setProfileRuntime(profile.id, { state: 'failed', lastSentAt: lastSentAtOf(profile.id) })
    return
  }
  const report = buildGroundReport(profile.id, setting.reportId, new Date(now))
  if (!report) return
  const fingerprint = reportFingerprint(report)
  const current = useGroundShareRuntime.getState().byProfile[profile.id]?.state
  if (!force && current === 'sent' && lastSent.get(profile.id) === fingerprint) return

  const since = now - (lastAttempt.get(profile.id) ?? -Infinity)
  if (since < SEND_GAP_MS) {
    retryIn(SEND_GAP_MS - since)
    return
  }
  lastAttempt.set(profile.id, now)
  setProfileRuntime(profile.id, { state: 'sending', lastSentAt: lastSentAtOf(profile.id) })
  const ok = await apiSendReport(setting.reportId, setting.key, report)
  // Switched off, or switched to new ids, while this was on its way: the remove handles it.
  if (settingOf(profile.id)?.reportId !== setting.reportId || !settingOf(profile.id)?.on) return
  if (ok) {
    lastSent.set(profile.id, fingerprint)
    setProfileRuntime(profile.id, { state: 'sent', lastSentAt: report.sentAt })
  } else {
    lastSent.delete(profile.id)
    setProfileRuntime(profile.id, { state: 'failed', lastSentAt: lastSentAtOf(profile.id) })
    retryIn(SEND_GAP_MS)
  }
}

/**
 * Brings the server in line with this device: reports no longer shared are removed, and the
 * active profile's report is sent if it is shared and changed. Does nothing while the page is
 * hidden. `force` sends even an unchanged report (switching on, the page visible again).
 */
export async function pushGround(options: { force?: boolean; now?: Date } = {}): Promise<void> {
  if (hidden()) return
  await serial(async () => {
    const removed = await removePending()
    await sendActive(options.force === true, (options.now ?? new Date()).getTime())
    if (!removed) retryIn(SEND_GAP_MS)
  })
}

// ---------------------------------------------------------------------------------------------
// Writing (CONTRACTS section 9)
// ---------------------------------------------------------------------------------------------

function randomId(): string {
  return crypto.randomUUID()
}

/**
 * Switches ground sharing for the active profile. On sends a report now (never for the demo
 * profile, which stays on this device). Off removes the report from the server at once.
 */
export async function setGroundShare(on: boolean): Promise<void> {
  const profile = getActiveProfile()
  const existing = settingOf(profile.id)

  if (on) {
    if (existing?.on) return
    setStoredGroundShare(profile.id, {
      on: true,
      reportId: existing?.reportId ?? randomId(),
      key: existing?.key ?? randomId(),
    })
    lastSent.delete(profile.id)
    lastAttempt.delete(profile.id)
    if (profile.kind === 'demo') {
      setProfileRuntime(profile.id, { state: 'sent', lastSentAt: new Date().toISOString() })
      return
    }
    setProfileRuntime(profile.id, { state: 'sending', lastSentAt: null })
    await serial(() => sendActive(true, Date.now()))
    return
  }

  if (!existing) return
  if (profile.kind === 'demo') {
    forget(profile.id)
    return
  }
  setStoredGroundShare(profile.id, { ...existing, on: false })
  setProfileRuntime(profile.id, { state: 'sending', lastSentAt: lastSentAtOf(profile.id) })
  if (!groundEnabled()) {
    setProfileRuntime(profile.id, { state: 'failed', lastSentAt: lastSentAtOf(profile.id) })
    return
  }
  const gone = await serial(() => removeOne(profile.id))
  if (!gone) retryIn(SEND_GAP_MS)
}

// ---------------------------------------------------------------------------------------------
// Reading (CONTRACTS section 9)
// ---------------------------------------------------------------------------------------------

export function useGroundShare(): GroundShare {
  const profile = useDataStore(getActiveProfile)
  const setting = useDataStore((s) => s.groundShare[s.activeProfileId])
  const runtime = useGroundShareRuntime((s) => s.byProfile[profile.id])
  return useMemo(() => {
    if (!setting) return { on: false, state: 'off', lastSentAt: null }
    const lastSentAt = runtime?.lastSentAt ?? null
    if (profile.kind === 'member' && !groundEnabled()) {
      return { on: setting.on, state: 'failed', lastSentAt }
    }
    return { on: setting.on, state: runtime?.state ?? 'sending', lastSentAt }
  }, [profile, setting, runtime])
}

// ---------------------------------------------------------------------------------------------
// Install once
// ---------------------------------------------------------------------------------------------

let installed = false
let pushTimer: ReturnType<typeof setTimeout> | undefined

/** Coalesces a burst of changes into one push. */
function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = undefined
    void pushGround()
  }, 500)
}

/** Follows the store by itself in the browser. Nothing is sent for a profile that is not sharing. */
export function installGround(): void {
  if (installed) return
  installed = true
  useDataStore.subscribe((state, prev) => {
    if (
      state.data !== prev.data ||
      state.alerts !== prev.alerts ||
      state.profiles !== prev.profiles ||
      state.activeProfileId !== prev.activeProfileId ||
      state.groundShare !== prev.groundShare
    ) {
      schedulePush()
    }
  })
  useRuntime.subscribe((state, prev) => {
    if (state.latestVital !== prev.latestVital) schedulePush()
  })
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!hidden()) void pushGround({ force: true })
    })
  }
  schedulePush()
}

/** For tests: forgets what was sent and stops every timer. */
export function resetGroundShareForTests(): void {
  lastSent.clear()
  lastAttempt.clear()
  if (retryTimer) clearTimeout(retryTimer)
  if (pushTimer) clearTimeout(pushTimer)
  retryTimer = pushTimer = undefined
  queue = Promise.resolve()
  useGroundShareRuntime.setState({ byProfile: {} })
}
