import { describe, expect, it } from 'vitest'
import { indexByDate, summarizeDay } from './compute'
import { addDays, lastDates, toDateString } from './dates'
import { buildDemoSeed } from './seed'
import { targetsFor } from './targets'

// 15 November 2026, mid-afternoon, local time.
const NOW = new Date(2026, 10, 15, 15, 0, 0)
const TODAY = toDateString(NOW)
const dayNumber = (n: number) => addDays(TODAY, n - 14)

describe('demo seed', () => {
  it('gives the same data for the same day', () => {
    expect(buildDemoSeed(NOW)).toEqual(buildDemoSeed(new Date(2026, 10, 15, 15, 0, 0)))
  })

  it('ends today whatever the date', () => {
    const later = new Date(2027, 2, 3, 15, 0, 0)
    const { data } = buildDemoSeed(later)
    const dates = data.sleep.map((s) => s.date)
    expect(dates.at(-1)).toBe('2027-03-03')
    expect(dates).toHaveLength(14)
  })

  it('marks every record as simulated and belonging to the demo profile', () => {
    const { profile, data } = buildDemoSeed(NOW)
    expect(profile.id).toBe('demo')
    expect(profile.kind).toBe('demo')
    const all = Object.values(data).flat()
    expect(all.length).toBeGreaterThan(100)
    for (const record of all) {
      expect(record.source).toBe('simulated')
      expect(record.profileId).toBe('demo')
    }
  })

  it('places no record in the future', () => {
    const { data } = buildDemoSeed(NOW)
    for (const record of [...data.meals, ...data.water, ...data.moods, ...data.vitals]) {
      expect(new Date(record.at).getTime()).toBeLessThanOrEqual(NOW.getTime())
    }
  })
})

describe('the seeded story', () => {
  const { profile, data } = buildDemoSeed(NOW)
  const targets = targetsFor(profile, NOW)
  const index = indexByDate(data)
  const day = (n: number) => summarizeDay(index, dayNumber(n), targets, NOW)

  it('has 14 days, each with sleep, food, water and sessions', () => {
    for (const date of lastDates(TODAY, 14)) {
      const summary = summarizeDay(index, date, targets, NOW)
      expect(summary.sleepHours.value).not.toBeNull()
      expect(summary.energyKcal.value).not.toBeNull()
      expect(summary.waterMl.value).not.toBeNull()
      expect(summary.exerciseMinutes.value).not.toBeNull()
    }
  })

  it('has short nights, about five hours, on days 9 and 10', () => {
    expect(day(9).sleepHours.value).toBeGreaterThan(4.5)
    expect(day(9).sleepHours.value).toBeLessThan(5.5)
    expect(day(10).sleepHours.value).toBeGreaterThan(4.5)
    expect(day(10).sleepHours.value).toBeLessThan(5.5)
    expect(day(8).sleepHours.value).toBeGreaterThan(6.5)
  })

  it('has energy near 70% of target and lower mood on days 10 and 11', () => {
    for (const n of [10, 11]) {
      const ratio = (day(n).energyKcal.value ?? 0) / targets.energyKcal.value
      expect(ratio).toBeGreaterThan(0.65)
      expect(ratio).toBeLessThan(0.78)
    }
    const normalMood = day(8).moodScore.value ?? 0
    expect(normalMood - (day(10).moodScore.value ?? 9)).toBeGreaterThanOrEqual(1)
    expect(normalMood - (day(11).moodScore.value ?? 9)).toBeGreaterThanOrEqual(1)
    expect(normalMood - (day(11).moodScore.value ?? 9)).toBeLessThanOrEqual(3)
  })

  it('skips one session on day 11 with the reason "Not feeling well"', () => {
    const skipped = data.sessions.filter((s) => s.status === 'skipped')
    expect(skipped).toHaveLength(1)
    expect(skipped[0]?.date).toBe(dayNumber(11))
    expect(skipped[0]?.skipReason).toBe('Not feeling well')
  })

  it('recovers on days 12 to 14', () => {
    expect(day(12).sleepHours.value).toBeGreaterThan(day(10).sleepHours.value ?? 99)
    expect(day(13).energyKcal.value).toBeGreaterThan(day(11).energyKcal.value ?? 99)
    expect(day(13).moodScore.value).toBeGreaterThan(day(11).moodScore.value ?? 99)
  })

  it('runs over the sodium limit on most days', () => {
    const over = lastDates(TODAY, 13).filter(
      (date) =>
        (summarizeDay(index, date, targets, NOW).sodiumMg.value ?? 0) > targets.sodiumMg.value,
    )
    expect(over.length).toBeGreaterThanOrEqual(8)
  })

  it('fills today partly: breakfast and lunch, one of two sessions, no mood check-in', () => {
    const meals = data.meals.filter(
      (m) => m.at.startsWith(TODAY) || new Date(m.at).getDate() === 15,
    )
    expect(meals.length).toBeGreaterThan(0)
    const today = data.sessions.filter((s) => s.date === TODAY)
    expect(today).toHaveLength(2)
    expect(today.filter((s) => s.status === 'done')).toHaveLength(1)
    expect(today.filter((s) => s.status === 'planned')).toHaveLength(1)
    expect(day(14).moodScore.value).toBeNull()
    expect(day(14).moodScore.level).toBe('none')
    expect(day(14).sleepHours.value).not.toBeNull()
  })

  it('never gives heart rate a level', () => {
    expect(day(14).heartRate.value).not.toBeNull()
    expect(day(14).heartRate.level).toBe('none')
  })
})
