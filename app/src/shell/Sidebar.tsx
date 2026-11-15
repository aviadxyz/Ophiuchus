import { Fragment } from 'react'
import { NavLink } from 'react-router'
import { groupHeadings, screensByGroup, type ScreenGroup, type ScreenMeta } from '@/registry'
import { ProfileSwitcher } from './ProfileSwitcher'
import { ScreenIcon } from './ScreenIcon'

const navGroups: ScreenGroup[] = ['console', 'daily', 'reference']

type SidebarProps = {
  /** 'rail': icons only between 640 and 1024 px, full from 1024 px. 'full': always with labels (phone drawer). */
  mode?: 'rail' | 'full'
  onNavigate?: () => void
}

/** Generated from the registry: grouped, ordered, "soon" on placeholders, Emergency pinned at the bottom. */
export function Sidebar({ mode = 'rail', onNavigate }: SidebarProps) {
  const rail = mode === 'rail'
  const labelClass = rail ? 'sr-only lg:not-sr-only lg:truncate' : 'truncate'
  const pinned = screensByGroup('pinned')
  return (
    <nav aria-label="Screens" className="flex h-full min-h-0 flex-col">
      <div className={rail ? 'px-3 pt-4 pb-3 lg:px-4' : 'px-4 pt-4 pb-3'}>
        <ProfileSwitcher compact={rail} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 lg:px-4">
        {navGroups.map((group, index) => {
          const items = screensByGroup(group)
          if (items.length === 0) return null
          const heading = groupHeadings[group]
          return (
            <Fragment key={group}>
              {index > 0 && <hr className="my-3 border-0 border-t border-border" />}
              {heading && (
                <h2
                  className={
                    (rail ? 'sr-only lg:not-sr-only lg:block ' : 'block ') +
                    'm-0 px-2.5 pt-1 pb-2 font-mono text-label font-medium uppercase tracking-wider text-text-muted'
                  }
                >
                  {heading}
                </h2>
              )}
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {items.map((screen) => (
                  <li key={screen.id}>
                    <SidebarItem
                      screen={screen}
                      labelClass={labelClass}
                      rail={rail}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </Fragment>
          )
        })}
      </div>
      {pinned.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 border-t border-border p-3 lg:p-4">
          {pinned.map((screen) => (
            <li key={screen.id}>
              <NavLink
                to={`/${screen.id}`}
                onClick={onNavigate}
                title={rail ? screen.label : undefined}
                className={({ isActive }) =>
                  [
                    'flex min-h-12 items-center gap-3 rounded-md border border-emergency/35 bg-emergency/12 px-3 py-2.5',
                    'text-lg font-bold text-emergency no-underline transition-colors duration-150 hover:bg-emergency/20',
                    rail ? 'justify-center lg:justify-start' : '',
                    isActive ? 'border-emergency' : '',
                  ].join(' ')
                }
              >
                <ScreenIcon name={screen.icon} className="size-5 shrink-0" />
                <span className={labelClass}>{screen.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}

type SidebarItemProps = {
  screen: ScreenMeta
  labelClass: string
  rail: boolean
  onNavigate?: () => void
}

function SidebarItem({ screen, labelClass, rail, onNavigate }: SidebarItemProps) {
  const soon = screen.status === 'placeholder'
  return (
    <NavLink
      to={`/${screen.id}`}
      onClick={onNavigate}
      title={rail ? `${screen.label}${soon ? ' (soon)' : ''}` : undefined}
      className={({ isActive }) =>
        [
          'relative flex min-h-10 items-center gap-3 rounded-md px-2.5 py-2 text-base no-underline',
          'transition-colors duration-150',
          rail ? 'justify-center lg:justify-start' : '',
          isActive
            ? 'bg-surface-raised font-medium text-text'
            : 'text-text-secondary hover:bg-surface-raised/60 hover:text-text',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent"
            />
          )}
          <span className="relative shrink-0">
            <ScreenIcon name={screen.icon} className="size-[18px]" />
            {soon && rail && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-1 size-1.5 rounded-full bg-text-muted lg:hidden"
              />
            )}
          </span>
          <span className={`${labelClass} min-w-0 flex-1`}>{screen.label}</span>
          {soon && (
            <span
              className={
                (rail ? 'sr-only lg:not-sr-only ' : '') +
                'shrink-0 rounded-sm border border-border px-1.5 py-px font-mono text-pill uppercase tracking-wider text-text-muted'
              }
            >
              soon
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}
