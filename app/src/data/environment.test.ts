import { describe, expect, it } from 'vitest'
import { environmentAt, environmentSeries } from './environment'
import { environmentMetricIds } from './types'

const START = Date.UTC(2026, 10, 14, 0, 0, 0)
const HOUR = 3_600_000

describe('environmentAt', () => {
  it('gives the same sample for the same moment', () => {
    const at = new Date(START + 12_345_678)
    expect(environmentAt(at)).toEqual(environmentAt(new Date(at.getTime())))
  })

  it('is always simulated and has a number for every metric', () => {
    const sample = environmentAt(new Date(START))
    expect(sample.source).toBe('simulated')
    for (const id of environmentMetricIds) expect(Number.isFinite(sample[id])).toBe(true)
  })

  it('stays inside sensible bounds over 48 hours and never jumps', () => {
    let previous = environmentAt(new Date(START))
    for (let minute = 0; minute <= 48 * 60; minute += 5) {
      const s = environmentAt(new Date(START + minute * 60_000))
      expect(s.temperatureC).toBeGreaterThan(21)
      expect(s.temperatureC).toBeLessThan(24)
      expect(s.humidityPct).toBeGreaterThan(37)
      expect(s.humidityPct).toBeLessThan(53)
      expect(s.oxygenPct).toBeGreaterThan(20.5)
      expect(s.oxygenPct).toBeLessThan(21.3)
      expect(s.co2MmHg).toBeGreaterThan(2)
      expect(s.co2MmHg).toBeLessThan(3.3)
      expect(s.noiseDb).toBeGreaterThan(53)
      expect(s.noiseDb).toBeLessThan(67)
      expect(s.radiationUSvPerHour).toBeGreaterThan(17)
      expect(s.radiationUSvPerHour).toBeLessThan(36)
      expect(s.mosfetInsideUGyPerHour).toBeGreaterThan(5)
      expect(s.mosfetInsideUGyPerHour).toBeLessThan(15)
      expect(Math.abs(s.radiationUSvPerHour - previous.radiationUSvPerHour)).toBeLessThan(3)
      previous = s
    }
  })

  it('has more carbon dioxide in the crew night than in the afternoon', () => {
    const night = environmentAt(new Date(START + 2 * HOUR))
    const afternoon = environmentAt(new Date(START + 14 * HOUR))
    expect(night.co2MmHg).toBeGreaterThan(afternoon.co2MmHg)
  })

  it('reads gravity from the mission', () => {
    expect(environmentAt(new Date(START)).gravityG).toBe(0)
  })

  it('has the outside MOSFET above the inside one', () => {
    for (let hour = 0; hour < 48; hour += 1) {
      const s = environmentAt(new Date(START + hour * HOUR))
      expect(s.mosfetOutsideUGyPerHour).toBeGreaterThan(s.mosfetInsideUGyPerHour)
    }
  })
})

describe('environmentSeries', () => {
  it('has one entry per hour, oldest first, all simulated', () => {
    const series = environmentSeries('co2MmHg', 24, new Date(START + 30 * 60_000))
    expect(series).toHaveLength(24)
    expect(series.every((p) => p.source === 'simulated')).toBe(true)
    for (let i = 1; i < series.length; i += 1) {
      const a = series[i - 1]
      const b = series[i]
      expect(new Date(b!.at).getTime() - new Date(a!.at).getTime()).toBe(HOUR)
    }
    expect(series[23]!.at).toBe(new Date(START).toISOString())
  })
})
