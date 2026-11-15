/*
 * Anatomical colors. These are the only typed color values in the figure, allowed inside this
 * drawing only. Everything else (status tones, focus, hover) uses the design tokens.
 */
export const palette = {
  skin: '#e2b49a',
  skinLight: '#f8dfcd',
  bone: '#ece3cf',
  boneDark: '#a3957a',
  muscle: '#b9564b',
  muscleDark: '#7a2f2b',
  artery: '#e3453d',
  vein: '#3f78dc',
  heart: '#c5332f',
  heartDark: '#74181b',
  lung: '#e89a93',
  lungDark: '#b06361',
  liver: '#96422d',
  liverDark: '#572216',
  stomach: '#e7a98b',
  stomachDark: '#ab6a54',
  gut: '#edbba5',
  gutDark: '#b47966',
  colon: '#d38f79',
  colonDark: '#935648',
  kidney: '#a8453e',
  kidneyDark: '#661f22',
  urine: '#e8c77f',
  bladder: '#e3b48a',
  brain: '#f0c0b7',
  brainDark: '#b97877',
  gland: '#dcab5c',
  spleen: '#84395a',
  bile: '#7f9652',
  shade: '#05070c',
  light: '#ffffff',
} as const

export type Status = 'ok' | 'watch' | 'act' | 'none' | 'untracked'

export const statusLabel: Record<Status, string> = {
  ok: 'ON TARGET',
  watch: 'WATCH',
  act: 'ACT',
  none: 'NO DATA',
  untracked: 'NOT TRACKED',
}

export const statusTone: Record<Status, string> = {
  ok: 'var(--color-accent)',
  watch: 'var(--color-warn)',
  act: 'var(--color-danger)',
  none: 'var(--color-text-muted)',
  untracked: 'var(--color-text-muted)',
}

/** How one layer is drawn right now. */
export type LayerView = {
  opacity: number
  tone: string
  /** `flag`: thin status outline at rest. `chosen`: full outline. `dashed`: chosen and not tracked. */
  mark?: 'flag' | 'chosen' | 'dashed'
  hover?: boolean
  pulse?: boolean
}
