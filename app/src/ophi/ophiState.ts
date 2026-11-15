import { useSyncExternalStore } from 'react'

export type OphiState = 'idle' | 'hint' | 'talking' | 'thinking' | 'alert'

let currentState: OphiState = 'idle'
const listeners = new Set<() => void>()

export function getOphiState(): OphiState {
  return currentState
}

export function setOphiState(next: OphiState): void {
  if (next === currentState) return
  currentState = next
  listeners.forEach((listener) => listener())
}

export function useOphiState(): OphiState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => currentState,
  )
}

/** Internal helper for test isolation. */
export function resetOphiState(): void {
  currentState = 'idle'
  listeners.forEach((listener) => listener())
}
