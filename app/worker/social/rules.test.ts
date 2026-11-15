import { describe, expect, it } from 'vitest'
import {
  cleanAction,
  cleanHandle,
  cleanMessage,
  cleanMood,
  cleanRole,
  isTeamHandle,
  likePattern,
  pairOf,
} from './rules'

describe('crew network rules', () => {
  it('accepts handles of 3 to 20 letters, digits or underscores only', () => {
    expect(cleanHandle('lunar_lark')).toBe('lunar_lark')
    expect(cleanHandle('ab')).toBeNull()
    expect(cleanHandle('a'.repeat(21))).toBeNull()
    expect(cleanHandle('has space')).toBeNull()
    expect(cleanHandle('semi;colon')).toBeNull()
    expect(cleanHandle(42)).toBeNull()
  })

  it('knows the team handles in any letter case', () => {
    expect(isTeamHandle('Rami')).toBe(true)
    expect(isTeamHandle('tal')).toBe(true)
    expect(isTeamHandle('ramii')).toBe(false)
  })

  it('accepts message text of 1 to 500 characters', () => {
    expect(cleanMessage('  hello  ')).toBe('hello')
    expect(cleanMessage('   ')).toBeNull()
    expect(cleanMessage('x'.repeat(501))).toBeNull()
    expect(cleanMessage(null)).toBeNull()
  })

  it('accepts a mood of a score, at most two tags and a time, and nothing else', () => {
    const at = '2026-11-15T10:00:00.000Z'
    expect(cleanMood({ score: 2, tags: ['Irritable'], at })).toEqual({
      score: 2,
      tags: ['Irritable'],
      at,
    })
    expect(cleanMood({ score: 2, tags: ['a', 'b', 'c'], at })).toBeNull()
    expect(cleanMood({ score: 6, tags: [], at })).toBeNull()
    expect(cleanMood({ score: 2.5, tags: [], at })).toBeNull()
    expect(cleanMood({ score: 2, tags: [], at: 'not a time' })).toBeNull()
    // A note is never carried, even when one is sent.
    expect(cleanMood({ score: 3, tags: [], at, note: 'private' })).toEqual({ score: 3, tags: [], at })
  })

  it('trims and caps a role', () => {
    expect(cleanRole('  Pilot ')).toBe('Pilot')
    expect(cleanRole('')).toBeNull()
    expect(cleanRole('x'.repeat(60))).toHaveLength(40)
  })

  it('orders a pair the same way from either side', () => {
    expect(pairOf('b', 'a')).toEqual(['a', 'b'])
    expect(pairOf('a', 'b')).toEqual(['a', 'b'])
  })

  it('accepts only the five relation actions', () => {
    expect(cleanAction('accept')).toBe('accept')
    expect(cleanAction('block')).toBeNull()
  })

  it('escapes wildcards in a search', () => {
    expect(likePattern('a_b%')).toBe('%a\\_b\\%%')
  })
})
