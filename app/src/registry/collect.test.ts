import { describe, expect, it } from 'vitest'
import { collect } from './collect'

type Meta = { id: string; label: string }
const view = () => Promise.resolve({ default: () => null })

describe('registry collection', () => {
  it('pairs each meta with the index.tsx loader in the same folder', async () => {
    const result = collect<Meta, { default: () => null }>(
      'screens',
      {
        '../screens/mood/meta.ts': { meta: { id: 'mood', label: 'Mood' } },
        '../screens/sleep/meta.ts': { meta: { id: 'sleep', label: 'Sleep' } },
      },
      { '../screens/mood/index.tsx': view, '../screens/sleep/index.tsx': view },
    )
    expect(result.metas.map((m) => m.id)).toEqual(['mood', 'sleep'])
    expect(result.loaders.has('mood')).toBe(true)
    await expect(result.loaders.get('sleep')?.()).resolves.toHaveProperty('default')
  })

  it('fails with a clear message when an id does not match its folder', () => {
    expect(() =>
      collect<Meta, unknown>(
        'screens',
        { '../screens/zz-test/meta.ts': { meta: { id: 'zz', label: 'Test' } } },
        { '../screens/zz-test/index.tsx': view },
      ),
    ).toThrow(
      'screens/zz-test/meta.ts has id "zz" but its folder is "zz-test". The id must equal the folder name.',
    )
  })

  it('fails with a clear message when two ids collide', () => {
    expect(() =>
      collect<Meta, unknown>(
        'games',
        {
          '../games/futvolley/meta.ts': { meta: { id: 'futvolley', label: 'A' } },
          '../games/futvolley-copy/meta.ts': { meta: { id: 'futvolley', label: 'B' } },
        },
        { '../games/futvolley/index.tsx': view, '../games/futvolley-copy/index.tsx': view },
      ),
    ).toThrow(
      'games/futvolley/meta.ts and games/futvolley-copy/meta.ts both use the id "futvolley". Every id must be unique.',
    )
  })

  it('fails when a folder has meta.ts but no index.tsx', () => {
    expect(() =>
      collect<Meta, unknown>(
        'screens',
        { '../screens/mood/meta.ts': { meta: { id: 'mood', label: 'Mood' } } },
        {},
      ),
    ).toThrow('screens/mood/ has a meta.ts but no index.tsx.')
  })
})
