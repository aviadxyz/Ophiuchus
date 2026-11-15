// Collects every screens/*/meta.ts and games/*/meta.ts at build time. Nobody edits a central list:
// adding a screen is adding a folder. See CONTRACTS section 4.

import { collect } from './collect'
import type { GameMeta, Guide, ModuleWithDefault, ScreenGroup, ScreenMeta } from './types'

export type {
  GameMeta,
  Guide,
  ScreenGroup,
  ScreenMeta,
  ScreenStatus,
  ScreenIconName,
} from './types'

const screenMetas = import.meta.glob<{ meta?: ScreenMeta }>('../screens/*/meta.ts', { eager: true })
const screenViews = import.meta.glob<ModuleWithDefault>('../screens/*/index.tsx')
const screenGuides = import.meta.glob<{ guide?: Guide }>('../screens/*/guide.ts')
const gameMetas = import.meta.glob<{ meta?: GameMeta }>('../games/*/meta.ts', { eager: true })
const gameViews = import.meta.glob<ModuleWithDefault>('../games/*/index.tsx')

const groupOrder: Record<ScreenGroup, number> = { console: 0, daily: 1, reference: 2, pinned: 3 }

/** Sidebar headings per group. The pinned group has none. */
export const groupHeadings: Readonly<Record<ScreenGroup, string | null>> = {
  console: 'CONSOLE',
  daily: 'DAILY LIFE',
  reference: 'REFERENCE',
  pinned: null,
}

const collectedScreens = collect('screens', screenMetas, screenViews)
const collectedGames = collect('games', gameMetas, gameViews)

/** All screen meta, sorted by group, then order, then label. */
export const screens: readonly ScreenMeta[] = [...collectedScreens.metas].sort(
  (a, b) =>
    groupOrder[a.group] - groupOrder[b.group] ||
    a.order - b.order ||
    a.label.localeCompare(b.label),
)

/** All game meta, sorted by label. */
export const games: readonly GameMeta[] = [...collectedGames.metas].sort((a, b) =>
  a.label.localeCompare(b.label),
)

export function getScreen(id: string): ScreenMeta | undefined {
  return screens.find((screen) => screen.id === id)
}

export function screensByGroup(group: ScreenGroup): ScreenMeta[] {
  return screens.filter((screen) => screen.group === group)
}

export function getGame(id: string): GameMeta | undefined {
  return games.find((game) => game.id === id)
}

export function gamesForScreen(screenId: string): GameMeta[] {
  return games.filter((game) => game.screens.includes(screenId))
}

const guidesByFolder = new Map(
  Object.entries(screenGuides).map(([path, load]) => [path.split('/').at(-2) ?? '', load]),
)

/** The default guide built from a screen's description, used when guide.ts is missing or empty. */
export function defaultGuide(screen: ScreenMeta): Guide {
  return {
    shows: `This screen is still being built. Here is what it will show: ${screen.description}`,
    whyItMatters: 'Its owner will add why this matters in space when the screen is built.',
    howToRead: ['Screens marked "soon" in the sidebar are still being built.'],
    whenToAct: 'This screen is still being built. For anything urgent, use Emergency.',
  }
}

/** Loads a screen's guide.ts on demand. Falls back to the default guide. Used by Ophi. */
export async function loadGuide(id: string): Promise<Guide | undefined> {
  const screen = getScreen(id)
  if (!screen) return undefined
  const load = guidesByFolder.get(id)
  const guide = load ? (await load()).guide : undefined
  return guide ?? defaultGuide(screen)
}

/** Loads a screen's component on demand. Used by the shell's router. */
export function loadScreen(id: string): Promise<ModuleWithDefault> | undefined {
  return collectedScreens.loaders.get(id)?.()
}

/** Loads a game's component on demand. Used by the shell's router. */
export function loadGame(id: string): Promise<ModuleWithDefault> | undefined {
  return collectedGames.loaders.get(id)?.()
}
