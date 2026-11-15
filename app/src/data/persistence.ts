// Saving and loading. Storage that is missing, full or corrupted must never crash the app:
// we fall back to memory, and anything unreadable is dropped instead of thrown.

import type { StateStorage } from 'zustand/middleware'
import { isDateString } from './dates'
import type {
  Alert,
  BodyMass,
  CrewProfile,
  ExerciseSession,
  MealEntry,
  MoodCheckin,
  ProfileData,
  SleepRecord,
  VitalSample,
  WaterEntry,
} from './types'

export const STORAGE_PREFIX = 'ophiuchus:v1:'
export const STORE_KEY = `${STORAGE_PREFIX}store`

const memory = new Map<string, string>()

function backend(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
  } catch {
    return null
  }
}

/** Storage that keeps a copy in memory, so a blocked or full disk costs persistence, not the app. */
export const safeStorage: StateStorage = {
  getItem(name) {
    let raw: string | null
    try {
      raw = backend()?.getItem(name) ?? null
    } catch {
      // Storage is blocked: the memory copy is all there is.
      raw = null
    }
    raw ??= memory.get(name) ?? null
    if (raw === null) return null
    try {
      JSON.parse(raw)
      return raw
    } catch {
      // Corrupted: forget it and start clean.
      memory.delete(name)
      try {
        backend()?.removeItem(name)
      } catch {
        // Nothing more to do.
      }
      return null
    }
  },
  setItem(name, value) {
    memory.set(name, value)
    try {
      backend()?.setItem(name, value)
    } catch {
      // Full or blocked. The memory copy still serves this session.
    }
  },
  removeItem(name) {
    memory.delete(name)
    try {
      backend()?.removeItem(name)
    } catch {
      // Nothing more to do.
    }
  },
}

/** Forgets the in-memory copy. For tests. */
export function clearMemoryStorage(): void {
  memory.clear()
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isSource = (v: unknown): boolean =>
  v === 'live' || v === 'entered' || v === 'imported' || v === 'simulated'
const optNum = (v: unknown) => v === undefined || isNum(v)

function keep<T>(value: unknown, check: (item: Obj) => boolean): T[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is T => isObj(item) && check(item))
}

const common = (r: Obj) => isStr(r.id) && isStr(r.profileId) && isSource(r.source)

export function sanitizeProfileData(value: unknown): ProfileData {
  const v = isObj(value) ? value : {}
  return {
    sleep: keep<SleepRecord>(v.sleep, (r) => common(r) && isDateString(r.date) && isNum(r.hours)),
    meals: keep<MealEntry>(
      v.meals,
      (r) => common(r) && isStr(r.at) && isStr(r.foodId) && isNum(r.portions),
    ),
    water: keep<WaterEntry>(v.water, (r) => common(r) && isStr(r.at) && isNum(r.ml)),
    sessions: keep<ExerciseSession>(
      v.sessions,
      (r) =>
        common(r) &&
        isDateString(r.date) &&
        isNum(r.plannedMinutes) &&
        isNum(r.actualMinutes) &&
        ['planned', 'done', 'changed', 'skipped'].includes(r.status as string) &&
        ['resistive', 'aerobic'].includes(r.kind as string),
    ),
    moods: keep<MoodCheckin>(
      v.moods,
      (r) => common(r) && isStr(r.at) && isNum(r.score) && Array.isArray(r.tags),
    ),
    bodyMass: keep<BodyMass>(v.bodyMass, (r) => common(r) && isDateString(r.date) && isNum(r.kg)),
    vitals: keep<VitalSample>(
      v.vitals,
      (r) =>
        common(r) && isStr(r.at) && optNum(r.heartRate) && optNum(r.spo2) && optNum(r.skinTempC),
    ),
  }
}

export function sanitizeProfiles(value: unknown): CrewProfile[] {
  return keep<CrewProfile>(
    value,
    (p) =>
      isStr(p.id) &&
      isStr(p.displayName) &&
      (p.kind === 'member' || p.kind === 'demo') &&
      isObj(p.consent) &&
      typeof p.consent.relay === 'boolean' &&
      typeof p.consent.assistant === 'boolean',
  )
}

export function sanitizeAlerts(value: unknown): Alert[] {
  return keep<Alert>(
    value,
    (a) =>
      isStr(a.id) &&
      isStr(a.profileId) &&
      isStr(a.at) &&
      (a.kind === 'emergency' || a.kind === 'health') &&
      (a.origin === 'console' || a.origin === 'watch') &&
      typeof a.message === 'string' &&
      ['open', 'cancelled', 'acknowledged'].includes(a.status as string),
  )
}
