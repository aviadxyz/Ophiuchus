/**
 * Shapes in the figure are hand-placed points joined by smooth curves.
 * A point is [x, y]; a third value of 1 marks a sharp corner.
 * The drawing is 400 wide and the body is centered on x = 200.
 */
export type Pt = readonly [number, number, 1?]

const f = (n: number) => String(Math.round(n * 10) / 10)

/** A smooth curve through the points (Catmull-Rom, written as cubic segments). */
export function curve(pts: readonly Pt[], closed = false): string {
  const n = pts.length
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  const segments = closed ? n : n - 1
  for (let i = 0; i < segments; i++) {
    const p1 = at(i)
    const p2 = at(i + 1)
    const p0 = p1[2] ? p1 : at(i - 1)
    const p3 = p2[2] ? p2 : at(i + 2)
    d +=
      `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ` +
      `${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ` +
      `${f(p2[0])} ${f(p2[1])}`
  }
  return closed ? d + 'Z' : d
}

/** The same points on the other side of the body, in the same order. */
export function flip(pts: readonly Pt[]): Pt[] {
  return pts.map((p) => (p[2] ? [400 - p[0], p[1], 1] : [400 - p[0], p[1]]))
}

/** A closed, exactly symmetric outline from one half that starts and ends on the midline. */
export function symmetric(half: readonly Pt[]): string {
  const other = flip(half).reverse().slice(1, -1)
  return curve([...half, ...other], true)
}

/** Closed smooth shape. */
export const blob = (pts: readonly Pt[]) => curve(pts, true)

/** Transform that draws a shape on the other side of the body. */
export const MIRROR = 'matrix(-1 0 0 1 400 0)'
