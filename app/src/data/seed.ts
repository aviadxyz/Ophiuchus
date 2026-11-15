// The demo crew member's last 14 days, built from a fixed seed. Dates are relative to today so
// the story always ends today. Every record here has the source `simulated`.
//
// The story (docs/SCREENS.md, "Seeded story"). Day 14 is today.
//   Days 1-8   close to target, natural variation
//   Days 9-10  short nights, about five hours each
//   Days 10-11 energy intake near 70% of target, mood one to two points lower
//   Day 11     one planned session skipped, "Not feeling well"
//   Days 12-14 recovery
//   Sodium runs over its limit on most days.
//   Today is partly filled in, as if it were mid-afternoon.

import { addDays, timestampOn, toDateString } from './dates'
import { emptyProfileData } from './compute'
import { energyTargetKcal } from './targets'
import { getFood } from './foods'
import type {
  CrewProfile,
  DateString,
  ExerciseSession,
  MealEntry,
  ProfileData,
  Source,
} from './types'

export const SEED = 20261101
export const SEED_DAYS = 14

export const DEMO_PROFILE_ID = 'demo'

/** Small deterministic random numbers (mulberry32). */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function demoProfile(now: Date): CrewProfile {
  const start = addDays(toDateString(now), -(SEED_DAYS - 1))
  return {
    id: DEMO_PROFILE_ID,
    displayName: 'Demo crew member',
    role: 'Flight engineer',
    kind: 'demo',
    sex: 'male',
    birthYear: 1988,
    heightCm: 178,
    massKg: 76,
    // The demo profile holds only simulated data, so the Med bot may see its summary.
    consent: { relay: false, assistant: true },
    createdAt: timestampOn(start, 7),
  }
}

type PlanItem = {
  device: ExerciseSession['device']
  kind: ExerciseSession['kind']
  minutes: number
  detail: string
}

/** The standard day: one resistive session and one aerobic session, an hour each. */
export function dailyPlan(dayNumber: number): PlanItem[] {
  return [
    { device: 'resistive', kind: 'resistive', minutes: 60, detail: 'Resistive device, full body' },
    dayNumber % 2 === 0
      ? { device: 'cycle', kind: 'aerobic', minutes: 60, detail: 'Cycle ergometer' }
      : { device: 'treadmill', kind: 'aerobic', minutes: 60, detail: 'Treadmill with harness' },
  ]
}

/** Planned sessions for one day. Used for the seed and for member profiles. */
export function plannedSessions(
  profileId: string,
  date: DateString,
  source: Source,
  dayNumber: number,
): ExerciseSession[] {
  return dailyPlan(dayNumber).map((item, i) => ({
    id: `${profileId}-session-${date}-${i + 1}`,
    profileId,
    date,
    device: item.device,
    kind: item.kind,
    plannedMinutes: item.minutes,
    actualMinutes: 0,
    status: 'planned' as const,
    detail: item.detail,
    source,
  }))
}

type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack'
type MenuLine = [foodId: string, portions: number]
type Menu = Record<Slot, MenuLine[]>

// Three menus that rotate. Together each comes to about 2,850 kcal at one portion each.
const menus: Menu[] = [
  {
    breakfast: [
      ['scrambled-eggs', 1],
      ['cereal-milk', 1],
      ['dried-fruit-mix', 1],
    ],
    lunch: [
      ['beef-entree', 1],
      ['flour-tortilla', 1],
      ['green-beans', 1],
      ['orange-drink', 1],
      ['vitamin-d', 1],
    ],
    dinner: [
      ['chicken-rice', 1],
      ['mashed-potatoes', 1],
      ['chocolate-pudding', 1],
    ],
    snack: [
      ['almonds', 1],
      ['peanut-butter', 1],
      ['cereal-bar', 1],
      ['yogurt', 1],
      ['walnuts', 1],
    ],
  },
  {
    breakfast: [
      ['scrambled-eggs', 1],
      ['oatmeal-raisins', 1],
      ['dried-fruit-mix', 1],
    ],
    lunch: [
      ['tuna-pouch', 1],
      ['flour-tortilla', 1],
      ['green-beans', 1],
      ['dried-fruit-mix', 1],
      ['orange-drink', 1],
      ['vitamin-d', 1],
    ],
    dinner: [
      ['beef-entree', 1],
      ['mashed-potatoes', 1],
      ['green-beans', 1],
      ['chocolate-pudding', 1],
    ],
    snack: [
      ['almonds', 1],
      ['peanut-butter', 1],
      ['cereal-bar', 1],
      ['yogurt', 1],
      ['walnuts', 1],
    ],
  },
  {
    breakfast: [
      ['cereal-milk', 1],
      ['granola-blueberries', 1],
      ['scrambled-eggs', 1],
    ],
    lunch: [
      ['salmon-pouch', 1],
      ['flour-tortilla', 1],
      ['mashed-potatoes', 1],
      ['green-beans', 1],
      ['orange-drink', 1],
      ['vitamin-d', 1],
    ],
    dinner: [
      ['macaroni-cheese', 1],
      ['green-beans', 1],
      ['dried-fruit-mix', 1],
      ['chocolate-pudding', 1],
    ],
    snack: [
      ['almonds', 1],
      ['peanut-butter', 1],
      ['cereal-bar', 1],
      ['yogurt', 1],
    ],
  },
]

const menuKcal = (menu: Menu) =>
  Object.values(menu)
    .flat()
    .reduce((sum, [id, portions]) => sum + (getFood(id)?.kcal ?? 0) * portions, 0)

/** Energy eaten as a share of the target, by day number. */
const energyShare: Record<number, number> = {
  1: 0.97,
  2: 1.0,
  3: 0.95,
  4: 1.02,
  5: 0.98,
  6: 0.96,
  7: 1.0,
  8: 0.94,
  9: 0.94,
  10: 0.72,
  11: 0.7,
  12: 0.85,
  13: 0.93,
}

const sleepHoursByDay: Record<number, number> = {
  1: 7.2,
  2: 6.9,
  3: 7.4,
  4: 7.0,
  5: 6.8,
  6: 7.3,
  7: 7.1,
  8: 6.9,
  9: 5.1,
  10: 5.0,
  11: 6.2,
  12: 6.8,
  13: 7.1,
  14: 7.2,
}

const moodByDay: Record<number, { score: number; tags: string[]; note?: string }> = {
  1: { score: 4, tags: ['focused'] },
  2: { score: 4, tags: ['calm'] },
  3: { score: 5, tags: ['proud', 'calm'] },
  4: { score: 4, tags: ['focused'] },
  5: { score: 4, tags: ['calm'] },
  6: { score: 4, tags: ['focused', 'proud'] },
  7: { score: 4, tags: ['calm'] },
  8: { score: 5, tags: ['proud'] },
  9: { score: 4, tags: ['tired'] },
  10: { score: 3, tags: ['tired', 'irritable'], note: 'Short night. Everything felt slower.' },
  11: {
    score: 2,
    tags: ['tired', 'homesick'],
    note: 'Low energy today. Skipped the cycle session.',
  },
  12: { score: 3, tags: ['tired'] },
  13: { score: 4, tags: ['calm'] },
}

const roundPortion = (n: number) => Math.max(0.05, Math.round(n * 20) / 20)

const SLOT_TIMES: Record<Slot, [number, number][]> = {
  breakfast: [[7, 45]],
  lunch: [[12, 30]],
  dinner: [[18, 45]],
  snack: [
    [10, 15],
    [15, 30],
    [16, 45],
    [20, 30],
    [21, 15],
  ],
}

/**
 * Builds the demo profile and its last 14 days, ending today. The same `now` day always gives
 * the same records. Today's records are placed no later than `now`.
 */
export function buildDemoSeed(now: Date = new Date()): { profile: CrewProfile; data: ProfileData } {
  const profile = demoProfile(now)
  const today = toDateString(now)
  const target = energyTargetKcal(profile, now)
  const random = makeRandom(SEED)
  const data = emptyProfileData()
  const source: Source = 'simulated'
  const nowMs = now.getTime()
  const clamp = (iso: string) =>
    new Date(iso).getTime() > nowMs ? new Date(nowMs - 60_000).toISOString() : iso

  for (let dayNumber = 1; dayNumber <= SEED_DAYS; dayNumber++) {
    const date = addDays(today, dayNumber - SEED_DAYS)
    const isToday = dayNumber === SEED_DAYS
    const tag = `demo-${date}`

    data.sleep.push({
      id: `${tag}-sleep`,
      profileId: DEMO_PROFILE_ID,
      date,
      hours: sleepHoursByDay[dayNumber] ?? 7,
      quality: (sleepHoursByDay[dayNumber] ?? 7) < 6 ? 2 : random() < 0.5 ? 3 : 4,
      source,
    })

    // Food
    const menu = menus[dayNumber % menus.length] as Menu
    const share = isToday ? 1 : (energyShare[dayNumber] ?? 0.95)
    const scale = (share * target) / menuKcal(menu)
    const slots: Slot[] = isToday
      ? ['breakfast', 'lunch']
      : ['breakfast', 'lunch', 'dinner', 'snack']
    let mealNumber = 0
    for (const slot of slots) {
      const times = SLOT_TIMES[slot]
      menu[slot].forEach(([foodId, base], i) => {
        const [hour, minute] = times[i % times.length] as [number, number]
        const portions = foodId === 'vitamin-d' ? 1 : roundPortion(base * scale)
        const meal: MealEntry = {
          id: `${tag}-meal-${++mealNumber}`,
          profileId: DEMO_PROFILE_ID,
          at: clamp(timestampOn(date, hour, minute + (i % 3) * 5)),
          foodId,
          portions,
          source,
        }
        data.meals.push(meal)
      })
    }

    // Water, in 250 ml drinks
    const drinks = isToday
      ? 3
      : dayNumber === 10 || dayNumber === 11
        ? 6
        : dayNumber === 12
          ? 7
          : 8 + (random() < 0.4 ? 1 : 0)
    for (let i = 0; i < drinks; i++) {
      const hour = isToday ? 8 + i * 2 + (i === 2 ? 1 : 0) : 8 + Math.floor((i * 13) / drinks)
      data.water.push({
        id: `${tag}-water-${i + 1}`,
        profileId: DEMO_PROFILE_ID,
        at: clamp(timestampOn(date, hour, 20)),
        ml: 250,
        source,
      })
    }

    // Exercise
    const sessions = plannedSessions(DEMO_PROFILE_ID, date, source, dayNumber)
    sessions.forEach((session, i) => {
      if (isToday) {
        if (i === 0) {
          session.status = 'done'
          session.actualMinutes = session.plannedMinutes
        }
        return
      }
      session.status = 'done'
      session.actualMinutes = session.plannedMinutes
      if (dayNumber === 5 && i === 1) {
        session.status = 'changed'
        session.actualMinutes = 45
        session.detail = 'Shortened to 45 minutes'
      }
      if (dayNumber === 10 && i === 0) {
        session.status = 'changed'
        session.actualMinutes = 45
        session.detail = 'Shortened after a short night'
      }
      if (dayNumber === 11 && i === 1) {
        session.status = 'skipped'
        session.actualMinutes = 0
        session.skipReason = 'Not feeling well'
      }
    })
    data.sessions.push(...sessions)

    // Mood: none yet today
    const mood = moodByDay[dayNumber]
    if (mood && !isToday) {
      data.moods.push({
        id: `${tag}-mood`,
        profileId: DEMO_PROFILE_ID,
        at: timestampOn(date, 21, 0),
        score: mood.score,
        tags: mood.tags,
        ...(mood.note ? { note: mood.note } : {}),
        source,
      })
    }

    // Weekly weigh-ins
    if (dayNumber === 2 || dayNumber === 9) {
      data.bodyMass.push({
        id: `${tag}-mass`,
        profileId: DEMO_PROFILE_ID,
        date,
        kg: dayNumber === 2 ? 76.0 : 75.6,
        source,
      })
    }

    // Vitals every two hours, 08:00 to 22:00. Slightly higher heart rate after short nights.
    const lift = dayNumber >= 9 && dayNumber <= 11 ? 4 : 0
    for (let hour = 8; hour <= 22; hour += 2) {
      const heartRate = Math.round(62 + lift + random() * 10 + (hour === 16 ? 6 : 0))
      const spo2 = 96 + Math.round(random() * 2)
      const skinTempC = Math.round((33.5 + random() * 0.9) * 10) / 10
      const at = timestampOn(date, hour, 0)
      if (isToday && new Date(at).getTime() > nowMs) continue
      data.vitals.push({
        id: `${tag}-vital-${hour}`,
        profileId: DEMO_PROFILE_ID,
        at,
        heartRate,
        spo2,
        skinTempC,
        source,
      })
    }
  }
  return { profile, data }
}
