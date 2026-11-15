import { describe, expect, it } from 'vitest'
import { levelLabel, levelTone } from '@/design'

describe('level to tone', () => {
  it('maps every level as CONTRACTS section 7 says', () => {
    expect(levelTone).toEqual({ ok: 'ok', watch: 'warn', act: 'danger', none: 'neutral' })
  })

  it('labels every level', () => {
    expect(levelLabel).toEqual({ ok: 'ON TARGET', watch: 'WATCH', act: 'ACT', none: 'NO DATA' })
  })
})
