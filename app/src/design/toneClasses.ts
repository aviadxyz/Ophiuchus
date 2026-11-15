import type { Tone } from './vocabulary'

// Full class strings so Tailwind can see them. Status color is never used alone:
// every place that uses these also shows a word or an icon.

/** Text color, 12% fill and 35% border, as used by pills. */
export const tonePill: Readonly<Record<Tone, string>> = {
  ok: 'text-accent bg-accent/12 border-accent/35',
  info: 'text-info bg-info/12 border-info/35',
  warn: 'text-warn bg-warn/12 border-warn/35',
  danger: 'text-danger bg-danger/12 border-danger/35',
  neutral: 'text-text-secondary bg-text-muted/12 border-text-muted/35',
}

/** Solid fill, for row bars and progress fills. */
export const toneFill: Readonly<Record<Tone, string>> = {
  ok: 'bg-accent',
  info: 'bg-info',
  warn: 'bg-warn',
  danger: 'bg-danger',
  neutral: 'bg-text-muted',
}

/** Text color only, for SVG strokes that use currentColor. */
export const toneText: Readonly<Record<Tone, string>> = {
  ok: 'text-accent',
  info: 'text-info',
  warn: 'text-warn',
  danger: 'text-danger',
  neutral: 'text-text-muted',
}
