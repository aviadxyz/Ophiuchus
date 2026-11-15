// Short, readable word lists for urgent emergency detection and flight surgeon forwarding.
// CONTRACTS section 11, prompts/12-medbot-chat-screen.md steps 7 and 8.

export const URGENT_WORDS: readonly string[] = [
  'chest pain',
  'trouble breathing',
  'shortness of breath',
  'hard to breathe',
  "can't breathe",
  'cannot breathe',
  'heavy bleeding',
  'bleeding heavily',
  'fainting',
  'fainted',
  'passed out',
  'unconscious',
  'stroke',
  'numb',
  'numbness',
  'allergic reaction',
  'anaphylaxis',
  'serious injury',
  'broken bone',
  'self-harm',
  'harm myself',
  'hurt myself',
  'kill myself',
  "don't see the point",
  'suicide',
  'end my life',
  'emergency',
]

export const FORWARDING_WORDS: readonly string[] = [
  'medicine',
  'medication',
  'dose',
  'dosage',
  'pill',
  'pills',
  'days',
  'worse',
  'diagnosis',
  'ibuprofen',
]

/** Checks whether text contains obvious emergency indicators. */
export function isUrgentText(text: string): boolean {
  const lower = text.toLowerCase()
  return URGENT_WORDS.some((word) => lower.includes(word))
}

/** Checks whether an offline question matches topics needing flight surgeon review. */
export function isForwardingText(text: string): boolean {
  const lower = text.toLowerCase()
  return FORWARDING_WORDS.some((word) => lower.includes(word))
}
