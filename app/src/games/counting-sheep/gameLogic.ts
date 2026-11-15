export type FleeceColor =
  | 'cloud-white'
  | 'warm-cream'
  | 'lavender-dream'
  | 'starlight-peach'
  | 'mint-breeze'
  | 'moon-silver'

export type Expression = 'sleepy' | 'peaceful' | 'curious' | 'winking'

export type Accessory = 'star-badge' | 'antenna' | 'sleep-cap' | 'mission-patch' | 'ribbon'

export type SheepState =
  | 'floating-in'
  | 'on-rock'
  | 'jumping'
  | 'landing'
  | 'floating-out'
  | 'resting'

export interface SheepVariation {
  id: number
  name: string
  fleece: FleeceColor
  expression: Expression
  accessory: Accessory
  woolTint: string
  accentColor: string
}

export interface Asteroid {
  id: number
  x: number
  y: number
  radiusX: number
  radiusY: number
  tilt: number
  craters: Array<{ cx: number; cy: number; r: number }>
}

export interface Sheep {
  id: number
  variation: SheepVariation
  state: SheepState
  currentAsteroid: number
  targetAsteroid: number
  x: number
  y: number
  rotation: number
  scale: number
  hopProgress: number
  hopDuration: number
  restTimer: number
  jumpPeak: number
  counted: boolean
}

export const VIEW_WIDTH = 1000
export const VIEW_HEIGHT = 600
export const ROUND_DURATION_SECONDS = 75

export const ASTEROIDS: readonly Asteroid[] = [
  {
    id: 0,
    x: 130,
    y: 430,
    radiusX: 75,
    radiusY: 40,
    tilt: -4,
    craters: [
      { cx: -25, cy: -8, r: 9 },
      { cx: 20, cy: 6, r: 12 },
      { cx: -5, cy: 15, r: 7 },
    ],
  },
  {
    id: 1,
    x: 390,
    y: 470,
    radiusX: 85,
    radiusY: 44,
    tilt: 3,
    craters: [
      { cx: -30, cy: 4, r: 11 },
      { cx: 15, cy: -10, r: 8 },
      { cx: 35, cy: 8, r: 6 },
    ],
  },
  {
    id: 2,
    x: 640,
    y: 390,
    radiusX: 80,
    radiusY: 42,
    tilt: -2,
    craters: [
      { cx: -18, cy: -6, r: 10 },
      { cx: 12, cy: 8, r: 13 },
      { cx: -35, cy: 8, r: 6 },
    ],
  },
  {
    id: 3,
    x: 870,
    y: 440,
    radiusX: 78,
    radiusY: 40,
    tilt: 5,
    craters: [
      { cx: -20, cy: 5, r: 10 },
      { cx: 18, cy: -8, r: 8 },
      { cx: 30, cy: 12, r: 7 },
    ],
  },
]

const SHEEP_NAMES = [
  'Luna',
  'Nova',
  'Cosmo',
  'Astra',
  'Orion',
  'Lyra',
  'Vega',
  'Stella',
  'Comet',
  'Apollo',
  'Halo',
  'Zephyr',
]

const FLEECE_COLORS: readonly FleeceColor[] = [
  'cloud-white',
  'warm-cream',
  'lavender-dream',
  'starlight-peach',
  'mint-breeze',
  'moon-silver',
]

const EXPRESSIONS: readonly Expression[] = ['sleepy', 'peaceful', 'curious', 'winking']

const ACCESSORIES: readonly Accessory[] = [
  'star-badge',
  'antenna',
  'sleep-cap',
  'mission-patch',
  'ribbon',
]

const WOOL_TINT_MAP: Record<FleeceColor, string> = {
  'cloud-white': '#f5f7fb',
  'warm-cream': '#f9f6e8',
  'lavender-dream': '#ede9fe',
  'starlight-peach': '#ffedd5',
  'mint-breeze': '#ecfdf5',
  'moon-silver': '#e2e8f0',
}

const ACCENT_COLOR_MAP: Record<Accessory, string> = {
  'star-badge': '#f59e0b',
  antenna: '#34d399',
  'sleep-cap': '#5b8def',
  'mission-patch': '#e0a93b',
  ribbon: '#f26d6d',
}

/**
 * Creates a unique variation for each sheep based on its index.
 */
export function createSheepVariation(index: number): SheepVariation {
  const name = SHEEP_NAMES[index % SHEEP_NAMES.length] ?? `Sheep ${index + 1}`
  const fleece = FLEECE_COLORS[index % FLEECE_COLORS.length] ?? 'cloud-white'
  const expression = EXPRESSIONS[Math.floor(index / 2) % EXPRESSIONS.length] ?? 'sleepy'
  const accessory = ACCESSORIES[(index * 3) % ACCESSORIES.length] ?? 'star-badge'

  return {
    id: index,
    name,
    fleece,
    expression,
    accessory,
    woolTint: WOOL_TINT_MAP[fleece],
    accentColor: ACCENT_COLOR_MAP[accessory],
  }
}

/**
 * Spawns a new sheep at the left off-screen boundary.
 */
export function spawnSheep(index: number): Sheep {
  const variation = createSheepVariation(index)
  const startX = -80
  const startY = 380

  return {
    id: index,
    variation,
    state: 'floating-in',
    currentAsteroid: -1,
    targetAsteroid: 0,
    x: startX,
    y: startY,
    rotation: -4,
    scale: 0.95 + (index % 3) * 0.05,
    hopProgress: 0,
    hopDuration: 2.2,
    restTimer: 0,
    jumpPeak: 90 + (index % 4) * 15,
    counted: false,
  }
}

/**
 * Calculates parabolic microgravity jump position between (x0, y0) and (x1, y1).
 * tau in [0, 1].
 */
export function calculateJumpPosition(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  peakHeight: number,
  tau: number,
): { x: number; y: number; rotation: number } {
  const clampedTau = Math.max(0, Math.min(1, tau))
  const x = x0 + (x1 - x0) * clampedTau
  const baselineY = y0 + (y1 - y0) * clampedTau
  const arcOffset = 4 * peakHeight * clampedTau * (1 - clampedTau)
  const y = baselineY - arcOffset

  // Rotation tilts up during rise and gently down during descent
  const dy_dtau = (y1 - y0) - 4 * peakHeight * (1 - 2 * clampedTau)
  const dx_dtau = x1 - x0
  const angleRad = Math.atan2(dy_dtau, dx_dtau)
  const rotation = Math.max(-20, Math.min(20, (angleRad * 180) / Math.PI * 0.4))

  return { x, y, rotation }
}

/**
 * Updates a sheep's state over delta seconds.
 * Returns true if the sheep just entered the visible screen and should be counted.
 */
export function updateSheep(
  sheep: Sheep,
  deltaSec: number,
  isPaused: boolean,
): { justEntered: boolean; shouldRemove: boolean } {
  if (isPaused) {
    return { justEntered: false, shouldRemove: false }
  }

  let justEntered = false
  let shouldRemove = false

  if (sheep.state === 'floating-in') {
    sheep.hopProgress += deltaSec / sheep.hopDuration
    const target = ASTEROIDS[0]
    const landingY = target.y - target.radiusY - 18
    const { x, y, rotation } = calculateJumpPosition(
      -80,
      380,
      target.x,
      landingY,
      sheep.jumpPeak,
      sheep.hopProgress,
    )
    sheep.x = x
    sheep.y = y
    sheep.rotation = rotation

    // Check entry into screen
    if (!sheep.counted && sheep.x >= 0) {
      sheep.counted = true
      justEntered = true
    }

    if (sheep.hopProgress >= 1) {
      sheep.state = 'on-rock'
      sheep.currentAsteroid = 0
      sheep.targetAsteroid = 1
      sheep.hopProgress = 0
      sheep.restTimer = 1.4
      sheep.rotation = ASTEROIDS[0].tilt
    }
  } else if (sheep.state === 'on-rock') {
    sheep.restTimer -= deltaSec
    // Gentle breathing idle bob
    const rock = ASTEROIDS[sheep.currentAsteroid]
    if (rock) {
      sheep.x = rock.x
      sheep.y = rock.y - rock.radiusY - 18 + Math.sin(sheep.restTimer * 3) * 2
      sheep.rotation = rock.tilt
    }

    if (sheep.restTimer <= 0) {
      sheep.state = 'jumping'
      sheep.hopProgress = 0
      sheep.hopDuration = 2.4
    }
  } else if (sheep.state === 'jumping') {
    sheep.hopProgress += deltaSec / sheep.hopDuration
    const fromRock = ASTEROIDS[sheep.currentAsteroid]
    const toRock = ASTEROIDS[sheep.targetAsteroid]

    if (fromRock && toRock) {
      const startX = fromRock.x
      const startY = fromRock.y - fromRock.radiusY - 18
      const targetX = toRock.x
      const targetY = toRock.y - toRock.radiusY - 18

      const { x, y, rotation } = calculateJumpPosition(
        startX,
        startY,
        targetX,
        targetY,
        sheep.jumpPeak,
        sheep.hopProgress,
      )
      sheep.x = x
      sheep.y = y
      sheep.rotation = rotation

      if (sheep.hopProgress >= 1) {
        sheep.currentAsteroid = sheep.targetAsteroid
        sheep.targetAsteroid = sheep.currentAsteroid + 1
        sheep.hopProgress = 0
        sheep.rotation = toRock.tilt

        if (sheep.currentAsteroid >= ASTEROIDS.length - 1) {
          // Reached last rock, get ready to float out
          sheep.state = 'floating-out'
          sheep.restTimer = 1.2
        } else {
          sheep.state = 'on-rock'
          sheep.restTimer = 1.3
        }
      }
    }
  } else if (sheep.state === 'floating-out') {
    if (sheep.restTimer > 0) {
      sheep.restTimer -= deltaSec
      const rock = ASTEROIDS[ASTEROIDS.length - 1]
      sheep.x = rock.x
      sheep.y = rock.y - rock.radiusY - 18 + Math.sin(sheep.restTimer * 3) * 2
      sheep.rotation = rock.tilt
    } else {
      sheep.hopProgress += deltaSec / 2.6
      const lastRock = ASTEROIDS[ASTEROIDS.length - 1]
      const startX = lastRock.x
      const startY = lastRock.y - lastRock.radiusY - 18
      const exitX = VIEW_WIDTH + 100
      const exitY = 320

      const { x, y, rotation } = calculateJumpPosition(
        startX,
        startY,
        exitX,
        exitY,
        sheep.jumpPeak * 1.2,
        sheep.hopProgress,
      )
      sheep.x = x
      sheep.y = y
      sheep.rotation = rotation

      if (sheep.hopProgress >= 1 || sheep.x > VIEW_WIDTH + 80) {
        shouldRemove = true
      }
    }
  }

  return { justEntered, shouldRemove }
}

/**
 * Determines whether a mobile device is lying flat on a surface (e.g. table, bed, or console shelf).
 * Screen facing up: |beta| <= tolerance and |gamma| <= tolerance
 * Screen facing down: |beta| >= (180 - tolerance) and |gamma| <= tolerance
 */
export function isDeviceFlat(
  beta: number | null,
  gamma: number | null,
  toleranceDegrees = 18,
): boolean {
  if (beta === null || gamma === null) return false
  const absBeta = Math.abs(beta)
  const absGamma = Math.abs(gamma)

  const isFlatUp = absBeta <= toleranceDegrees && absGamma <= toleranceDegrees
  const isFlatDown = absBeta >= 180 - toleranceDegrees && absGamma <= toleranceDegrees

  return isFlatUp || isFlatDown
}

/**
 * Helper tracker for requiring the phone to remain flat for a sustained duration
 * (e.g. 1.0 second) to confirm it was intentionally put down rather than briefly tilted.
 */
export class PhoneDownTracker {
  private flatDurationMs = 0
  private requiredHoldMs: number

  constructor(requiredHoldMs = 1000) {
    this.requiredHoldMs = requiredHoldMs
  }

  public update(isFlat: boolean, deltaMs: number): boolean {
    if (isFlat) {
      this.flatDurationMs += deltaMs
    } else {
      this.flatDurationMs = 0
    }
    return this.flatDurationMs >= this.requiredHoldMs
  }

  public reset(): void {
    this.flatDurationMs = 0
  }

  public getProgress(): number {
    return Math.min(1, this.flatDurationMs / this.requiredHoldMs)
  }
}
