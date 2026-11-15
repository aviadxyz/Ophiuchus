// State that is never saved: the latest reading, which sensor is connected, the room's link state.
// Kept apart from the saved store so a reading every few seconds does not rewrite storage.

import { create } from 'zustand'
import type { VitalSample } from './types'

export type SensorState = {
  profileId: string
  status: 'connecting' | 'connected'
  deviceName?: string
}

export type RoomConnection = 'off' | 'local' | 'online' | 'error'

export type RuntimeState = {
  latestVital: Record<string, VitalSample>
  sensor: SensorState | null
  simulatorOn: boolean
  roomConnection: RoomConnection
}

export const useRuntime = create<RuntimeState>()(() => ({
  latestVital: {},
  sensor: null,
  simulatorOn: false,
  roomConnection: 'off',
}))

export function setRuntime(partial: Partial<RuntimeState>): void {
  useRuntime.setState(partial)
}

export function forgetLatestVital(profileId: string): void {
  useRuntime.setState((state) => {
    const { [profileId]: removed, ...rest } = state.latestVital
    void removed
    return { latestVital: rest }
  })
}
