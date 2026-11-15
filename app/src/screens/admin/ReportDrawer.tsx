import {
  DetailDrawer,
  levelLabel,
  levelTone,
  SectionLabel,
  SourceBadge,
  SourceLine,
  StatusPill,
  TrendChart,
  type Source,
} from '@/design'
import {
  moodWord,
  useTargets,
  type GroundAlert,
  type GroundReport,
  type GroundWeekMetric,
  type Target,
} from '@/data'
import { ago, clockTime, isLate } from './text'

type Line = { metric: GroundWeekMetric; label: string; unit: string; area: keyof AreaKeys }
type AreaKeys = { sleep: 1; food: 1; water: 1; exercise: 1; mood: 1 }

const LINES: readonly Line[] = [
  { metric: 'sleepHours', label: 'Sleep', unit: 'h', area: 'sleep' },
  { metric: 'energyKcal', label: 'Food energy', unit: 'kcal', area: 'food' },
  { metric: 'waterMl', label: 'Water', unit: 'ml', area: 'water' },
  { metric: 'exerciseMinutes', label: 'Exercise', unit: 'min', area: 'exercise' },
  { metric: 'moodScore', label: 'Mood', unit: 'of 5', area: 'mood' },
]

/** Energy depends on the person's own body, so the ground view shows only its level. */
const OWN_TARGET: ReadonlySet<GroundWeekMetric> = new Set(['energyKcal'])

const formatNumber = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })

function valueText(metric: GroundWeekMetric, value: number | null, unit: string): string {
  if (value === null) return 'Missing'
  if (metric === 'moodScore') return `${formatNumber(value)} of 5, ${moodWord(value).toLowerCase()}`
  return `${formatNumber(value)} ${unit}`
}

function targetText(target: Target): string {
  const amount = `${formatNumber(target.value)} ${target.unit}`
  return target.kind === 'min'
    ? `at least ${amount}`
    : target.kind === 'max'
      ? `at most ${amount}`
      : amount
}

const weekday = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })

/** The sources in a week, for the badge under its chart. */
function weekSources(points: GroundReport['week'][GroundWeekMetric]): Source[] {
  return [...new Set(points.flatMap((p) => (p.source ? [p.source] : [])))]
}

function weekSummary(line: Line, points: GroundReport['week'][GroundWeekMetric]): string {
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]))
  if (values.length === 0) return `${line.label}: nothing logged in the last seven days.`
  const average = values.reduce((sum, v) => sum + v, 0) / values.length
  const precise = line.metric === 'sleepHours' || line.metric === 'moodScore'
  const shown = precise ? Math.round(average * 10) / 10 : Math.round(average)
  return `${line.label}: ${values.length} of 7 days logged, average ${formatNumber(shown)} ${line.unit}.`
}

export type ReportDrawerProps = {
  report: GroundReport | null
  now: number
  onClose: () => void
}

/** One crew member's report, read only. */
export function ReportDrawer({ report, now, onClose }: ReportDrawerProps) {
  const targets = useTargets()
  return (
    <DetailDrawer
      open={report !== null}
      title={report?.displayName ?? 'Crew report'}
      onClose={onClose}
    >
      {report && <ReportBody report={report} now={now} targets={targets} />}
    </DetailDrawer>
  )
}

function ReportBody({
  report,
  now,
  targets,
}: {
  report: GroundReport
  now: number
  targets: ReturnType<typeof useTargets>
}) {
  const questions = report.alerts.filter((a) => a.kind === 'health')
  const emergencies = report.alerts.filter((a) => a.kind === 'emergency')

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <span className="text-base text-text">{report.role}</span>
          {report.kind === 'demo' && <SourceBadge source="simulated" />}
        </p>
        <p className="m-0">
          Mission day {report.missionDay}. Sent {clockTime(report.sentAt, now)} ·{' '}
          {ago(report.sentAt, now)}. Arrived {clockTime(report.receivedAt, now)}.
        </p>
        {isLate(report.sentAt, now) && (
          <p className="m-0 text-text-muted">No newer report has arrived.</p>
        )}
      </div>

      <section className="flex flex-col gap-3" aria-label="Today">
        <SectionLabel as="h3">Today</SectionLabel>
        <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
          {LINES.map((line) => {
            const area = report.summary[line.area]
            return (
              <li key={line.area} className="flex flex-col gap-1 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-text">{line.label}</span>
                  <StatusPill tone={levelTone[area.level]} label={levelLabel[area.level]} />
                  {area.source ? (
                    <SourceBadge source={area.source} />
                  ) : (
                    <span className="text-xs text-text-muted">No data</span>
                  )}
                </div>
                <p className="m-0 text-sm text-text-secondary">{area.text}</p>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-label="Against the target">
        <SectionLabel as="h3">Against the target</SectionLabel>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {LINES.map((line) => {
            const value = report.today[line.metric]
            const target = targets[line.metric]
            return (
              <li key={line.metric} className="flex flex-col">
                <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                  <span className="text-text">{line.label}:</span>
                  <span>{valueText(line.metric, value.value, line.unit)}</span>
                  <span>
                    {OWN_TARGET.has(line.metric)
                      ? 'against their own daily target'
                      : `against a daily target of ${targetText(target)}`}
                  </span>
                  <StatusPill tone={levelTone[value.level]} label={levelLabel[value.level]} />
                  {value.source && <SourceBadge source={value.source} />}
                </p>
                <SourceLine
                  text={target.verified ? target.sourceText : ''}
                  href={target.verified && target.sourceUrl ? target.sourceUrl : undefined}
                />
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-4" aria-label="Last seven days">
        <SectionLabel as="h3">Last seven days</SectionLabel>
        {LINES.map((line) => {
          const points = report.week[line.metric]
          const sources = weekSources(points)
          const target = targets[line.metric]
          const ownTarget = OWN_TARGET.has(line.metric)
          return (
            <div key={line.metric} className="flex min-w-0 flex-col gap-1">
              <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-text">
                {line.label}
                {sources.map((s) => (
                  <SourceBadge key={s} source={s} />
                ))}
              </p>
              <TrendChart
                kind={line.metric === 'sleepHours' || line.metric === 'moodScore' ? 'line' : 'bar'}
                labels={points.map((p) => weekday(p.date))}
                series={[{ name: line.label, values: points.map((p) => p.value), tone: 'info' }]}
                targetValue={ownTarget ? undefined : target.value}
                summary={weekSummary(line, points)}
                height={140}
              />
              {!ownTarget && (
                <SourceLine
                  text={target.verified ? target.sourceText : ''}
                  href={target.verified && target.sourceUrl ? target.sourceUrl : undefined}
                />
              )}
            </div>
          )
        })}
      </section>

      <section className="flex flex-col gap-2" aria-label="Latest vitals">
        <SectionLabel as="h3">Latest vitals</SectionLabel>
        {report.vitals ? (
          <div className="flex flex-col gap-1 text-sm text-text-secondary">
            <p className="m-0 flex flex-wrap items-center gap-2">
              <span className="text-text">
                {[
                  report.vitals.heartRate !== undefined
                    ? `Heart rate ${report.vitals.heartRate} bpm`
                    : null,
                  report.vitals.spo2 !== undefined ? `Blood oxygen ${report.vitals.spo2}%` : null,
                  report.vitals.skinTempC !== undefined
                    ? `Skin ${report.vitals.skinTempC} °C`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'No reading'}
              </span>
              <SourceBadge source={report.vitals.source} />
            </p>
            <p className="m-0">
              Read at {clockTime(report.vitals.at, now)}, {ago(report.vitals.at, now)}. A consumer
              watch is not a medical device.
            </p>
          </div>
        ) : (
          <p className="m-0 text-sm text-text-secondary">No reading</p>
        )}
      </section>

      <AlertList
        title="Questions for the flight surgeon"
        alerts={questions}
        empty="No question in the last 24 hours."
        now={now}
      />
      <AlertList
        title="Emergency alerts"
        alerts={emergencies}
        empty="No emergency alert in the last 24 hours."
        now={now}
      />
    </div>
  )
}

const statusWords: Record<
  GroundAlert['status'],
  { label: string; tone: 'danger' | 'neutral' | 'ok' }
> = {
  open: { label: 'OPEN', tone: 'danger' },
  acknowledged: { label: 'ACKNOWLEDGED', tone: 'ok' },
  cancelled: { label: 'CANCELLED', tone: 'neutral' },
}

function AlertList({
  title,
  alerts,
  empty,
  now,
}: {
  title: string
  alerts: GroundAlert[]
  empty: string
  now: number
}) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <SectionLabel as="h3">{title}</SectionLabel>
      {alerts.length === 0 ? (
        <p className="m-0 text-sm text-text-secondary">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
          {alerts.map((alert, i) => (
            <li key={`${alert.at}-${i}`} className="flex flex-col gap-1 py-2">
              <p className="m-0 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <span>
                  {clockTime(alert.at, now)} ·{' '}
                  {alert.kind === 'health' ? 'Health question' : 'Emergency'}
                </span>
                <StatusPill
                  tone={statusWords[alert.status].tone}
                  label={statusWords[alert.status].label}
                />
              </p>
              <p className="m-0 text-sm break-words text-text">{alert.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
