// The current summary read outside React, for the relay.

import { buildHealthSummary, indexByDate, summarizeDay } from './compute'
import { toDateString } from './dates'
import { getActiveProfile, useDataStore } from './store'
import { targetsFor } from './targets'
import type { HealthSummary } from './types'

export function currentHealthSummary(now: Date = new Date()): HealthSummary {
  const state = useDataStore.getState()
  const profile = getActiveProfile(state)
  const data = state.data[profile.id]
  const targets = targetsFor(profile, now)
  const index = indexByDate(
    data ?? { sleep: [], meals: [], water: [], sessions: [], moods: [], bodyMass: [], vitals: [] },
  )
  const today = summarizeDay(index, toDateString(now), targets, now)
  const alerts = state.alerts.filter((a) => a.profileId === profile.id)
  return buildHealthSummary(today, alerts, targets, now)
}
