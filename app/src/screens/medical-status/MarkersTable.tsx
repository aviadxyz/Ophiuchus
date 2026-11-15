import {
  Card,
  DataTable,
  DetailDrawer,
  SourceBadge,
  StatusPill,
  TrendChart,
  levelLabel,
  levelTone,
  type DataTableRow,
} from '@/design'
import { markers, sampleDateTime, sampleDay, SAMPLE_DAYS_AGO, type Marker } from './sample'

function NameCell({ plain, technical }: { plain: string; technical: string }) {
  return (
    <span className="flex flex-col">
      <span>{plain}</span>
      {technical !== plain && (
        <span className="text-xs font-normal text-text-muted">{technical}</span>
      )}
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
      {marker.trend && (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-label uppercase tracking-wider text-text-muted">
            Last three samples
          </span>
          <TrendChart
            kind="line"
            height={160}
            labels={SAMPLE_DAYS_AGO.map((days) => sampleDay(days))}
            series={[
              { name: marker.plainName, values: marker.trend, tone: levelTone[marker.level] },
            ]}
            {...(marker.rule?.kind === 'max' ? { targetValue: marker.rule.value } : {})}
            summary={`Last three samples of ${marker.plainName}, oldest first: ${marker.trend
              .map((value, i) => `${value} on ${sampleDateTime(SAMPLE_DAYS_AGO[i] ?? 0)}`)
              .join(', ')}.`}
          />
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {marker.trend.map((value, i) => (
              <li
                key={SAMPLE_DAYS_AGO[i]}
                className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
              >
                <span className="text-text-secondary">
                  {sampleDateTime(SAMPLE_DAYS_AGO[i] ?? 0)}
                  <span className="text-text-muted"> · {SAMPLE_DAYS_AGO[i]} days ago</span>
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="font-semibold tabular-nums text-text">
                    {value} {unitOf(marker)}
                  </span>
                  <SourceBadge source="simulated" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="m-0 text-xs text-text-muted">
        Target: personal baseline in this sample record.
      </p>
    </div>
  )
}

/** The unit after the number in a marker's value, for example "µg/g". */
function unitOf(marker: Marker): string {
  return marker.nowText.split(' ').slice(1).join(' ')
}

/** Seven markers with their value, target and level. A row, or its tile above, opens its detail. */
export function MarkersTable({
  openId,
  onOpen,
}: {
  openId: string | null
  onOpen: (id: string | null) => void
}) {
  const setOpenId = onOpen
  const open = markers.find((m) => m.id === openId)

  const rows: DataTableRow[] = markers.map((marker) => ({
    id: marker.id,
    barTone: levelTone[marker.level],
    cells: [
      <NameCell key="name" plain={marker.plainName} technical={marker.technicalName} />,
      <NowCell key="now" marker={marker} />,
      marker.targetText,
    ],
    pill: { tone: levelTone[marker.level], label: levelLabel[marker.level] },
    onOpen: () => setOpenId(marker.id),
  }))

  return (
    <Card title="Markers to watch">
      <DataTable columns={['Marker', 'Now', 'Target']} rows={rows} />
      <DetailDrawer
        open={open !== undefined}
        title={open?.plainName ?? ''}
        onClose={() => setOpenId(null)}
      >
        {open && <MarkerDetail marker={open} />}
      </DetailDrawer>
    </Card>
  )
}
