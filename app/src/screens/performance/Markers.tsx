import {
  Card,
  DataTable,
  DetailDrawer,
  SourceBadge,
  StatTile,
  StatusPill,
  TrendChart,
  levelLabel,
  levelTone,
  type DataTableRow,
} from '@/design'
import { TEST_DAYS_AGO, testDateTime, testDay, type Domain, type Marker } from './sample'

function NameCell({ plain, technical }: { plain: string; technical: string }) {
  return (
    <span className="flex flex-col">
      <span>{plain}</span>
      <span className="text-xs font-normal text-text-muted">{technical}</span>
    </span>
  )
}

function NowCell({ marker }: { marker: Marker }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="font-semibold tabular-nums text-text">{marker.nowText}</span>
      <SourceBadge source="simulated" />
    </span>
  )
}

/** Four of the domain's markers as tiles. Each tile opens that marker's detail. */
export function Tiles({ domain, onOpen }: { domain: Domain; onOpen: (id: string) => void }) {
  return (
    <section aria-label="Key results" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {domain.tileIds.map((id) => {
        const marker = domain.markers.find((m) => m.id === id)
        if (!marker) return null
        return (
          <StatTile
            key={marker.id}
            label={marker.plainName}
            value={marker.trend[2]}
            unit={marker.unit}
            targetText={`Target: ${marker.targetText}`}
            level={marker.level}
            source="simulated"
            trend={marker.trend}
            onOpen={() => onOpen(marker.id)}
          />
        )
      })}
    </section>
  )
}

function MarkerDetail({ marker }: { marker: Marker }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone={levelTone[marker.level]} label={levelLabel[marker.level]} />
        <span className="text-xs text-text-muted">{marker.technicalName}</span>
      </div>
      <p className="m-0 text-base text-text-secondary">{marker.what}</p>
      <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
        <dt className="font-mono text-label uppercase tracking-wider text-text-muted">Now</dt>
        <dd className="m-0">
          <NowCell marker={marker} />
        </dd>
        <dt className="font-mono text-label uppercase tracking-wider text-text-muted">Target</dt>
        <dd className="m-0 text-base text-text">{marker.targetText}</dd>
      </dl>
      <div className="flex flex-col gap-2">
        <span className="font-mono text-label uppercase tracking-wider text-text-muted">
          Last three weekly tests
        </span>
        <TrendChart
          kind="line"
          height={160}
          labels={TEST_DAYS_AGO.map((days) => testDay(days))}
          series={[{ name: marker.plainName, values: marker.trend, tone: levelTone[marker.level] }]}
          targetValue={marker.rule.value}
          summary={`Last three weekly tests of ${marker.plainName}, oldest first: ${marker.trend
            .map((value, i) => `${value} ${marker.unit} on ${testDateTime(TEST_DAYS_AGO[i] ?? 0)}`)
            .join(', ')}. The target is ${marker.targetText}.`}
        />
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {marker.trend.map((value, i) => {
            const days = TEST_DAYS_AGO[i] ?? 0
            return (
              <li
                key={days}
                className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
              >
                <span className="text-text-secondary">
                  {testDateTime(days)}
                  <span className="text-text-muted">
                    {' '}
                    · {days === 1 ? '1 day ago' : `${days} days ago`}
                  </span>
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="font-semibold tabular-nums text-text">
                    {value} {marker.unit}
                  </span>
                  <SourceBadge source="simulated" />
                </span>
              </li>
            )
          })}
        </ul>
      </div>
      <p className="m-0 text-xs text-text-muted">
        Target: personal baseline in this sample record.
      </p>
    </div>
  )
}

/** Every marker of the domain with its value, target and level. A row, or its tile, opens it. */
export function MarkersTable({
  domain,
  openId,
  onOpen,
}: {
  domain: Domain
  openId: string | null
  onOpen: (id: string | null) => void
}) {
  const open = domain.markers.find((m) => m.id === openId)
  const rows: DataTableRow[] = domain.markers.map((marker) => ({
    id: marker.id,
    barTone: levelTone[marker.level],
    cells: [
      <NameCell key="name" plain={marker.plainName} technical={marker.technicalName} />,
      <NowCell key="now" marker={marker} />,
      marker.targetText,
    ],
    pill: { tone: levelTone[marker.level], label: levelLabel[marker.level] },
    onOpen: () => onOpen(marker.id),
  }))
  return (
    <Card title="Tests to watch">
      <DataTable columns={['Test', 'Now', 'Target']} rows={rows} />
      <DetailDrawer
        open={open !== undefined}
        title={open?.plainName ?? ''}
        onClose={() => onOpen(null)}
      >
        {open && <MarkerDetail marker={open} />}
      </DetailDrawer>
    </Card>
  )
}
