import { describe, expect, it } from 'vitest'
import { at, makeDay, makeTargets, testFoods } from './fixtures'
import { lowSodiumFoods, pairToCloseGap, suggestionFor } from './suggestion'

const targets = makeTargets()
const run = (today: ReturnType<typeof makeDay>, hour = 12) =>
  suggestionFor({ today, targets, foods: testFoods, now: at(hour) })

// A day with vitamin D logged, so rule 4 stays out of the way unless a test wants it.
const quietDay = (overrides: Parameters<typeof makeDay>[1] = {}) =>
  makeDay('ok', { vitaminDIu: { value: 800, level: 'ok' }, ...overrides })

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean)

describe('rule 1: sodium far over its limit', () => {
  it('suggests lower-sodium choices and names real low-sodium foods', () => {
    const result = run(quietDay({ sodiumMg: { value: 5000, level: 'act' } }))
    expect(result.rule).toBe('sodium')
    expect(result.text).toMatch(/lower-sodium/i)
    expect(result.text).toContain('plain nuts')
    expect(result.text).toContain('dried fruit')
    expect(result.text).not.toContain('d supplement')
  })

  it('wins over every other rule', () => {
    const result = run(
      makeDay('act', {
        sodiumMg: { value: 5000, level: 'act' },
        energyKcal: { value: 500, level: 'act' },
      }),
      18,
    )
    expect(result.rule).toBe('sodium')
  })

  it('does not apply at watch', () => {
    expect(run(quietDay({ sodiumMg: { value: 3800, level: 'watch' } })).rule).toBe('onTrack')
  })
})

describe('rule 2: energy far under target after 16:00', () => {
  const lowEnergy = quietDay({ energyKcal: { value: 1800, level: 'act' } })

  it('states the gap and names two foods that close most of it', () => {
    const result = run(lowEnergy, 17)
    expect(result.rule).toBe('energy')
    expect(result.text).toContain('1,200 kcal')
    expect(result.text).toContain('Big pasta')
    expect(result.text).toContain('big stew')
  })

  it('applies from 16:00 and not before', () => {
    expect(run(lowEnergy, 16).rule).toBe('energy')
    expect(run(lowEnergy, 15).rule).toBe('onTrack')
  })

  it('does not apply at watch', () => {
    expect(run(quietDay({ energyKcal: { value: 2400, level: 'watch' } }), 18).rule).toBe('onTrack')
  })

  it('beats the water rule', () => {
    const both = quietDay({
      energyKcal: { value: 1800, level: 'act' },
      waterMl: { value: 500, level: 'act' },
    })
    expect(run(both, 18).rule).toBe('energy')
  })
})

describe('rule 3: water behind', () => {
  it('suggests a drink and gives the amount still to go', () => {
    const result = run(quietDay({ waterMl: { value: 500, level: 'watch' } }))
    expect(result.rule).toBe('water')
    expect(result.text).toContain('1.5 L')
  })

  it('also applies at act', () => {
    expect(run(quietDay({ waterMl: { value: 200, level: 'act' } })).rule).toBe('water')
  })

  it('does not apply with no water logged', () => {
    expect(run(quietDay({ waterMl: 'none' })).rule).toBe('onTrack')
  })

  it('beats the vitamin D rule', () => {
    const both = makeDay('ok', {
      waterMl: { value: 500, level: 'watch' },
      vitaminDIu: 'none',
    })
    expect(run(both).rule).toBe('water')
  })
})

describe('rule 4: no vitamin D today', () => {
  it('reminds about the daily supplement when nothing is logged', () => {
    const result = run(makeDay('ok', { vitaminDIu: 'none' }))
    expect(result.rule).toBe('vitaminD')
    expect(result.text).toMatch(/supplement/i)
  })

  it('also applies when the logged amount is zero', () => {
    expect(run(makeDay('ok', { vitaminDIu: { value: 0, level: 'act' } })).rule).toBe('vitaminD')
  })
})

describe('rule 5: otherwise', () => {
  it('gives one positive sentence', () => {
    const result = run(quietDay())
    expect(result.rule).toBe('onTrack')
    expect(result.text).toMatch(/on track/i)
  })
})

describe('wording', () => {
  it('keeps each rule to two sentences and gives no dose or diagnosis', () => {
    const cases = [
      run(quietDay({ sodiumMg: { value: 5000, level: 'act' } })),
      run(quietDay({ energyKcal: { value: 1800, level: 'act' } }), 18),
      run(quietDay({ waterMl: { value: 500, level: 'watch' } })),
      run(makeDay('ok', { vitaminDIu: 'none' })),
      run(quietDay()),
    ]
    expect(new Set(cases.map((c) => c.rule)).size).toBe(5)
    for (const { text } of cases) {
      expect(sentences(text).length).toBeLessThanOrEqual(2)
      expect(text).not.toMatch(/\b\d+\s?(mg|IU|mcg)\b/i)
      expect(text).not.toMatch(/diagnos|disease|deficien/i)
    }
  })
})

describe('helpers', () => {
  it('pairToCloseGap covers as much of the gap as two foods can, then goes smaller', () => {
    const [a, b] = pairToCloseGap(testFoods, 5000) ?? []
    expect([a?.name, b?.name].sort()).toEqual(['Big pasta', 'Big stew'])
    const [c, d] = pairToCloseGap(testFoods, 300) ?? []
    expect((c?.kcal ?? 0) + (d?.kcal ?? 0)).toBeGreaterThanOrEqual(300)
    expect((c?.kcal ?? 0) + (d?.kcal ?? 0)).toBeLessThan(400)
  })

  it('pairToCloseGap needs two real foods', () => {
    expect(pairToCloseGap(testFoods.slice(5), 500)).toBeNull()
  })

  it('lowSodiumFoods skips a supplement', () => {
    expect(lowSodiumFoods(testFoods).map((f) => f.id)).toEqual(['plain-nuts', 'dried-fruit'])
  })
})
