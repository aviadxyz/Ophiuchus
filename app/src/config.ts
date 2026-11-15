// Environment settings (CONTRACTS section 11). An empty value means that feature uses its
// offline fallback, and nothing breaks.

function read(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '')
}

export const config = {
  chatUrl: read(import.meta.env.VITE_CHAT_URL),
  eventsUrl: read(import.meta.env.VITE_EVENTS_URL),
  socialUrl: read(import.meta.env.VITE_SOCIAL_URL),
  groundUrl: read(import.meta.env.VITE_GROUND_URL),
} as const
