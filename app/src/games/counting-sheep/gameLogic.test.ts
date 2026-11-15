import { describe, expect, it } from 'vitest'
import {
  ASTEROIDS,
  calculateJumpPosition,
  createSheepVariation,
  isDeviceFlat,
  PhoneDownTracker,
  spawnSheep,
  updateSheep,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from './gameLogic'
import { meta } from './meta'

describe('Counting Sheep mini-game logic', () => {
  it('adheres to the GameMeta contract', () => {
    expect(meta.id).toBe('counting-sheep')
    expect(meta.label).toBe('Counting Sheep')
    expect(meta.screens).toContain('sleep')
    expect(meta.countsAsExercise).toBe(false)
    expect(meta.description.length).toBeGreaterThan(10)
  })

  it('generates distinct variations for consecutive sheep', () => {
    const sheep0 = createSheepVariation(0)
    const sheep1 = createSheepVariation(1)
    const sheep2 = createSheepVariation(2)

    expect(sheep0.name).toBeDefined()
    expect(sheep0.woolTint).toBeDefined()
    expect(sheep0.fleece).not.toBe(sheep1.fleece)
    expect(sheep1.name).not.toBe(sheep2.name)
  })

  it('spawns sheep off-screen on the left', () => {
    const sheep = spawnSheep(0)
    expect(sheep.x).toBeLessThan(0)
    expect(sheep.counted).toBe(false)
    expect(sheep.state).toBe('floating-in')
  })

  it('calculates parabolic microgravity jump arcs accurately', () => {
    const x0 = 100
    const y0 = 400
    const x1 = 300
    const y1 = 400
    const peak = 100

    const start = calculateJumpPosition(x0, y0, x1, y1, peak, 0)
    expect(start.x).toBe(100)
    expect(start.y).toBe(400)

    const apex = calculateJumpPosition(x0, y0, x1, y1, peak, 0.5)
    expect(apex.x).toBe(200)
    // At midpoint, baseline is 400, arc subtracts peak 100 -> 300
    expect(apex.y).toBe(300)

    const finish = calculateJumpPosition(x0, y0, x1, y1, peak, 1)
    expect(finish.x).toBe(300)
    expect(finish.y).toBe(400)
  })

  it('detects when sheep enters the screen and triggers counting', () => {
    const sheep = spawnSheep(1)
    expect(sheep.counted).toBe(false)

    // Simulate entry across x=0
    sheep.x = -10
    let res = updateSheep(sheep, 0.5, false)
    expect(res.justEntered).toBe(false)

    // Advance until sheep crosses x >= 0
    sheep.hopProgress = 0.6
    res = updateSheep(sheep, 0.2, false)
    expect(sheep.x).toBeGreaterThanOrEqual(0)
    expect(sheep.counted).toBe(true)
    expect(res.justEntered).toBe(true)

    // Next step should not count again
    res = updateSheep(sheep, 0.1, false)
    expect(res.justEntered).toBe(false)
  })

  it('does not advance when paused', () => {
    const sheep = spawnSheep(2)
    const startProgress = sheep.hopProgress
    const res = updateSheep(sheep, 0.5, true)
    expect(res.justEntered).toBe(false)
    expect(sheep.hopProgress).toBe(startProgress)
  })

  it('detects when mobile device is lying flat on a surface', () => {
    // Normal flat screen-up
    expect(isDeviceFlat(0, 0)).toBe(true)
    expect(isDeviceFlat(5, -4)).toBe(true)
    expect(isDeviceFlat(15, 12)).toBe(true)

    // Flat screen-down
    expect(isDeviceFlat(180, 0)).toBe(true)
    expect(isDeviceFlat(-178, 2)).toBe(true)

    // Tilted in hand (typical reading posture ~ 35 to 55 degrees)
    expect(isDeviceFlat(45, 0)).toBe(false)
    expect(isDeviceFlat(0, 45)).toBe(false)
    expect(isDeviceFlat(80, 10)).toBe(false)

    // Null orientation
    expect(isDeviceFlat(null, null)).toBe(false)
    expect(isDeviceFlat(0, null)).toBe(false)
  })

  it('tracks phone-down duration and confirms only after sustained hold', () => {
    const tracker = new PhoneDownTracker(1000)

    // 400ms flat: not yet
    expect(tracker.update(true, 400)).toBe(false)
    expect(tracker.getProgress()).toBeCloseTo(0.4)

    // brief wobble / non-flat: resets
    expect(tracker.update(false, 50)).toBe(false)
    expect(tracker.getProgress()).toBe(0)

    // 800ms flat
    expect(tracker.update(true, 800)).toBe(false)
    // another 300ms flat: exceeds 1000ms!
    expect(tracker.update(true, 300)).toBe(true)
    expect(tracker.getProgress()).toBe(1)
  })

  it('has valid layout bounds and asteroids', () => {
    expect(VIEW_WIDTH).toBe(1000)
    expect(VIEW_HEIGHT).toBe(600)
    expect(ASTEROIDS.length).toBeGreaterThanOrEqual(3)

    for (const rock of ASTEROIDS) {
      expect(rock.x).toBeGreaterThan(0)
      expect(rock.x).toBeLessThan(VIEW_WIDTH)
      expect(rock.y).toBeGreaterThan(0)
      expect(rock.y).toBeLessThan(VIEW_HEIGHT)
      expect(rock.craters.length).toBeGreaterThan(0)
    }
  })
})
