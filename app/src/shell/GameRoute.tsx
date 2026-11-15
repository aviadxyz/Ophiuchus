import { Suspense, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { EmptyState } from '@/design'
import type { GameMeta } from '@/registry'
import { ScreenBoundary } from './ScreenBoundary'
import { ScreenLoading } from './ScreenLoading'

type GameRouteProps = { game?: GameMeta; children?: ReactNode }

/** A game, full window, with a back control. Without a game it shows a not-found message. */
export function GameRoute({ game, children }: GameRouteProps) {
  const navigate = useNavigate()
  const back = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(`/${game?.screens[0] ?? 'overview'}`)
  }
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-14 items-center gap-3 border-b border-border px-2 sm:px-4">
        <button
          type="button"
          onClick={back}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-base text-text hover:bg-surface-raised"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back
        </button>
        <h1 className="m-0 min-w-0 truncate text-lg font-semibold text-text">
          {game?.label ?? 'Game not found'}
        </h1>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        {game ? (
          <ScreenBoundary label={game.label}>
            <Suspense
              fallback={
                <div className="p-page-phone sm:p-page">
                  <ScreenLoading />
                </div>
              }
            >
              {children}
            </Suspense>
          </ScreenBoundary>
        ) : (
          <div className="p-page-phone sm:p-page">
            <EmptyState
              message="There is no game at this address."
              actionLabel="Go to Overview"
              onAction={() => navigate('/overview')}
            />
          </div>
        )}
      </main>
    </div>
  )
}
