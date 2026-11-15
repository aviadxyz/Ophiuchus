import { cn } from '../cn'
import { tonePill } from '../toneClasses'
import type { Tone } from '../vocabulary'

export type StatusPillProps = { tone: Tone; label: string }

/** Dot plus uppercase word. Color always comes with the word. */
export function StatusPill({ tone, label }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5',
        'font-mono text-pill font-medium uppercase tracking-wide whitespace-nowrap',
        tonePill[tone],
      )}
      title={label}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{label}</span>
    </span>
  )
}
