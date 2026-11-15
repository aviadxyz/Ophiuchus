import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Bell, Bot, House, Menu, SquarePen, type LucideIcon } from 'lucide-react'
import { useAlerts } from '@/data'

type BottomBarProps = {
  logOpen: boolean
  moreOpen: boolean
  onLog: () => void
  onMore: () => void
}

type ItemProps = {
  icon: LucideIcon
  label: string
  current: boolean
  badge?: ReactNode
}

const itemClass =
  'relative flex h-14 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-xs no-underline transition-colors duration-150'

function ItemBody({ icon: Icon, label, current, badge }: ItemProps) {
  return (
    <>
      {current && (
        <span
          aria-hidden="true"
          className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent"
        />
      )}
      <span className="relative">
        <Icon aria-hidden="true" className={current ? 'size-5 text-accent' : 'size-5'} />
        {badge}
      </span>
      <span className={current ? 'font-semibold text-text' : ''}>{label}</span>
    </>
  )
}

const stateClass = (current: boolean) =>
  current ? 'text-text' : 'text-text-secondary hover:text-text'

/** Phone only: Today, Log, Med bot, Alerts, More. Fixed to the bottom, above the safe area. */
export function BottomBar({ logOpen, moreOpen, onLog, onMore }: BottomBarProps) {
  const { pathname } = useLocation()
  const openAlerts = useAlerts().filter((a) => a.kind === 'emergency' && a.status === 'open').length
  const sheetOpen = logOpen || moreOpen
  const onRoute = (path: string) => !sheetOpen && pathname === path
  const routed = ['/overview', '/medbot', '/emergency'].includes(pathname)

  return (
    <nav
      aria-label="Phone"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="m-0 flex list-none p-0">
        <li className="flex min-w-0 flex-1">
          <Link
            to="/overview"
            aria-current={onRoute('/overview') ? 'page' : undefined}
            className={`${itemClass} ${stateClass(onRoute('/overview'))}`}
          >
            <ItemBody icon={House} label="Today" current={onRoute('/overview')} />
          </Link>
        </li>
        <li className="flex min-w-0 flex-1">
          <button
            type="button"
            onClick={onLog}
            aria-expanded={logOpen}
            className={`${itemClass} ${stateClass(logOpen)}`}
          >
            <ItemBody icon={SquarePen} label="Log" current={logOpen} />
          </button>
        </li>
        <li className="flex min-w-0 flex-1">
          <Link
            to="/medbot"
            aria-current={onRoute('/medbot') ? 'page' : undefined}
            className={`${itemClass} ${stateClass(onRoute('/medbot'))}`}
          >
            <ItemBody icon={Bot} label="Med bot" current={onRoute('/medbot')} />
          </Link>
        </li>
        <li className="flex min-w-0 flex-1">
          <Link
            to="/emergency"
            aria-current={onRoute('/emergency') ? 'page' : undefined}
            aria-label={openAlerts > 0 ? `Alerts, ${openAlerts} open` : 'Alerts'}
            className={`${itemClass} ${stateClass(onRoute('/emergency'))}`}
          >
            <ItemBody
              icon={Bell}
              label="Alerts"
              current={onRoute('/emergency')}
              badge={
                openAlerts > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emergency px-1 font-mono text-pill font-bold text-bg"
                  >
                    {openAlerts > 9 ? '9+' : openAlerts}
                  </span>
                )
              }
            />
          </Link>
        </li>
        <li className="flex min-w-0 flex-1">
          <button
            type="button"
            onClick={onMore}
            aria-expanded={moreOpen}
            aria-controls="mobile-drawer"
            className={`${itemClass} ${stateClass(moreOpen || (!sheetOpen && !routed))}`}
          >
            <ItemBody icon={Menu} label="More" current={moreOpen || (!sheetOpen && !routed)} />
          </button>
        </li>
      </ul>
    </nav>
  )
}
