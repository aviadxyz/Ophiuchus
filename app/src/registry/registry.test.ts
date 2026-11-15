import { describe, expect, it } from 'vitest'
import { getScreen, loadGuide, screens, screensByGroup } from '@/registry'

const contractIds = [
  'overview',
  'risks',
  'environment',
  'sleep',
  'medical-status',
  'mental-health',
  'performance',
  'medbot',
  'nutrition',
  'physical-activity',
  'mood',
  'social',
  'research',
  'watch',
  'about',
  'admin',
  'emergency',
]

describe('registry', () => {
  it('collects all seventeen screens from CONTRACTS section 3', () => {
    expect(screens.map((s) => s.id).sort()).toEqual([...contractIds].sort())
  })

  it('orders screens by group, then order', () => {
    expect(screensByGroup('console').map((s) => s.id)).toEqual([
      'overview',
      'risks',
      'environment',
      'sleep',
      'medical-status',
      'mental-health',
      'performance',
      'medbot',
    ])
    expect(screensByGroup('daily').map((s) => s.id)).toEqual([
      'nutrition',
      'physical-activity',
      'mood',
      'social',
    ])
    expect(screensByGroup('reference').map((s) => s.id)).toEqual(['research', 'watch', 'about', 'admin'])
    expect(screensByGroup('pinned').map((s) => s.id)).toEqual(['emergency'])
  })

  it('finds a screen by id', () => {
    expect(getScreen('mood')?.label).toBe('Mood')
    expect(getScreen('nope')).toBeUndefined()
  })

  it('loads a guide with all four fields', async () => {
    const guide = await loadGuide('sleep')
    expect(guide).toMatchObject({
      shows: expect.any(String),
      whyItMatters: expect.any(String),
      whenToAct: expect.any(String),
    })
    expect(guide?.howToRead.length).toBeLessThanOrEqual(3)
  })
})
