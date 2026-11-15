// The one suggestion shown on the screen: the first of five rules that applies.
// Wording stays general. It names no doses and makes no diagnosis.

import type { DaySummary, FoodItem, TargetMap } from '@/data'
import { formatNumber, litres } from './format'

export type SuggestionRule = 'sodium' | 'energy' | 'water' | 'vitaminD' | 'onTrack'

export type Suggestion = { rule: SuggestionRule; text: string }

export type SuggestionInput = {
  today: DaySummary
  targets: TargetMap
  foods: readonly FoodItem[]
  now: Date
}

/** From this hour on, a large energy gap gets a specific suggestion. */
export const LATE_HOUR = 16

/** The two foods whose energy together comes closest to filling a gap without going far over. */
export function pairToCloseGap(
  foods: readonly FoodItem[],
  gapKcal: number,
): [FoodItem, FoodItem] | null {
  const real = foods.filter((f) => f.kcal >= 100)
  let best: { pair: [FoodItem, FoodItem]; covered: number; total: number } | null = null
  for (let i = 0; i < real.length; i++) {
    for (let j = i + 1; j < real.length; j++) {
      const a = real[i] as FoodItem
      const b = real[j] as FoodItem
      const total = a.kcal + b.kcal
      const covered = Math.min(total, gapKcal)
      if (!best || covered > best.covered || (covered === best.covered && total < best.total)) {
        best = { pair: [a, b], covered, total }
      }
    }
  }
  return best?.pair ?? null
}

/** The two lowest-sodium foods that are real food, not a supplement. */
export function lowSodiumFoods(foods: readonly FoodItem[]): FoodItem[] {
  return foods
    .filter((f) => f.kcal >= 100)
    .sort((a, b) => a.sodiumMg - b.sodiumMg || b.kcal - a.kcal || a.name.localeCompare(b.name))
    .slice(0, 2)
}

const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1)

export function suggestionFor({ today, targets, foods, now }: SuggestionInput): Suggestion {
  // 1. Sodium far over its limit.
  if (today.sodiumMg.level === 'act') {
    const picks = lowSodiumFoods(foods).map((f) => lower(f.name))
    const examples = picks.length === 2 ? ` such as ${picks[0]} or ${picks[1]}` : ''
    return {
      rule: 'sodium',
      text: `Sodium is well over the limit today. Choose lower-sodium foods${examples} for the rest of the day.`,
    }
  }

  // 2. Energy far under target, late in the day.
  const energy = today.energyKcal
  if (energy.level === 'act' && energy.value !== null && now.getHours() >= LATE_HOUR) {
    const gap = Math.max(0, Math.round(targets.energyKcal.value - energy.value))
    const pair = pairToCloseGap(foods, gap)
    const closing = pair
      ? ` ${pair[0].name} and ${lower(pair[1].name)} would close most of it.`
      : ' A snack and a full meal would help.'
    return {
      rule: 'energy',
      text: `You are about ${formatNumber(gap)} kcal under your energy target and the day is getting on.${closing}`,
    }
  }

  // 3. Water behind.
  const water = today.waterMl
  if ((water.level === 'watch' || water.level === 'act') && water.value !== null) {
    const togo = Math.max(0, targets.waterMl.value - water.value)
    return {
      rule: 'water',
      text: `You have about ${litres(togo)} L of water still to go today. Have a drink now and log it here.`,
    }
  }

  // 4. No vitamin D logged today.
  const vitaminD = today.vitaminDIu
  if (vitaminD.value === null || vitaminD.value <= 0) {
    return {
      rule: 'vitaminD',
      text: 'No vitamin D logged today. Without sunlight, your daily supplement matters, so log it from the food list when you take it.',
    }
  }

  // 5. Otherwise.
  return {
    rule: 'onTrack',
    text: 'What you have logged today is on track. Keep eating and drinking steadily and check back after your next meal.',
  }
}
