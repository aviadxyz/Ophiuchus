import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { games, loadGame, loadScreen, screens } from '@/registry'
import { AppShell } from './AppShell'
import { GameRoute } from './GameRoute'
import { NotFound } from './NotFound'
import { WatchRoute } from './WatchRoute'

const ComponentsDemo = lazy(() => import('./dev/ComponentsDemo'))

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
  { path: '/', element: <Navigate to="/overview" replace /> },
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
    element: <AppShell />,
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
