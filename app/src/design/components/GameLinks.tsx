import { Link } from 'react-router'
import { ChevronRight, Gamepad2 } from 'lucide-react'
import { gamesForScreen } from '@/registry'
import { SectionLabel } from './SectionLabel'

export type GameLinksProps = { screenId: string }

/** Small cards at the bottom of a screen that open its mini games. Renders nothing when there are none. */
export function GameLinks({ screenId }: GameLinksProps) {
  const games = gamesForScreen(screenId)
  if (games.length === 0) return null
  return (
    <section className="mt-8 flex flex-col gap-3" aria-label="Games">
      <SectionLabel>Games</SectionLabel>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {games.map((game) => (
          <li key={game.id}>
            <Link
              to={`/games/${game.id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 no-underline transition-colors duration-150 hover:bg-surface-raised"
            >
              <Gamepad2 aria-hidden="true" className="size-5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold break-words text-text">
                  {game.label}
                </span>
                <span className="block text-sm break-words text-text-secondary">
                  {game.description}
                </span>
                {game.countsAsExercise && (
                  <span className="mt-1 block font-mono text-pill uppercase tracking-wider text-text-muted">
                    Counts as exercise
                  </span>
                )}
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
