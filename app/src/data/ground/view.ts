// The ground view (CONTRACTS section 9): `useGroundView`, `openGroundView`,
// `openSimulatedGroundView` and `closeGroundView`.
//
// The ground code lives in one module variable for this visit only: never in a store, never in
// browser storage, never in a URL. While the live view is open the reports are fetched again
// every 30 seconds, never while the page is hidden. Closing forgets the code and the reports.

import { create } from 'zustand'
import { worstLevel } from '../levels'
import { apiFetchReports, groundEnabled } from './api'
import { simulatedGroundReports } from './simulated'
import type { GroundReport, GroundView } from './types'

export const GROUND_POLL_MS = 30_000

const CLOSED: GroundView = { state: 'closed', mode: 'live', reports: [], fetchedAt: null }

/** Never saved. Holds the reports on screen, never the code. */
export const useGroundViewStore = create<GroundView>()(() => CLOSED)

/** The ground code for this visit, or null. */
let groundCode: string | null = null
/** Bumped on every open and close, so an answer that arrives late is ignored. */
let generation = 0
let pollTimer: ReturnType<typeof setInterval> | undefined

const severity = { act: 3, watch: 2, ok: 1, none: 0 } as const

/** The worst level of a report's five summary lines. */
export function reportLevel(report: GroundReport): keyof typeof severity {
  const { sleep, food, water, exercise, mood } = report.summary
  return worstLevel([sleep.level, food.level, water.level, exercise.level, mood.level])
}

/** The one that needs attention most first, then the newest. */
export function sortReports(reports: readonly GroundReport[]): GroundReport[] {
  return [...reports].sort(
    (a, b) =>
      severity[reportLevel(b)] - severity[reportLevel(a)] ||
      b.receivedAt.localeCompare(a.receivedAt),
  )
}

function hidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

function stopPolling(): void {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = undefined
}

async function refresh(gen: number, first: boolean): Promise<void> {
  const code = groundCode
  if (!code) return
  const result = await apiFetchReports(code)
  if (gen !== generation) return
  if (result.state === 'open') {
    useGroundViewStore.setState({
      state: 'open',
      mode: 'live',
      reports: sortReports(result.reports),
      fetchedAt: new Date().toISOString(),
    })
    return
  }
  // A failed refresh while open keeps the last list; the screen shows when it was fetched.
  if (!first && result.state === 'offline') return
  groundCode = null
  stopPolling()
  useGroundViewStore.setState({ state: result.state, mode: 'live', reports: [], fetchedAt: null })
}

function startPolling(gen: number): void {
  stopPolling()
  pollTimer = setInterval(() => {
    if (!hidden()) void refresh(gen, false)
  }, GROUND_POLL_MS)
}

/** Asks the server for every report with the ground code, kept in memory for this visit only. */
export async function openGroundView(code: string): Promise<void> {
  stopPolling()
  const gen = ++generation
  const trimmed = code.trim()
  groundCode = null
  if (!groundEnabled()) {
    useGroundViewStore.setState({ ...CLOSED, state: 'offline' })
    return
  }
  if (!trimmed) {
    useGroundViewStore.setState({ ...CLOSED, state: 'wrong-code' })
    return
  }
  groundCode = trimmed
  useGroundViewStore.setState({ ...CLOSED, state: 'checking' })
  await refresh(gen, true)
  if (gen === generation && useGroundViewStore.getState().state === 'open') startPolling(gen)
}

/** Opens the ground view on the simulated crew, with no network call. */
export function openSimulatedGroundView(): void {
  stopPolling()
  generation++
  groundCode = null
  const now = new Date()
  useGroundViewStore.setState({
    state: 'open',
    mode: 'simulated',
    reports: sortReports(simulatedGroundReports(now)),
    fetchedAt: now.toISOString(),
  })
}

/** Forgets the code and the reports. */
export function closeGroundView(): void {
  stopPolling()
  generation++
  groundCode = null
  useGroundViewStore.setState(CLOSED, true)
}

export function useGroundView(): GroundView {
  return useGroundViewStore()
}

let installed = false

/** Fetches at once when the page becomes visible again while the live view is open. */
export function installGroundView(): void {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener('visibilitychange', () => {
    if (!hidden() && pollTimer && groundCode) void refresh(generation, false)
  })
}

/** For tests: whether a code is held right now, without revealing it. */
export function holdsGroundCodeForTests(): boolean {
  return groundCode !== null
}
