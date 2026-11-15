/** Clamps to 0..1. Anything that is not a finite number becomes 0. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
