import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 639px)'

function subscribe(listener: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const list = window.matchMedia(QUERY)
  list.addEventListener('change', listener)
  return () => list.removeEventListener('change', listener)
}

const snapshot = () => typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches

/** True under 640 px, where the shared table turns into stacked cards that need short headings. */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
