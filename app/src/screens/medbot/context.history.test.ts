import { describe, expect, it } from 'vitest'
import { buildChatContext, type ContextBuilderData } from './context'
import { medicalRecordFor } from './medicalRecord'

const none = { value: null, targetId: 'x', level: 'none', source: null }
const base = {
  screenLabel: 'Med bot',
  mission: { name: 'Ophiuchus-1', day: 15, lengthDays: 180, location: 'leo', commDelaySeconds: 0 },
  today: {
    date: '2026-11-15',
    sleepHours: none,
    energyKcal: none,
    waterMl: none,
    exerciseMinutes: none,
    moodScore: none,
  },
  targets: {
    energyKcal: { value: 2850 },
    waterMl: { value: 2000 },
    exerciseMinutes: { value: 120 },
  },
} as unknown as ContextBuilderData

describe('Med bot context: one profile, its own history', () => {
  it('sends a missing value as "no data", never as a number', () => {
    const text = buildChatContext({ ...base, profile: { kind: 'member', consent: { assistant: true } } })
    expect(text).toContain('food: today no data of 2850 kcal')
    expect(text).toContain('water: today no data of 2 L')
    expect(text).toContain('today no data sessions')
    expect(text).not.toMatch(/1 of 2 sessions/)
  })

  it('carries the 14-day history with gaps shown as dashes', () => {
    const text = buildChatContext({
      ...base,
      profile: { kind: 'member', consent: { assistant: true } },
      history: {
        sleepHours: [
          { date: '2026-11-13', value: 7.24 },
          { date: '2026-11-14', value: null },
          { date: '2026-11-15', value: 6.1 },
        ],
      },
    })
    expect(text).toContain('history, last 3 days')
    expect(text).toContain('sleep hours: 7.2, -, 6.1')
    expect(text).toContain('energy kcal: no data')
  })

  it('gives the demo profile its sample record and a team member none', () => {
    expect(medicalRecordFor({ kind: 'demo' })).toContain('sample record')
    expect(medicalRecordFor({ kind: 'member' })).toBeNull()
    const member = buildChatContext({
      ...base,
      profile: { kind: 'member', consent: { assistant: true } },
      medicalRecord: medicalRecordFor({ kind: 'member' }),
    })
    expect(member).toContain('medical record on file: none entered for this profile')
    expect(member).not.toContain('inflammatory')
  })

  it('sends nothing about the person when they have not allowed it', () => {
    const text = buildChatContext({
      ...base,
      profile: { kind: 'member', consent: { assistant: false } },
      history: { sleepHours: [{ date: '2026-11-15', value: 7 }] },
      medicalRecord: 'something private',
      basics: { role: 'Pilot', birthYear: 1990 },
    })
    expect(text).not.toContain('history')
    expect(text).not.toContain('something private')
    expect(text).not.toContain('Pilot')
  })

  it('never carries a name', () => {
    const text = buildChatContext({
      ...base,
      profile: { kind: 'member', consent: { assistant: true } },
      basics: { role: 'Pilot', sex: 'female', birthYear: 1990, heightCm: 170, massKg: 62 },
    })
    expect(text).toContain('role Pilot')
    expect(text).not.toMatch(/displayName|Rami|Aviad|Shoval|Elia|Tal\b/)
  })
})
