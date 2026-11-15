// Test fixtures: made-up foods, targets and day summaries. No real data.

import { metricIds, targetIds } from '@/data'
import type { Level } from '@/design'
import type { DaySummary, FoodItem, MetricId, TargetMap } from '@/data'

export const testFoods: FoodItem[] = [
  food('big-pasta', 'Big pasta', { kcal: 500, sodiumMg: 900 }),
  food('big-stew', 'Big stew', { kcal: 450, sodiumMg: 800 }),
  food('small-snack', 'Small snack', { kcal: 150, sodiumMg: 100 }),
  food('plain-nuts', 'Plain nuts', { kcal: 180, sodiumMg: 0 }),
  food('dried-fruit', 'Dried fruit', { kcal: 140, sodiumMg: 10 }),
  food('d-supplement', 'D supplement', { kcal: 0, vitaminDIu: 800 }),
]

function food(id: string, name: string, over: Partial<FoodItem>): FoodItem {
  return {
    id,
    name,
    kcal: 0,
    proteinG: 0,
    sodiumMg: 0,
    calciumMg: 0,
    ironMg: 0,
    vitaminDIu: 0,
    omega3G: 0,
    potassiumMg: 0,
    waterMl: 0,
    ...over,
  }
}

export function makeTargets(): TargetMap {
  const entries = targetIds.map((id) => [
    id,
    {
      id,
      label: id,
      kind: id === 'sodiumMg' || id === 'ironMg' ? 'max' : 'min',
      value: id === 'energyKcal' ? 3000 : id === 'waterMl' ? 2000 : 100,
      unit: 'x',
      sourceText: 'to be confirmed',
      sourceUrl: '',
      verified: false,
    },
  ])
  return Object.fromEntries(entries) as TargetMap
}

type Override = { value: number | null; level: Level }

/** A day where every metric has the given level, with a value of 1 unless it is `none`. */
export function makeDay(
  defaults: Level,
  overrides: Partial<Record<MetricId, Override | Level>> = {},
): DaySummary {
  const entries = metricIds.map((id) => {
    const given = overrides[id]
    const level = typeof given === 'string' ? given : (given?.level ?? defaults)
    const value = typeof given === 'object' ? given.value : level === 'none' ? null : 1
    return [id, { value, targetId: id, level, source: level === 'none' ? null : 'entered' }]
  })
  return { date: '2026-11-15', ...Object.fromEntries(entries) } as DaySummary
}

export const at = (hour: number) => new Date(2026, 10, 15, hour, 0, 0)
