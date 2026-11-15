import type {
  DaySummary,
  LatestVitals,
  SeriesPoint,
  TargetMap,
} from '@/data'
import {
  Button,
  DetailDrawer,
  SectionLabel,
  SourceBadge,
  SourceLine,
  StatusPill,
  levelLabel,
  levelTone,
} from '@/design'
import { getScreen } from '@/registry'
import type { BodySystemDef, SystemReading } from './systems'
import {
  systemStatusLabel,
  systemStatusTone,
  type SystemStatus,
} from './systemStatus'

export type SystemDrawerProps = {
  system: BodySystemDef | null
  status?: SystemStatus
  open: boolean
  onClose: () => void
  onNavigate: (route: string) => void
  today: DaySummary
  targets: TargetMap
  latestVitals?: LatestVitals | null
  bodyMassSeries?: SeriesPoint[]
}

export function SystemDrawer({
  system,
  status = 'untracked',
  open,
  onClose,
  onNavigate,
  today,
  targets,
  latestVitals,
  bodyMassSeries,
}: SystemDrawerProps) {
  if (!system) return null

  const isUntracked = status === 'untracked'
  const hasRightNow = system.metricIds.length > 0 || system.readings.length > 0

  const renderReadingRow = (reading: SystemReading) => {
    switch (reading) {
      case 'heartRate': {
        const sample = latestVitals?.latest
        const val = sample?.heartRate
        const hasVal = val !== undefined && val !== null
        return (
          <div
            key={reading}
            className="flex items-center justify-between gap-3 border-b border-border/40 py-2.5 last:border-b-0"
          >
            <span className="text-sm text-text-secondary">Heart rate</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text">
                {hasVal ? `${val} bpm` : 'No sensor connected'}
              </span>
              {hasVal && sample && <SourceBadge source={sample.source} />}
            </div>
          </div>
        )
      }
      case 'spo2': {
        const sample = latestVitals?.latest
        const val = sample?.spo2
        const hasVal = val !== undefined && val !== null
        return (
          <div
            key={reading}
            className="flex items-center justify-between gap-3 border-b border-border/40 py-2.5 last:border-b-0"
          >
            <span className="text-sm text-text-secondary">Blood oxygen</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text">
                {hasVal ? `${val}%` : 'Not measured by this sensor'}
              </span>
              {hasVal && sample && <SourceBadge source={sample.source} />}
            </div>
          </div>
        )
      }
      case 'skinTempC': {
        const sample = latestVitals?.latest
        const val = sample?.skinTempC
        const hasVal = val !== undefined && val !== null
        return (
          <div
            key={reading}
            className="flex items-center justify-between gap-3 border-b border-border/40 py-2.5 last:border-b-0"
          >
            <span className="text-sm text-text-secondary">Skin temperature</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text">
                {hasVal ? `${val} °C` : 'Not measured by this sensor'}
              </span>
              {hasVal && sample && <SourceBadge source={sample.source} />}
            </div>
          </div>
        )
      }
      case 'bodyMassKg': {
        const validPoints = (bodyMassSeries ?? []).filter(
          (p) => p.value !== null && p.value !== undefined,
        )
        const latestPoint = validPoints.at(-1)
        const hasVal = latestPoint !== undefined && latestPoint.value !== null

        return (
          <div
            key={reading}
            className="flex items-center justify-between gap-3 border-b border-border/40 py-2.5 last:border-b-0"
          >
            <span className="text-sm text-text-secondary">Body mass</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text">
                {hasVal ? `${latestPoint.value} kg` : 'No data yet'}
              </span>
              {hasVal && latestPoint?.source && <SourceBadge source={latestPoint.source} />}
            </div>
          </div>
        )
      }
      default:
        return null
    }
  }

  return (
    <DetailDrawer open={open} title={system.label} onClose={onClose}>
      <div className="flex flex-col gap-6">
        {/* Top: Body system label & Status */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>{system.bodySystem}</SectionLabel>
            <StatusPill tone={systemStatusTone[status]} label={systemStatusLabel[status]} />
          </div>

          {!isUntracked ? (
            <p className="m-0 text-sm text-text-muted">
              Based on what you logged today. It is not a medical finding.
            </p>
          ) : (
            <p className="m-0 text-sm text-text-muted">
              This demo does not measure this system. Here is what space does to it and how it would
              be checked on a mission.
            </p>
          )}
        </div>

        {/* Science & Mission Texts */}
        <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-surface-raised/40 p-4">
          <div className="flex flex-col gap-1">
            <SectionLabel as="h3">WHAT IT DOES</SectionLabel>
            <p className="m-0 text-sm text-text break-words">{system.whatItDoes}</p>
          </div>

          <div className="flex flex-col gap-1">
            <SectionLabel as="h3">IN SPACE</SectionLabel>
            <p className="m-0 text-sm text-text break-words">{system.inSpace}</p>
          </div>

          <div className="flex flex-col gap-1">
            <SectionLabel as="h3">HOW IT IS CHECKED ON A MISSION</SectionLabel>
            <p className="m-0 text-sm text-text break-words">{system.howChecked}</p>
          </div>

          <SourceLine text={system.sourceText} href={system.sourceUrl || undefined} />
        </div>

        {/* RIGHT NOW Section */}
        {hasRightNow && (
          <div className="flex flex-col gap-2">
            <SectionLabel>RIGHT NOW</SectionLabel>
            <div className="flex flex-col rounded-lg border border-border bg-surface px-3">
              {/* Metrics */}
              {system.metricIds.map((mId) => {
                const target = targets[mId]
                const mLabel = target?.label ?? mId
                const unit = target?.unit ?? ''
                const metricVal = today[mId]
                const val = metricVal?.value
                const level = metricVal?.level ?? 'none'
                const hasValue = val !== null && val !== undefined && level !== 'none'
                const formattedVal =
                  val !== null && val !== undefined
                    ? Number.isInteger(val)
                      ? String(val)
                      : String(Number(val.toFixed(1)))
                    : ''

                return (
                  <div
                    key={mId}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0 text-sm text-text-secondary break-words">
                      {mLabel}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text">
                        {hasValue ? `${formattedVal} ${unit}`.trim() : 'No data yet'}
                      </span>
                      <StatusPill tone={levelTone[level]} label={levelLabel[level]} />
                      {hasValue && metricVal?.source && (
                        <SourceBadge source={metricVal.source} />
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Readings */}
              {system.readings.map(renderReadingRow)}
            </div>
          </div>
        )}

        {/* Route Navigation Buttons */}
        {system.routes.length > 0 && (
          <div className="flex flex-col gap-2 pt-2">
            {system.routes.map((route) => {
              const screenId = route.replace(/^\//, '')
              const screenMeta = getScreen(screenId)
              const screenName = screenMeta?.label ?? screenId
              return (
                <div key={route} className="flex w-full [&>button]:w-full">
                  <Button
                    variant="quiet"
                    onClick={() => {
                      onClose()
                      onNavigate(route)
                    }}
                  >
                    Open {screenName}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}
