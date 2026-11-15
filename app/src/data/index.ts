// STUB. Lane 02 (prompt 02) replaces this whole file with the real store.
// It exists only so the shell compiles. Every value here is fixed demo data; nothing is stored.

import { useSyncExternalStore } from 'react'

type CrewProfile = {
  id: string
  displayName: string
  role: string
  kind: 'member' | 'demo'
  sex?: string
  birthYear?: number
  heightCm?: number
  massKg?: number
  consent: { relay: boolean; assistant: boolean }
  createdAt: string
}

type Alert = {
  id: string
  profileId: string
  at: string
  kind: 'emergency' | 'health'
  origin: 'console' | 'watch'
  message: string
  screenId?: string
  status: 'open' | 'cancelled' | 'acknowledged'
  acknowledgedAt?: string
}

const demoProfile: CrewProfile = {
  id: 'demo',
  displayName: 'Demo crew member',
  role: 'Flight engineer',
  kind: 'demo',
  consent: { relay: false, assistant: false },
  createdAt: '2026-11-01T07:00:00.000Z',
}

const profiles: CrewProfile[] = [demoProfile]
const alerts: Alert[] = []

let activeId = demoProfile.id
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useActiveProfile(): CrewProfile {
  const id = useSyncExternalStore(subscribe, () => activeId)
  return profiles.find((profile) => profile.id === id) ?? demoProfile
}

export function useProfiles(): CrewProfile[] {
  return profiles
}

export function setActiveProfile(id: string): void {
  if (!profiles.some((profile) => profile.id === id) || id === activeId) return
  activeId = id
  listeners.forEach((listener) => listener())
}

export function useAlerts(): Alert[] {
  return alerts
}
