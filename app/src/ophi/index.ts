// STUB. Lane 03 (prompt 03) replaces this folder with the real guide character.
// The three functions behave as CONTRACTS section 12 says; `Ophi` renders nothing for now.

import { useSyncExternalStore } from 'react'

export type OphiState = 'idle' | 'hint' | 'talking' | 'thinking' | 'alert'

let state: OphiState = 'idle'
const listeners = new Set<() => void>()

export function setOphiState(next: OphiState): void {
  if (next === state) return
  state = next
  listeners.forEach((listener) => listener())
}

export function useOphiState(): OphiState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

/**
 * Navigates to /medbot?from=<screenId>. Uses the History API and tells the router, so it works
 * from anywhere without importing the shell.
 */
export function askMedbot(screenId: string): void {
  const url = `/medbot?from=${encodeURIComponent(screenId)}`
  window.history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
}

export { Ophi } from './Ophi'
