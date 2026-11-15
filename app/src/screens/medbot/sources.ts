/**
 * A passage from the team's research database, as the chat endpoint returns it (CONTRACTS
 * section 8, `ChatSource`). Declared here because `@/data` does not export it yet.
 */
export type ChatSource = {
  title: string
  url: string
  /** Word for word from the research database. */
  quote: string
}

function isChatSource(value: unknown): value is ChatSource {
  if (typeof value !== 'object' || value === null) return false
  const { title, url, quote } = value as Record<string, unknown>
  return (
    typeof title === 'string' &&
    title.trim() !== '' &&
    typeof url === 'string' &&
    url.startsWith('https://') &&
    typeof quote === 'string' &&
    quote.trim() !== ''
  )
}

/**
 * The `sources` of a chat response. A missing or malformed field counts as an empty list, so the
 * screen keeps working against a server that has not been updated.
 */
export function readSources(value: unknown): ChatSource[] {
  if (!Array.isArray(value)) return []
  return value.filter(isChatSource).map(({ title, url, quote }) => ({ title, url, quote }))
}
