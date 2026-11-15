// This device (CONTRACTS section 9, "This device"): what kind of device it is, and whether the
// first-open choice of who is using it has been made. The choice is remembered on this device
// only, through the data folder's own safe storage. Nothing here is sent anywhere.

import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { safeStorage, STORAGE_PREFIX } from './persistence'

export type DeviceKind = 'computer' | 'phone' | 'watch'

export type DeviceState = { kind: DeviceKind; setupDone: boolean }

export const DEVICE_KEY = `${STORAGE_PREFIX}device`
/** Under this width the device is a phone. The same as the design system's `sm` breakpoint. */
export const PHONE_MAX_WIDTH = 640
export const WATCH_ROUTE = '/w'

type DeviceSetup = { setupDone: boolean }

const useDeviceSetup = create<DeviceSetup>()(
  persist((): DeviceSetup => ({ setupDone: false }), {
    name: DEVICE_KEY,
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    merge: (persisted, current) => {
      const done =
        typeof persisted === 'object' &&
        persisted !== null &&
        (persisted as Record<string, unknown>).setupDone === true
      return { ...current, setupDone: done }
    },
  }),
)

/** The kind of device for a route and a window width. */
export function deviceKindFor(pathname: string, width: number): DeviceKind {
  if (pathname === WATCH_ROUTE || pathname.startsWith(`${WATCH_ROUTE}/`)) return 'watch'
  return width < PHONE_MAX_WIDTH ? 'phone' : 'computer'
}

function currentKind(): DeviceKind {
  if (typeof window === 'undefined') return 'computer'
  return deviceKindFor(window.location.pathname, window.innerWidth)
}

function subscribeToWindow(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('resize', onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('popstate', onChange)
  }
}

/**
 * `kind`: `watch` on the route /w, `phone` under 640 px wide, otherwise `computer`. Follows the
 * window as it is resized, and the route whenever the component renders again.
 * `setupDone`: whether the first-open choice has been made on this device.
 */
export function useDevice(): DeviceState {
  const kind = useSyncExternalStore(subscribeToWindow, currentKind, () => 'computer' as const)
  const setupDone = useDeviceSetup((state) => state.setupDone)
  return { kind, setupDone }
}

/** Marks this device as set up, so the first-open choice is not shown again. */
export function completeDeviceSetup(): void {
  useDeviceSetup.setState({ setupDone: true })
}

/** Shows the first-open choice again. Profiles and their data are kept. */
export function resetDeviceSetup(): void {
  useDeviceSetup.setState({ setupDone: false })
}
