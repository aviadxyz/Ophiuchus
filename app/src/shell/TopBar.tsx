import { Link } from 'react-router'
import { Menu, Siren } from 'lucide-react'

type TopBarProps = { title: string; menuOpen: boolean; onMenu: () => void }

/** Phone only: menu button, screen title, Emergency button. */
export function TopBar({ title, menuOpen, onMenu }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-2 sm:hidden">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        aria-controls="mobile-drawer"
        className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-text hover:bg-surface-raised"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>
      <p className="m-0 min-w-0 flex-1 truncate text-lg font-semibold text-text">{title}</p>
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
