import { describe, expect, it } from 'vitest'
import {
  expectedShare,
  levelFor,
  levelForMax,
  levelForMin,
  levelForRange,
  worstLevel,
} from './levels'
import { targetsFor } from './targets'

describe('minimum targets (reach at least)', () => {
  it('is ok from 90% up', () => {
    expect(levelForMin(90, 100)).toBe('ok')
    expect(levelForMin(100, 100)).toBe('ok')
    expect(levelForMin(150, 100)).toBe('ok')
  })
  it('is watch from 70% to just under 90%', () => {
    expect(levelForMin(89.9, 100)).toBe('watch')
    expect(levelForMin(70, 100)).toBe('watch')
  })
  it('is act under 70%', () => {
    expect(levelForMin(69.9, 100)).toBe('act')
    expect(levelForMin(0, 100)).toBe('act')
  })
  it('does not lose a boundary to floating point', () => {
    expect(levelForMin(63, 90)).toBe('watch')
    expect(levelForMin(2.7, 3)).toBe('ok')
  })
})

describe('maximum targets (stay under)', () => {
  it('is ok at or under the limit', () => {
    expect(levelForMax(3500, 3500)).toBe('ok')
    expect(levelForMax(0, 3500)).toBe('ok')
  })
  it('is watch up to 20% over', () => {
    expect(levelForMax(3501, 3500)).toBe('watch')
    expect(levelForMax(4200, 3500)).toBe('watch')
  })
  it('is act more than 20% over', () => {
    expect(levelForMax(4201, 3500)).toBe('act')
  })
})

describe('range targets', () => {
  it('is ok inside, edges included', () => {
    expect(levelForRange(50, 50, 100)).toBe('ok')
    expect(levelForRange(100, 50, 100)).toBe('ok')
  })
  it('is watch within 15% outside', () => {
    expect(levelForRange(42.5, 50, 100)).toBe('watch')
    expect(levelForRange(115, 50, 100)).toBe('watch')
  })
  it('is act further outside', () => {
    expect(levelForRange(42.4, 50, 100)).toBe('act')
    expect(levelForRange(115.1, 50, 100)).toBe('act')
  })
})

describe('levelFor', () => {
  const targets = targetsFor({ massKg: 75 })
  it('is none without data', () => {
    expect(levelFor(null, targets.waterMl)).toBe('none')
    expect(levelFor(Number.NaN, targets.waterMl)).toBe('none')
  })
  it('compares with the full target by default', () => {
    expect(levelFor(1000, targets.waterMl)).toBe('act')
    expect(levelFor(2000, targets.waterMl)).toBe('ok')
  })
  it('compares with the share expected by now when one is given', () => {
    expect(levelFor(1000, targets.waterMl, 0.5)).toBe('ok')
    expect(levelFor(700, targets.waterMl, 0.5)).toBe('watch')
    expect(levelFor(600, targets.waterMl, 0.5)).toBe('act')
  })
  it('ignores the share for a maximum', () => {
    expect(levelFor(3000, targets.sodiumMg, 0.1)).toBe('ok')
    expect(levelFor(5000, targets.sodiumMg, 0.1)).toBe('act')
  })
})

describe('expectedShare', () => {
  it('counts from 07:00 to 23:00', () => {
    expect(expectedShare(6 * 60)).toBe(0)
    expect(expectedShare(7 * 60)).toBe(0)
    expect(expectedShare(15 * 60)).toBeCloseTo(0.5)
    expect(expectedShare(23 * 60)).toBe(1)
    expect(expectedShare(23 * 60 + 59)).toBe(1)
  })
})

describe('worstLevel', () => {
  it('puts act above watch above ok', () => {
    expect(worstLevel(['ok', 'watch', 'act'])).toBe('act')
    expect(worstLevel(['ok', 'watch'])).toBe('watch')
    expect(worstLevel(['ok', 'ok'])).toBe('ok')
  })
  it('ignores none unless every level is none', () => {
    expect(worstLevel(['none', 'ok'])).toBe('ok')
    expect(worstLevel(['none', 'none'])).toBe('none')
    expect(worstLevel([])).toBe('none')
  })
})
