import type { ComponentType } from 'react'
import type { IconName } from 'lucide-react/dynamic'

// Shapes from CONTRACTS sections 4, 5 and 13.

export type ScreenGroup = 'console' | 'daily' | 'reference' | 'pinned'
export type ScreenStatus = 'ready' | 'building' | 'placeholder'

/** A lucide icon name in kebab case, as on lucide.dev, for example 'heart-pulse'. */
export type ScreenIconName = IconName

export type ScreenMeta = {
  /** Must equal the folder name. */
  id: string
  /** Sidebar label and screen title. */
  label: string
  group: ScreenGroup
  /** Position inside the group, lowest first. */
  order: number
  icon: ScreenIconName
  /** Person's first name, or 'unassigned'. */
  owner: string
  /** 'placeholder' shows a "soon" marker in the sidebar. */
  status: ScreenStatus
  /** For example 'DOMAIN · NUTRITION'. */
  eyebrow: string
  /** One sentence, shown under the title and used by Ophi's default text. */
  description: string
}

export type Guide = {
  /** What this screen shows, one or two sentences. */
  shows: string
  /** Why it matters in space, one or two sentences. */
  whyItMatters: string
  /** How to read it, up to three short texts. */
  howToRead: string[]
  /** What to do yourself and when to tell the flight surgeon. No diagnosis and no doses. */
  whenToAct: string
}

export type GameMeta = {
  /** Equals the folder name, in lower case with hyphens. */
  id: string
  label: string
  description: string
  /** Screen ids whose GameLinks should show this game. */
  screens: string[]
  /** If true, the game calls logGameMinutes when a round ends. */
  countsAsExercise: boolean
}

export type ModuleWithDefault = { default: ComponentType }
