import { Link } from 'react-router'
import { Siren } from 'lucide-react'

type TopBarProps = { title: string }

/** Phone only: screen title, a PHONE tag, Emergency button. The menu lives in the bottom bar. */
export function TopBar({ title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface pr-2 pl-page-phone sm:hidden">
      <p className="m-0 min-w-0 truncate text-lg font-semibold text-text">{title}</p>
      <span className="shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-pill uppercase tracking-wider text-text-muted">
        PHONE
      </span>
      <span className="flex-1" />
      <Link
        to="/emergency"
        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-emergency/35 bg-emergency/12 px-3 text-base font-bold text-emergency no-underline"
      >
        <Siren aria-hidden="true" className="size-4" />
        Emergency
      </Link>
    </header>
  )
}
