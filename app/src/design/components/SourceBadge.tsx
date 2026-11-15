import { cn } from '../cn'
import { sourceLabel, type Source } from '../vocabulary'

export type SourceBadgeProps = { source: Source }

/** LIVE (accent, pulsing dot), ENTERED, IMPORTED, SIMULATED (muted). */
export function SourceBadge({ source }: SourceBadgeProps) {
  const live = source === 'live'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 font-mono text-pill uppercase tracking-wider',
        live ? 'text-accent' : 'text-text-muted',
      )}
      aria-label={`Source: ${sourceLabel[source].toLowerCase()}`}
      title={`Source: ${sourceLabel[source].toLowerCase()}`}
    >
      {live && (
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-accent" />
      )}
      <span aria-hidden="true">{sourceLabel[source]}</span>
    </span>
  )
}
