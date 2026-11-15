import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { games, loadGame, loadScreen, screens } from '@/registry'
import { GameRoute } from './GameRoute'
import { NotFound } from './NotFound'
import { WatchRoute } from './WatchRoute'

const ComponentsDemo = lazy(() => import('./dev/ComponentsDemo'))

// Loaded on demand, so the watch view at /w never downloads the sidebar, the top bar or Ophi.
const AppShell = lazy(() => import('./AppShell').then((mod) => ({ default: mod.AppShell })))

/** A window this narrow is a watch: `/` opens the watch view instead of the console. */
export const WATCH_MAX_WIDTH = 300

function RootRedirect() {
  const narrow = typeof window !== 'undefined' && window.innerWidth <= WATCH_MAX_WIDTH
  return <Navigate to={narrow ? '/w' : '/overview'} replace />
}

const screenComponents = new Map<string, LazyExoticComponent<ComponentType>>(
  screens.map((screen) => [
    screen.id,
    lazy(() => loadScreen(screen.id) ?? Promise.reject(new Error('missing screen'))),
  ]),
)

const gameComponents = new Map<string, LazyExoticComponent<ComponentType>>(
  games.map((game) => [
    game.id,
    lazy(() => loadGame(game.id) ?? Promise.reject(new Error('missing game'))),
  ]),
)

/** Routes from CONTRACTS section 3. One route per registered screen, built from the registry. */
export const routes: RouteObject[] = [
  { path: '/', element: <RootRedirect /> },
  { path: '/w', element: <WatchRoute /> },
  ...games.map((game): RouteObject => {
    const Game = gameComponents.get(game.id)!
    return {
      path: `/games/${game.id}`,
      element: (
        <GameRoute game={game}>
          <Game />
        </GameRoute>
      ),
    }
  }),
  { path: '/games/*', element: <GameRoute /> },
  { path: '/dev/components', element: <ComponentsDemo /> },
  {
    element: (
      <Suspense fallback={null}>
        <AppShell />
      </Suspense>
    ),
    children: [
      ...screens.map((screen): RouteObject => {
        const Screen = screenComponents.get(screen.id)!
        return { path: `/${screen.id}`, element: <Screen /> }
      }),
      { path: '*', element: <NotFound /> },
    ],
  },
]

export function createRouter() {
  return createBrowserRouter(routes)
}
