// A clock that ticks once a minute while any component is listening, so levels that depend on
// the time of day (today's share of a daily total) stay current. No timer runs when nobody listens.

import { useSyncExternalStore } from 'react'

const TICK_MS = 60_000

let snapshot = new Date()
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()
const tickHandlers = new Set<() => void>()

function tick() {
  snapshot = new Date()
  tickHandlers.forEach((handler) => handler())
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) snapshot = new Date()
  listeners.add(listener)
  timer ??= setInterval(tick, TICK_MS)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** The current time, refreshed once a minute while the component is mounted. */
export function useNow(): Date {
  return useSyncExternalStore(subscribe, () => snapshot)
}

/** Runs `handler` on every tick (for example, to start a new day). Returns a function that stops it. */
export function onMinuteTick(handler: () => void): () => void {
  tickHandlers.add(handler)
  return () => tickHandlers.delete(handler)
}
