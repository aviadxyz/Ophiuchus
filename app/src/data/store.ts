// The one shared store, and every function that writes to it (CONTRACTS section 9, "Writing").
// Saved under the ophiuchus:v1: prefix. Every write stamps its own source: things a person does
// in the app are `entered`. Nothing here sends data anywhere.

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { onMinuteTick } from './clock'
import { emptyProfileData } from './compute'
import { daysBetween, dateOfTimestamp, newId, toDateString } from './dates'
import { getFood } from './foods'
import {
  safeStorage,
  sanitizeAlerts,
  sanitizeProfileData,
  sanitizeProfiles,
  STORE_KEY,
} from './persistence'
import { forgetLatestVital, setRuntime, useRuntime } from './runtime'
import { buildDemoSeed, DEMO_PROFILE_ID, plannedSessions } from './seed'
import type {
  Alert,
  AlertKind,
  AlertOrigin,
  CrewProfile,
  DateString,
  MoodCheckin,
  ProfileChanges,
  ProfileData,
  ProfileDetails,
  SessionStatus,
  VitalInput,
  VitalSample,
} from './types'

export type StoreState = {
  profiles: CrewProfile[]
  activeProfileId: string
  /** Every record, keyed by profile id. */
  data: Record<string, ProfileData>
  alerts: Alert[]
  /** The pairing code for the watch, or null. */
  room: string | null
  /** The day the demo profile was last built, so it can be rebuilt when the date moves on. */
  demoSeededOn: DateString | null
}

const emptyState = (): StoreState => ({
  profiles: [],
  activeProfileId: DEMO_PROFILE_ID,
  data: {},
  alerts: [],
  room: null,
  demoSeededOn: null,
})

const MAX_ALERTS = 200
const MAX_VITALS = 6000
/** A reading is added to the saved history at most this often. The latest reading is always kept live. */
const VITAL_HISTORY_GAP_MS = 5 * 60_000

export const useDataStore = create<StoreState>()(
  persist(emptyState, {
    name: STORE_KEY,
    version: 1,
    storage: createJSONStorage(() => safeStorage),
    merge: (persisted, current) => {
      if (typeof persisted !== 'object' || persisted === null) return current
      const p = persisted as Record<string, unknown>
      const profiles = sanitizeProfiles(p.profiles)
      const rawData =
        typeof p.data === 'object' && p.data !== null ? (p.data as Record<string, unknown>) : {}
      const data: Record<string, ProfileData> = {}
      for (const profile of profiles) data[profile.id] = sanitizeProfileData(rawData[profile.id])
      return {
        ...current,
        profiles,
        data,
        alerts: sanitizeAlerts(p.alerts).filter((a) => data[a.profileId] !== undefined),
        activeProfileId:
          typeof p.activeProfileId === 'string' ? p.activeProfileId : DEMO_PROFILE_ID,
        room: typeof p.room === 'string' && p.room.length > 0 ? p.room : null,
        demoSeededOn: typeof p.demoSeededOn === 'string' ? p.demoSeededOn : null,
      }
    },
  }),
)

const get = () => useDataStore.getState()
const set = (update: (state: StoreState) => Partial<StoreState>) => useDataStore.setState(update)

export function getActiveProfile(state: StoreState = get()): CrewProfile {
  const found = state.profiles.find((p) => p.id === state.activeProfileId)
  // `initializeStore` guarantees a demo profile, so this fallback only guards a half-built state.
  return found ?? (state.profiles.find((p) => p.id === DEMO_PROFILE_ID) as CrewProfile)
}

const nowIso = () => new Date().toISOString()

/** Changes one profile's records. Does nothing when the profile does not exist. */
function updateData(profileId: string, change: (data: ProfileData) => ProfileData) {
  set((state) => {
    const current = state.data[profileId]
    if (!current) return {}
    return { data: { ...state.data, [profileId]: change(current) } }
  })
}

function activeId(): string {
  return getActiveProfile().id
}

// ---------------------------------------------------------------------------------------------
// Start-up and the daily rollover
// ---------------------------------------------------------------------------------------------

/** Gives a member profile today's standard exercise plan if it has none. */
function ensureDailyPlan(profileId: string) {
  const state = get()
  const profile = state.profiles.find((p) => p.id === profileId)
  const data = state.data[profileId]
  if (!profile || !data || profile.kind !== 'member') return
  const today = toDateString(new Date())
  if (data.sessions.some((s) => s.date === today)) return
  const created = dateOfTimestamp(profile.createdAt) ?? today
  const dayNumber = Math.max(1, daysBetween(created, today) + 1)
  updateData(profileId, (d) => ({
    ...d,
    sessions: [...d.sessions, ...plannedSessions(profileId, today, 'entered', dayNumber)],
  }))
}

/** Builds the demo profile from the seed. Anything else about the demo profile is replaced. */
function reseedDemo(now: Date) {
  const { profile, data } = buildDemoSeed(now)
  set((state) => ({
    profiles: [profile, ...state.profiles.filter((p) => p.id !== DEMO_PROFILE_ID)],
    data: { ...state.data, [DEMO_PROFILE_ID]: data },
    alerts: state.alerts.filter((a) => a.profileId !== DEMO_PROFILE_ID),
    demoSeededOn: toDateString(now),
  }))
  forgetLatestVital(DEMO_PROFILE_ID)
}

/**
 * Makes the store ready: the demo profile exists and ends today, the active profile is real,
 * and every member has today's plan. Safe to call again.
 */
export function initializeStore(now: Date = new Date()) {
  const state = get()
  const today = toDateString(now)
  if (!state.profiles.some((p) => p.id === DEMO_PROFILE_ID) || state.demoSeededOn !== today) {
    reseedDemo(now)
  }
  if (!get().profiles.some((p) => p.id === get().activeProfileId)) {
    set(() => ({ activeProfileId: DEMO_PROFILE_ID }))
  }
  for (const profile of get().profiles) ensureDailyPlan(profile.id)
}

initializeStore()
onMinuteTick(() => initializeStore())

/** Wipes everything and starts again from the seed. For tests only. */
export function resetStoreForTests(now: Date = new Date()) {
  useDataStore.setState(emptyState(), true)
  useRuntime.setState({ latestVital: {}, sensor: null, simulatorOn: false, roomConnection: 'off' })
  initializeStore(now)
}

// ---------------------------------------------------------------------------------------------
// Food and water
// ---------------------------------------------------------------------------------------------

export function addMeal(foodId: string, portions: number): void {
  if (!getFood(foodId) || !Number.isFinite(portions) || portions <= 0 || portions > 20) return
  const profileId = activeId()
  updateData(profileId, (d) => ({
    ...d,
    meals: [
      ...d.meals,
      { id: newId('meal'), profileId, at: nowIso(), foodId, portions, source: 'entered' },
    ],
  }))
}

export function removeMeal(id: string): void {
  updateData(activeId(), (d) => ({ ...d, meals: d.meals.filter((m) => m.id !== id) }))
}

export function addWater(ml: number): void {
  if (!Number.isFinite(ml) || ml <= 0 || ml > 5000) return
  const profileId = activeId()
  updateData(profileId, (d) => ({
    ...d,
    water: [...d.water, { id: newId('water'), profileId, at: nowIso(), ml, source: 'entered' }],
  }))
}

export function removeWater(id: string): void {
  updateData(activeId(), (d) => ({ ...d, water: d.water.filter((w) => w.id !== id) }))
}

// ---------------------------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------------------------

const clampMinutes = (n: number) => Math.min(600, Math.max(0, Math.round(n * 10) / 10))

export function setSessionStatus(
  id: string,
  status: SessionStatus,
  actualMinutes?: number,
  skipReason?: string,
): void {
  updateData(activeId(), (d) => ({
    ...d,
    sessions: d.sessions.map((session) => {
      if (session.id !== id) return session
      const { skipReason: previousReason, ...rest } = session
      void previousReason
      const base = { ...rest, status, source: 'entered' as const }
      if (status === 'planned') return { ...base, actualMinutes: 0 }
      if (status === 'skipped') {
        const reason = skipReason?.trim()
        return {
          ...base,
          actualMinutes: 0,
          ...(reason ? { skipReason: reason.slice(0, 200) } : {}),
        }
      }
      const minutes =
        actualMinutes !== undefined && Number.isFinite(actualMinutes)
          ? clampMinutes(actualMinutes)
          : session.plannedMinutes
      return { ...base, actualMinutes: minutes }
    }),
  }))
}

/** Adds a done aerobic session with device `game`. */
export function logGameMinutes(gameId: string, minutes: number): void {
  if (!Number.isFinite(minutes) || minutes <= 0) return
  const profileId = activeId()
  const rounded = clampMinutes(minutes)
  updateData(profileId, (d) => ({
    ...d,
    sessions: [
      ...d.sessions,
      {
        id: newId('session'),
        profileId,
        date: toDateString(new Date()),
        device: 'game',
        kind: 'aerobic',
        plannedMinutes: rounded,
        actualMinutes: rounded,
        status: 'done',
        detail: `Game: ${gameId}`,
        source: 'entered',
      },
    ],
  }))
}

// ---------------------------------------------------------------------------------------------
// Mood, sleep and body mass
// ---------------------------------------------------------------------------------------------

const cleanTags = (tags: readonly string[]) =>
  [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 8)

const validScore = (score: number) => Number.isInteger(score) && score >= 1 && score <= 5

export function addMoodCheckin(score: number, tags: readonly string[] = [], note?: string): void {
  if (!validScore(score)) return
  const profileId = activeId()
  const text = note?.trim().slice(0, 1000)
  updateData(profileId, (d) => ({
    ...d,
    moods: [
      ...d.moods,
      {
        id: newId('mood'),
        profileId,
        at: nowIso(),
        score,
        tags: cleanTags(tags),
        ...(text ? { note: text } : {}),
        source: 'entered',
      },
    ],
  }))
}

export function updateMoodCheckin(
  id: string,
  changes: Partial<Pick<MoodCheckin, 'score' | 'tags' | 'note'>>,
): void {
  updateData(activeId(), (d) => ({
    ...d,
    moods: d.moods.map((mood) => {
      if (mood.id !== id) return mood
      const next: MoodCheckin = { ...mood, source: 'entered' }
      if (changes.score !== undefined && validScore(changes.score)) next.score = changes.score
      if (changes.tags !== undefined) next.tags = cleanTags(changes.tags)
      if ('note' in changes) {
        const text = changes.note?.trim().slice(0, 1000)
        if (text) next.note = text
        else delete next.note
      }
      return next
    }),
  }))
}

/** Records a night's sleep for the morning it ended. A second entry for the same morning replaces the first. */
export function addSleep(date: DateString, hours: number, quality?: number): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(hours) || hours < 0 || hours > 24)
    return
  const profileId = activeId()
  const q = quality !== undefined && validScore(quality) ? quality : undefined
  updateData(profileId, (d) => ({
    ...d,
    sleep: [
      ...d.sleep.filter((s) => s.date !== date),
      {
        id: newId('sleep'),
        profileId,
        date,
        hours: Math.round(hours * 10) / 10,
        ...(q !== undefined ? { quality: q } : {}),
        source: 'entered',
      },
    ],
  }))
}

/** Records today's body mass. A second weigh-in on the same day replaces the first. */
export function addBodyMass(kg: number): void {
  if (!Number.isFinite(kg) || kg < 20 || kg > 300) return
  const profileId = activeId()
  const date = toDateString(new Date())
  updateData(profileId, (d) => ({
    ...d,
    bodyMass: [
      ...d.bodyMass.filter((b) => b.date !== date),
      { id: newId('mass'), profileId, date, kg: Math.round(kg * 10) / 10, source: 'entered' },
    ],
  }))
}

// ---------------------------------------------------------------------------------------------
// Readings from sensors, the relay and the simulator
// ---------------------------------------------------------------------------------------------

const inRange = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max

/**
 * Adds one reading. The latest reading is always kept for `useLatestVitals`; the saved history
 * gets one at most every five minutes. A member profile never accepts a simulated reading.
 */
export function pushVital(sample: VitalInput): void {
  const state = get()
  const profile = state.profiles.find((p) => p.id === (sample.profileId ?? state.activeProfileId))
  if (!profile) return
  // The demo profile holds only simulated readings, and a member profile never holds one.
  if ((profile.kind === 'demo') !== (sample.source === 'simulated')) return
  const at =
    sample.at !== undefined && !Number.isNaN(new Date(sample.at).getTime()) ? sample.at : nowIso()
  const vital: VitalSample = {
    id: newId('vital'),
    profileId: profile.id,
    at,
    source: sample.source,
    ...(inRange(sample.heartRate, 20, 260) ? { heartRate: Math.round(sample.heartRate) } : {}),
    ...(inRange(sample.spo2, 50, 100) ? { spo2: Math.round(sample.spo2) } : {}),
    ...(inRange(sample.skinTempC, 20, 45)
      ? { skinTempC: Math.round(sample.skinTempC * 10) / 10 }
      : {}),
  }
  if (vital.heartRate === undefined && vital.spo2 === undefined && vital.skinTempC === undefined)
    return
  setRuntime({ latestVital: { ...useRuntime.getState().latestVital, [profile.id]: vital } })
  const history = state.data[profile.id]?.vitals ?? []
  const last = history.at(-1)
  const due =
    !last || new Date(vital.at).getTime() - new Date(last.at).getTime() >= VITAL_HISTORY_GAP_MS
  if (!due) return
  updateData(profile.id, (d) => ({ ...d, vitals: [...d.vitals, vital].slice(-MAX_VITALS) }))
}

// ---------------------------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------------------------

/** Raises an alert for the active profile and returns its id. */
export function raiseAlert(
  kind: AlertKind,
  origin: AlertOrigin,
  message: string,
  screenId?: string,
  options: { id?: string; at?: string; from?: string } = {},
): string {
  const id = options.id ?? newId('alert')
  const profileId = activeId()
  const text =
    message.trim().slice(0, 500) || (kind === 'emergency' ? 'Emergency' : 'Health question')
  const alert: Alert = {
    id,
    profileId,
    at: options.at ?? nowIso(),
    kind,
    origin,
    message: text,
    status: 'open',
    ...(screenId ? { screenId } : {}),
    ...(options.from ? { from: options.from.trim().slice(0, 40) || 'Another device' } : {}),
  }
  set((state) => ({
    alerts: [alert, ...state.alerts.filter((a) => a.id !== id)].slice(0, MAX_ALERTS),
  }))
  return id
}

function changeAlert(id: string, change: (alert: Alert) => Alert) {
  set((state) => ({ alerts: state.alerts.map((a) => (a.id === id ? change(a) : a)) }))
}

export function cancelAlert(id: string): void {
  changeAlert(id, (a) => (a.status === 'open' ? { ...a, status: 'cancelled' } : a))
}

export function acknowledgeAlert(id: string): void {
  changeAlert(id, (a) =>
    a.status === 'open' ? { ...a, status: 'acknowledged', acknowledgedAt: nowIso() } : a,
  )
}

// ---------------------------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------------------------

const cleanNumber = (n: number | undefined, min: number, max: number) =>
  n !== undefined && Number.isFinite(n) && n >= min && n <= max ? n : undefined

/**
 * Creates a team member's profile and returns its id. Throws if there is no display name.
 * Optional body mass and last night's sleep are recorded as entered values.
 */
export function createProfile(details: ProfileDetails): string {
  const displayName = details.displayName.trim().slice(0, 40)
  if (!displayName) throw new Error('A display name is required.')
  const now = new Date()
  const id = newId('member')
  const massKg = cleanNumber(details.massKg, 20, 300)
  const heightCm = cleanNumber(details.heightCm, 100, 250)
  const birthYear = cleanNumber(details.birthYear, 1900, now.getFullYear())
  const sleepHours = cleanNumber(details.lastNightSleepHours, 0, 24)
  const profile: CrewProfile = {
    id,
    displayName,
    role: details.role?.trim().slice(0, 40) || 'Crew member',
    kind: 'member',
    ...(details.sex ? { sex: details.sex } : {}),
    ...(birthYear !== undefined ? { birthYear: Math.round(birthYear) } : {}),
    ...(heightCm !== undefined ? { heightCm } : {}),
    ...(massKg !== undefined ? { massKg } : {}),
    consent: {
      relay: details.consent?.relay === true,
      assistant: details.consent?.assistant === true,
    },
    createdAt: now.toISOString(),
  }
  const today = toDateString(now)
  const data = emptyProfileData()
  if (massKg !== undefined) {
    data.bodyMass.push({
      id: newId('mass'),
      profileId: id,
      date: today,
      kg: massKg,
      source: 'entered',
    })
  }
  if (sleepHours !== undefined) {
    data.sleep.push({
      id: newId('sleep'),
      profileId: id,
      date: today,
      hours: Math.round(sleepHours * 10) / 10,
      source: 'entered',
    })
  }
  set((state) => ({
    profiles: [...state.profiles, profile],
    data: { ...state.data, [id]: data },
  }))
  ensureDailyPlan(id)
  return id
}

/** Changes a member profile. The demo profile cannot be changed. */
export function updateProfile(id: string, changes: ProfileChanges): void {
  set((state) => ({
    profiles: state.profiles.map((p) => {
      if (p.id !== id || p.kind === 'demo') return p
      const next: CrewProfile = { ...p }
      if (changes.displayName !== undefined && changes.displayName.trim()) {
        next.displayName = changes.displayName.trim().slice(0, 40)
      }
      if (changes.role !== undefined && changes.role.trim())
        next.role = changes.role.trim().slice(0, 40)
      if ('sex' in changes) {
        if (changes.sex) next.sex = changes.sex
        else delete next.sex
      }
      for (const [key, min, max] of [
        ['birthYear', 1900, new Date().getFullYear()],
        ['heightCm', 100, 250],
        ['massKg', 20, 300],
      ] as const) {
        if (!(key in changes)) continue
        const value = cleanNumber(changes[key], min, max)
        if (value === undefined) delete next[key]
        else next[key] = value
      }
      if (changes.consent) {
        next.consent = {
          relay: changes.consent.relay ?? p.consent.relay,
          assistant: changes.consent.assistant ?? p.consent.assistant,
        }
      }
      return next
    }),
  }))
}

export function setActiveProfile(id: string): void {
  const state = get()
  if (id === state.activeProfileId || !state.profiles.some((p) => p.id === id)) return
  set(() => ({ activeProfileId: id }))
  ensureDailyPlan(id)
}

/** Removes a team member and everything recorded for them. The demo profile cannot be deleted. */
export function deleteProfileData(id: string): void {
  const state = get()
  const profile = state.profiles.find((p) => p.id === id)
  if (!profile || profile.kind === 'demo' || id === DEMO_PROFILE_ID) return
  set((current) => {
    const { [id]: removed, ...data } = current.data
    void removed
    return {
      profiles: current.profiles.filter((p) => p.id !== id),
      data,
      alerts: current.alerts.filter((a) => a.profileId !== id),
      activeProfileId: current.activeProfileId === id ? DEMO_PROFILE_ID : current.activeProfileId,
    }
  })
  forgetLatestVital(id)
}

/** Restores the demo profile's seed and clears its alerts. */
export function resetDemoProfile(): void {
  reseedDemo(new Date())
}

// ---------------------------------------------------------------------------------------------
// Pairing room, used by sources/relay.ts
// ---------------------------------------------------------------------------------------------

export function setStoredRoom(code: string | null): void {
  set(() => ({ room: code }))
}
