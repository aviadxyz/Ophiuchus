import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { setActiveProfile, useActiveProfile, useProfiles } from '@/data'

type ProfileSwitcherProps = { compact?: boolean }

function Tag({ kind }: { kind: 'member' | 'demo' }) {
  return (
    <span className="shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-pill uppercase tracking-wider text-text-muted">
      {kind === 'demo' ? 'DEMO' : 'CREW'}
    </span>
  )
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

/** The active person's name and a DEMO or CREW tag. Opens a list of every profile. */
export function ProfileSwitcher({ compact = false }: ProfileSwitcherProps) {
  const active = useActiveProfile()
  const profiles = useProfiles()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Profile: ${active.displayName}. Change profile`}
        title={compact ? active.displayName : undefined}
        className="flex w-full cursor-pointer items-center gap-3 rounded-md border border-border bg-bg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-surface-raised"
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised font-mono text-xs text-text-secondary"
        >
          {initials(active.displayName)}
        </span>
        <span
          className={
            compact
              ? 'sr-only lg:not-sr-only lg:flex lg:min-w-0 lg:flex-1 lg:flex-col'
              : 'flex min-w-0 flex-1 flex-col'
          }
        >
          <span className="truncate text-base font-semibold text-text">{active.displayName}</span>
          <span className="flex items-center gap-2">
            <Tag kind={active.kind} />
            <span className="truncate text-xs text-text-muted">{active.role}</span>
          </span>
        </span>
        <ChevronsUpDown
          aria-hidden="true"
          className={compact ? 'hidden size-4 text-text-muted lg:block' : 'size-4 text-text-muted'}
        />
      </button>
      {open && (
        <ul
          id={listId}
          aria-label="Profiles"
          className="absolute top-full left-0 z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] list-none rounded-md border border-border bg-surface-raised p-1"
        >
          {profiles.map((profile) => {
            const isActive = profile.id === active.id
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => {
                    setActiveProfile(profile.id)
                    setOpen(false)
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-left hover:bg-surface"
                >
                  <span className="min-w-0 flex-1 truncate text-base text-text">
                    {profile.displayName}
                  </span>
                  <Tag kind={profile.kind} />
                  {isActive ? (
                    <Check aria-label="Active" className="size-4 shrink-0 text-accent" />
                  ) : (
                    <span className="size-4 shrink-0" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
