import { Link, useLocation } from 'react-router'
import { Siren } from 'lucide-react'
import { useAlerts } from '@/data'

function timeOf(at: string) {
  const date = new Date(at)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/**
 * The newest open emergency alert, above the content on every screen, with a link to Emergency.
 * An alert that arrived from another device says whose role raised it.
 */
export function AlertBanner() {
  const alerts = useAlerts()
  const { pathname } = useLocation()
  const alert = alerts.find((a) => a.kind === 'emergency' && a.status === 'open')
  if (!alert) return null
  return (
    <div
      role="alert"
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-emergency/35 bg-emergency/12 px-4 py-3"
    >
      <Siren aria-hidden="true" className="size-5 shrink-0 text-emergency" />
      <div className="min-w-0 flex-1">
        <p className="m-0 font-mono text-label font-medium uppercase tracking-wider text-emergency">
          {alert.from ? `Emergency from ${alert.from}` : 'Emergency alert open'}
          {timeOf(alert.at) && ` · ${timeOf(alert.at)}`}
        </p>
        <p className="m-0 text-base break-words text-text">{alert.message}</p>
      </div>
      {pathname !== '/emergency' && (
        <Link
          to="/emergency"
          className="inline-flex h-10 shrink-0 items-center rounded-md bg-emergency px-3.5 text-base font-semibold text-bg no-underline"
        >
          Open Emergency
        </Link>
      )}
    </div>
  )
}
