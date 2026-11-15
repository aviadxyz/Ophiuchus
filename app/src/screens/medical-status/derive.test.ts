import { describe, expect, it } from 'vitest'
import { levelFor, type Target } from '@/data'
import { countLevels, headerPills, visibleActions } from './derive'
import { actions, areas, markers, plan, tiles, type Marker } from './sample'

const withLevel = (level: Marker['level']): Marker => ({ ...(markers[0] as Marker), level })

describe('the sample record', () => {
  it('has the levels of the design: 1 act, 4 watch, 2 on target', () => {
    expect(countLevels(markers)).toEqual({ act: 1, watch: 4, ok: 2, none: 0 })
  })

  it('has levels that follow the level rules of CONTRACTS section 7', () => {
    for (const marker of markers) {
      if (!marker.rule) continue
      const { kind, value, upper, now } = marker.rule
      const target: Target = {
        id: 'heartRate',
        label: marker.plainName,
        kind,
        value,
        ...(upper !== undefined ? { upper } : {}),
        unit: '',
        sourceText: '',
        sourceUrl: '',
        verified: false,
      }
      expect(levelFor(now, target), marker.plainName).toBe(marker.level)
    }
  })

  it('has tiles that match their markers', () => {
    const followed = tiles.filter((t) => t.markerId)
    expect(followed).toHaveLength(3)
    for (const tile of followed) {
      const marker = markers.find((m) => m.id === tile.markerId)
      expect(marker, tile.label).toBeDefined()
      expect(marker?.nowText).toContain(String(tile.value))
      expect(marker?.trend).toHaveLength(3)
    }
  })

  it('has four active areas, each moderate or mild', () => {
    expect(areas).toHaveLength(4)
    for (const area of areas) expect(area.pill).toMatch(/^ACTIVE · (MODERATE|MILD)$/)
  })

  it('gives no medicine amount and no instruction to start, stop or change a medicine', () => {
    const text = [...plan.map((p) => `${p.label} ${p.text}`), ...actions.map((a) => a.text)].join(
      '\n',
    )
    expect(text).not.toMatch(/\d+\s?(mg|mcg|µg|g|ml|iu|units?|tablets?|pills?|capsules?)\b/i)
    expect(text).not.toMatch(/\b(start|stop|increase|decrease|double|skip)\b.*\b(medicine|dose)\b/i)
    expect(text).toContain('as prescribed')
    expect(text).toContain("Only on the flight surgeon's instruction")
  })

  it('uses no calendar dates or mission-day numbers', () => {
    const text = JSON.stringify({ markers, areas, plan, actions, tiles })
    expect(text).not.toMatch(/\b20\d\d\b/)
    expect(text).not.toMatch(/\b(flight|mission) day\b/i)
  })
})

describe('headerPills', () => {
  it('counts from the marker list, worst first', () => {
    expect(headerPills()).toEqual([
      { tone: 'danger', label: '1 ACT' },
      { tone: 'warn', label: '4 WATCH' },
      { tone: 'ok', label: '2 ON TARGET' },
    ])
  })

  it('is only ON TARGET when everything is fine', () => {
    expect(headerPills([withLevel('ok'), withLevel('ok')])).toEqual([
      { tone: 'ok', label: '2 ON TARGET' },
    ])
  })
})

describe('visibleActions', () => {
  it('shows all five in the sample, which is fixed in the "something is wrong" state', () => {
    expect(visibleActions().map((a) => a.number)).toEqual([1, 2, 3, 4, 5])
  })

  it('shows only the routine items 1 to 3 when everything is fine', () => {
    expect(visibleActions([withLevel('ok')], false).map((a) => a.number)).toEqual([1, 2, 3])
  })

  it('adds item 4 for a marker at ACT and item 5 for symptoms, separately', () => {
    expect(visibleActions([withLevel('act')], false).map((a) => a.number)).toEqual([1, 2, 3, 4])
    expect(visibleActions([withLevel('ok')], true).map((a) => a.number)).toEqual([1, 2, 3, 5])
  })

  it('puts the Med bot button under item 4, Nutrition under 3 and Emergency under 5', () => {
    const byButton = Object.fromEntries(
      actions.filter((a) => a.button).map((a) => [a.button, a.number]),
    )
    expect(byButton).toEqual({ nutrition: 3, medbot: 4, emergency: 5 })
  })
})
