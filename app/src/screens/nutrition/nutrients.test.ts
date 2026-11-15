import { describe, expect, it } from 'vitest'
import { makeDay, makeTargets, testFoods } from './fixtures'
import {
  countOffTarget,
  droppedTooFar,
  groupMeals,
  helpfulFoods,
  mealGroupOf,
  noNutrientData,
  notableNutrients,
} from './nutrients'

describe('countOffTarget ("N off target")', () => {
  it('counts the six nutrients at watch or act', () => {
    const day = makeDay('ok', {
      vitaminDIu: 'watch',
      calciumMg: 'act',
      ironMg: 'ok',
      sodiumMg: 'watch',
      omega3G: 'ok',
      potassiumMg: 'ok',
    })
    expect(countOffTarget(day)).toBe(3)
  })

  it('is zero when all six are on target', () => {
    expect(countOffTarget(makeDay('ok'))).toBe(0)
  })

  it('is six when all six are off', () => {
    expect(countOffTarget(makeDay('act'))).toBe(6)
  })

  it('does not count nutrients with no data', () => {
    expect(countOffTarget(makeDay('none', { sodiumMg: 'act' }))).toBe(1)
  })

  it('ignores metrics that are not among the six', () => {
    expect(
      countOffTarget(makeDay('ok', { energyKcal: 'act', waterMl: 'act', proteinG: 'act' })),
    ).toBe(0)
  })

  it('knows when there is no nutrient data at all', () => {
    expect(noNutrientData(makeDay('none'))).toBe(true)
    expect(noNutrientData(makeDay('none', { ironMg: 'ok' }))).toBe(false)
    expect(noNutrientData(makeDay('none', { energyKcal: 'ok' }))).toBe(true)
  })
})

describe('helpfulFoods', () => {
  it('gives the richest first for a nutrient to reach', () => {
    expect(helpfulFoods(testFoods, 'vitaminDIu', 'more', 1).map((f) => f.id)).toEqual([
      'd-supplement',
    ])
  })

  it('gives the lowest first for a limit, leaving out foods with no energy', () => {
    const ids = helpfulFoods(testFoods, 'sodiumMg', 'less').map((f) => f.id)
    expect(ids).toEqual(['plain-nuts', 'dried-fruit', 'small-snack'])
  })

  it('does not change the list it is given', () => {
    const before = testFoods.map((f) => f.id)
    helpfulFoods(testFoods, 'sodiumMg', 'less')
    expect(testFoods.map((f) => f.id)).toEqual(before)
  })
})

describe('notableNutrients', () => {
  it('picks the two nutrients a food is richest in, against the daily target', () => {
    const food = { ...testFoods[0]!, proteinG: 50, calciumMg: 200, sodiumMg: 10 }
    const result = notableNutrients(food, makeTargets())
    expect(result.map((n) => n.id)).toEqual(['calciumMg', 'proteinG'])
  })

  it('gives nothing for a food with none of them', () => {
    expect(notableNutrients({ ...testFoods[0]!, sodiumMg: 0 }, makeTargets())).toEqual([])
  })
})

describe('meal groups', () => {
  const local = (h: number, m = 0) => new Date(2026, 10, 15, h, m).toISOString()
  it('sorts by time of day', () => {
    expect(mealGroupOf(local(7, 45))).toBe('breakfast')
    expect(mealGroupOf(local(10, 15))).toBe('snacks')
    expect(mealGroupOf(local(12, 30))).toBe('lunch')
    expect(mealGroupOf(local(15, 30))).toBe('snacks')
    expect(mealGroupOf(local(18, 45))).toBe('dinner')
    expect(mealGroupOf(local(21, 15))).toBe('snacks')
    expect(mealGroupOf(local(2, 0))).toBe('snacks')
  })

  it('keeps the order breakfast, lunch, dinner, snacks and drops empty groups', () => {
    const meal = (id: string, at: string) => ({
      id,
      profileId: 'x',
      at,
      foodId: 'f',
      portions: 1,
      source: 'entered' as const,
      food: testFoods[0]!,
    })
    const groups = groupMeals([meal('a', local(21)), meal('b', local(8)), meal('c', local(19))])
    expect(groups.map((g) => g.id)).toEqual(['breakfast', 'dinner', 'snacks'])
  })
})

describe('droppedTooFar', () => {
  it('is true only when the latest is more than 5% below the first', () => {
    expect(droppedTooFar([80, 76])).toBe(false)
    expect(droppedTooFar([80, 75.9])).toBe(true)
    expect(droppedTooFar([80, 70, 79])).toBe(false)
  })
  it('needs at least two values', () => {
    expect(droppedTooFar([])).toBe(false)
    expect(droppedTooFar([70])).toBe(false)
  })
})
