import { StatusPill } from './StatusPill'
import type { Tone } from '../vocabulary'

export type HeaderPill = { tone: Tone; label: string }

export type ScreenHeaderProps = {
  eyebrow: string
  title: string
  description: string
  /** Up to three summary pills. Extra pills are not shown. */
  pills?: HeaderPill[]
}

/** First element of every screen: eyebrow, title, description, up to three pills. */
export function ScreenHeader({ eyebrow, title, description, pills = [] }: ScreenHeaderProps) {
  const shown = pills.slice(0, 3)
  return (
    <header className="mb-6 flex flex-col gap-2">
      <p className="m-0 font-mono text-eyebrow font-medium uppercase tracking-wider text-text-muted break-words">
        {eyebrow}
      </p>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h1 className="m-0 min-w-0 text-title font-semibold break-words text-text">{title}</h1>
        {shown.length > 0 && (
          <ul
            className="m-0 flex list-none flex-wrap items-center gap-2 p-0 sm:pt-1.5"
            aria-label="Summary"
          >
            {shown.map((pill) => (
              <li key={`${pill.tone}-${pill.label}`} className="max-w-full">
                <StatusPill tone={pill.tone} label={pill.label} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {description && (
        <p className="m-0 max-w-description text-base text-text-secondary break-words">
          {description}
        </p>
      )}
    </header>
  )
}
