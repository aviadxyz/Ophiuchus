import type { Tone } from './vocabulary'

const toneVar: Readonly<Record<Tone, string>> = {
  ok: '--color-accent',
  info: '--color-info',
  warn: '--color-warn',
  danger: '--color-danger',
  neutral: '--color-text-secondary',
}

/**
 * Reads a color token's value for libraries that need a plain color string (Recharts).
 * Falls back to currentColor where styles are not available.
 */
export function tokenColor(variable: string): string {
  if (typeof window === 'undefined' || !window.getComputedStyle) return 'currentColor'
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  return value || 'currentColor'
}

export function toneColor(tone: Tone): string {
  return tokenColor(toneVar[tone])
}
