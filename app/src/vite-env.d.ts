/// <reference types="vite/client" />

declare module 'virtual:screen-icons' {
  import type { LucideIcon } from 'lucide-react'
  const icons: Record<string, LucideIcon>
  export default icons
}

interface ImportMetaEnv {
  readonly VITE_CHAT_URL?: string
  readonly VITE_EVENTS_URL?: string
  readonly VITE_SOCIAL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
