// The six space-critical nutrients and the helpers that work on them.
//
// The "why" phrases were checked on 15 November 2026 against NASA's nutrition evidence report
// (docs/REFERENCES.md, "Statements still to be confirmed") and reworded to say what the report
// says. Potassium has no source yet and shows "Source: to be confirmed".

import type { DaySummary, FoodItem, MealWithFood, MetricId, TargetMap } from '@/data'

export type NutrientId =
  'vitaminDIu' | 'calciumMg' | 'ironMg' | 'sodiumMg' | 'omega3G' | 'potassiumMg'

export type NutrientDef = {
  id: NutrientId
  label: string
  /** One short phrase: why it matters in space. */
  why: string
  /** `less` for limits (sodium, iron): the foods that help are the ones lowest in it. */
  direction: 'more' | 'less'
  /** True when the phrase was found in the report below. */
  sourced: boolean
}

/** The report the sourced phrases come from. */
export const nutrientSource = {
  text: 'Smith SM, Zwart SR, Heer M. Evidence Report: Risk Factor of Inadequate Nutrition. NASA, 2015',
  href: 'https://ntrs.nasa.gov/citations/20150000512',
}

export const nutrients: readonly NutrientDef[] = [
  {
    id: 'vitaminDIu',
    label: 'Vitamin D',
    why: 'No sunlight in space, so the body makes none.',
    direction: 'more',
    sourced: true,
  },
  {
    id: 'calciumMg',
    label: 'Calcium',
    why: 'Bone breaks down faster in weightlessness.',
    direction: 'more',
    sourced: true,
  },
  {
    id: 'ironMg',
    label: 'Iron',
    why: 'Iron stores rise early in flight, so too much matters.',
    direction: 'less',
    sourced: true,
  },
  {
    id: 'sodiumMg',
    label: 'Sodium',
    why: 'A lot of salt in flight can make bone loss worse.',
    direction: 'less',
    sourced: true,
  },
  {
    id: 'omega3G',
    label: 'Omega-3',
    why: 'Crew who ate more fish lost less bone.',
    direction: 'more',
    sourced: true,
  },
  {
    id: 'potassiumMg',
    label: 'Potassium',
    why: 'Offsets some effects of a high-salt diet.',
    direction: 'more',
    sourced: false,
  },
]

/** Metrics that have a matching amount on every food. */
export const foodAmountIds = [
  'proteinG',
  'sodiumMg',
  'calciumMg',
  'ironMg',
  'vitaminDIu',
  'omega3G',
  'potassiumMg',
] as const satisfies readonly (MetricId & keyof FoodItem)[]

export type FoodAmountId = (typeof foodAmountIds)[number]

const names: Record<FoodAmountId, string> = {
  proteinG: 'Protein',
  sodiumMg: 'Sodium',
  calciumMg: 'Calcium',
  ironMg: 'Iron',
  vitaminDIu: 'Vitamin D',
  omega3G: 'Omega-3',
  potassiumMg: 'Potassium',
}

/** How many of the six nutrients are off target: level watch or act. A nutrient with no data is not counted. */
export function countOffTarget(today: DaySummary): number {
  return nutrients.filter((n) => today[n.id].level === 'watch' || today[n.id].level === 'act')
    .length
}

/** True when none of the six nutrients has any data today. */
export function noNutrientData(today: DaySummary): boolean {
  return nutrients.every((n) => today[n.id].level === 'none')
}

/**
 * Up to `count` foods that help with a nutrient: the richest for a nutrient to reach, the lowest
 * for one to stay under. For a limit, foods with no energy (the supplement) are left out.
 */
export function helpfulFoods(
  foods: readonly FoodItem[],
  id: NutrientId,
  direction: 'more' | 'less',
  count = 3,
): FoodItem[] {
  const pool = direction === 'less' ? foods.filter((f) => f.kcal > 0) : [...foods]
  return pool
    .sort((a, b) => {
      const diff = direction === 'more' ? b[id] - a[id] : a[id] - b[id]
      return diff !== 0 ? diff : b.kcal - a.kcal || a.name.localeCompare(b.name)
    })
    .slice(0, count)
}

export type Notable = { id: FoodAmountId; label: string; amount: number; unit: string }

/** The `count` nutrients a food is richest in, judged against the daily target. */
export function notableNutrients(food: FoodItem, targets: TargetMap, count = 2): Notable[] {
  return foodAmountIds
    .map((id) => ({ id, share: food[id] / targets[id].value, amount: food[id] }))
    .filter((n) => n.amount > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, count)
    .map((n) => ({ id: n.id, label: names[n.id], amount: n.amount, unit: targets[n.id].unit }))
}

export type MealGroupId = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

export const mealGroups: readonly { id: MealGroupId; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
]

/** Breakfast 05:00 to 10:00, lunch 11:30 to 14:30, dinner 17:30 to 20:00, anything else is a snack. */
export function mealGroupOf(at: string): MealGroupId {
  const date = new Date(at)
  const minutes = date.getHours() * 60 + date.getMinutes()
  if (minutes >= 5 * 60 && minutes < 10 * 60) return 'breakfast'
  if (minutes >= 11 * 60 + 30 && minutes < 14 * 60 + 30) return 'lunch'
  if (minutes >= 17 * 60 + 30 && minutes < 20 * 60) return 'dinner'
  return 'snacks'
}

export function groupMeals(
  meals: readonly MealWithFood[],
): { id: MealGroupId; label: string; meals: MealWithFood[] }[] {
  return mealGroups
    .map((group) => ({ ...group, meals: meals.filter((m) => mealGroupOf(m.at) === group.id) }))
    .filter((group) => group.meals.length > 0)
}

/** How far body mass may fall from the first value before the note shows. */
export const MASS_DROP_LIMIT = 0.05

/** True when the latest value is more than 5% below the first. Needs two values. */
export function droppedTooFar(values: readonly number[]): boolean {
  const first = values[0]
  const latest = values.at(-1)
  if (first === undefined || latest === undefined || values.length < 2) return false
  return latest < first * (1 - MASS_DROP_LIMIT)
}
