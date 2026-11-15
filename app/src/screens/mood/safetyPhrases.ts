// Self-harm detection phrases kept strictly in this folder.
// Never sent anywhere or logged. Used solely to render local crisis guidance.

export const SELF_HARM_PHRASES = [
  'hurt myself',
  'kill myself',
  'end it all',
  'want to die',
  'suicide',
  'better off dead',
  'self harm',
  'self-harm',
  'harm myself',
  'ending my life',
  'take my own life',
  'wish i was dead',
  'wish i were dead',
] as const

/**
 * Checks whether text contains any phrase from the self-harm list.
 * Performs a gentle, case-insensitive substring match.
 */
export function hasSelfHarmPhrase(text: string | undefined | null): boolean {
  if (!text) return false
  const normalized = text.toLowerCase()
  return SELF_HARM_PHRASES.some((phrase) => normalized.includes(phrase))
}
