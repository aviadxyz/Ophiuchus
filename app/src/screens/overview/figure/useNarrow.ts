import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 479.98px)'

/** True on screens under 480 px wide, where the head detail moves above the figure. */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const list = window.matchMedia(QUERY)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : false),
    () => false,
  )
}
