// Shared vocabulary from CONTRACTS section 7.

export type Tone = 'ok' | 'info' | 'warn' | 'danger' | 'neutral'
export type Level = 'ok' | 'watch' | 'act' | 'none'
export type Source = 'live' | 'entered' | 'imported' | 'simulated'

export const tones: readonly Tone[] = ['ok', 'info', 'warn', 'danger', 'neutral']
export const levels: readonly Level[] = ['ok', 'watch', 'act', 'none']
export const sources: readonly Source[] = ['live', 'entered', 'imported', 'simulated']

/** Level to tone: ok to ok, watch to warn, act to danger, none to neutral. */
export const levelTone: Readonly<Record<Level, Tone>> = {
  ok: 'ok',
  watch: 'warn',
  act: 'danger',
  none: 'neutral',
}

/** The words shown for each level. */
export const levelLabel: Readonly<Record<Level, string>> = {
  ok: 'ON TARGET',
  watch: 'WATCH',
  act: 'ACT',
  none: 'NO DATA',
}

/** The words shown by SourceBadge. */
export const sourceLabel: Readonly<Record<Source, string>> = {
  live: 'LIVE',
  entered: 'ENTERED',
  imported: 'IMPORTED',
  simulated: 'SIMULATED',
}
