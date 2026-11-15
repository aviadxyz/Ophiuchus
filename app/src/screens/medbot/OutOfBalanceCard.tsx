import { useState } from 'react'
import { Link } from 'react-router'
import { Button, SourceBadge, StatusPill, levelLabel, levelTone } from '@/design'
import { useTargets, useToday } from '@/data'
import { getScreen } from '@/registry'
import { offTargetMetrics } from './offTarget'

export function OutOfBalanceCard() {
  const today = useToday()
  const targets = useTargets()
  const [open, setOpen] = useState(true)
  const items = offTargetMetrics(today, targets)

  return (
    <section
      aria-labelledby="out-of-balance-title"
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-card"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="out-of-balance-title" className="m-0 text-lg font-semibold text-text">
          Out of balance today
        </h2>
        <Button
          variant="quiet"
          size="md"
          aria-expanded={open}
          aria-controls="out-of-balance-list"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide' : `Show${items.length > 0 ? ` (${items.length})` : ''}`}
        </Button>
      </div>

      {open && (
        <div id="out-of-balance-list">
          {items.length === 0 ? (
            <p className="m-0 text-base text-text-secondary">Nothing is off target today.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
              {items.map((item) => {
                const screen = item.screenId ? getScreen(item.screenId) : undefined
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-base font-semibold text-text">{item.name}</span>
                      <span className="text-base text-text-secondary tabular-nums">
                        {item.valueText}
                      </span>
                      {item.source && <SourceBadge source={item.source} />}
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill tone={levelTone[item.level]} label={levelLabel[item.level]} />
                      {screen && (
                        <Link
                          to={`/${screen.id}`}
                          className="text-sm text-text-secondary underline underline-offset-2 hover:text-text"
                        >
                          {screen.label}
                        </Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
