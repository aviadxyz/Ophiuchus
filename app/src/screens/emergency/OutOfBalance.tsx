import { Link } from 'react-router'
import {
  Button,
  Card,
  levelLabel,
  levelTone,
  SourceBadge,
  SourceLine,
  StatusPill,
  type Tone,
} from '@/design'
import {
  metricIds,
  useLatestVitals,
  useTargets,
  useToday,
  type MetricId,
  type Target,
} from '@/data'
import { askMedbot } from '@/ophi'
import { getScreen } from '@/registry'
import { heartRateOut, LIMITS, spo2Out } from './limits'

/** The screen each metric belongs to. Heart rate is shown above, body mass has no screen of its own. */
const SCREEN_FOR: Partial<Record<MetricId, string>> = {
  sleepHours: 'sleep',
  energyKcal: 'nutrition',
  waterMl: 'nutrition',
  proteinG: 'nutrition',
  sodiumMg: 'nutrition',
  calciumMg: 'nutrition',
  ironMg: 'nutrition',
  vitaminDIu: 'nutrition',
  omega3G: 'nutrition',
  potassiumMg: 'nutrition',
  exerciseMinutes: 'physical-activity',
  moodScore: 'mood',
}

const number = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })

function targetText(target: Target): string {
  if (target.kind === 'min') return `at least ${number(target.value)} ${target.unit}`
  if (target.kind === 'max') return `at most ${number(target.value)} ${target.unit}`
  return `${number(target.value)} to ${number(target.upper ?? target.value)} ${target.unit}`
}

function timeOf(at: string): string {
  const date = new Date(at)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

type Reading = {
  label: string
  value: number | null
  unit: string
  limit: string
  out: boolean
}

const READING_PILL: Record<'in' | 'out' | 'none', { tone: Tone; label: string }> = {
  in: { tone: 'ok', label: 'IN RANGE' },
  out: { tone: 'danger', label: 'OUT OF RANGE' },
  none: { tone: 'neutral', label: 'NO DATA' },
}

/** What the important readings and today's targets show. Hidden when nothing is off. */
export function OutOfBalance({ alertOpen }: { alertOpen: boolean }) {
  const { latest } = useLatestVitals()
  const today = useToday()
  const targets = useTargets()

  const heartRate = latest?.heartRate ?? null
  const spo2 = latest?.spo2 ?? null
  const readings: Reading[] = [
    {
      label: 'Heart rate',
      value: heartRate,
      unit: 'bpm',
      limit: `Alert at ${LIMITS.heartRateHigh} bpm or more, or ${LIMITS.heartRateLow} or less, for ${LIMITS.sustainSeconds} seconds`,
      out: heartRate !== null && heartRateOut(heartRate),
    },
    {
      label: 'Blood oxygen',
      value: spo2,
      unit: '%',
      limit: `Alert at ${LIMITS.spo2Low}% or less, for ${LIMITS.sustainSeconds} seconds`,
      out: spo2 !== null && spo2Out(spo2),
    },
  ]

  const others = metricIds
    .filter((id) => id !== 'heartRate')
    .map((id) => ({ id, metric: today[id] }))
    .filter(({ metric }) => metric.level === 'watch' || metric.level === 'act')

  const anyReadingOff = readings.some((r) => r.out)
  if (!alertOpen && !anyReadingOff && others.length === 0) return null

  return (
    <Card title="What is out of balance">
      <div className="flex flex-col gap-5">
        <section aria-labelledby="balance-important" className="flex flex-col gap-2">
          <h3
            id="balance-important"
            className="m-0 font-mono text-label font-medium uppercase tracking-wider text-text-muted"
          >
            Important
          </h3>
          <ul className="m-0 list-none divide-y divide-border p-0">
            {readings.map((reading) => {
              const pill =
                READING_PILL[reading.value === null ? 'none' : reading.out ? 'out' : 'in']
              return (
                <li
                  key={reading.label}
                  className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="m-0 text-base font-medium text-text">{reading.label}</p>
                    <p className="m-0 text-xs break-words text-text-muted">{reading.limit}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {reading.value === null || !latest ? (
                      <span className="text-base text-text-muted">No data</span>
                    ) : (
                      <>
                        <span className="font-mono text-base font-semibold text-text">
                          {reading.value} {reading.unit}
                        </span>
                        <SourceBadge source={latest.source} />
                        {timeOf(latest.at) && (
                          <span className="font-mono text-xs text-text-muted">
                            {timeOf(latest.at)}
                          </span>
                        )}
                      </>
                    )}
                    <StatusPill tone={pill.tone} label={pill.label} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section aria-labelledby="balance-others" className="flex flex-col gap-2">
          <h3
            id="balance-others"
            className="m-0 font-mono text-label font-medium uppercase tracking-wider text-text-muted"
          >
            Also off target today
          </h3>
          {others.length === 0 ? (
            <p className="m-0 text-sm text-text-muted">Nothing else is off target today.</p>
          ) : (
            <ul className="m-0 list-none divide-y divide-border p-0">
              {others.map(({ id, metric }) => {
                const target = targets[metric.targetId]
                const screenId = SCREEN_FOR[id]
                const screen = screenId ? getScreen(screenId) : undefined
                return (
                  <li
                    key={id}
                    className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-base font-medium text-text">{target.label}</p>
                      <p className="m-0 text-xs break-words text-text-muted">
                        Target: {targetText(target)}
                      </p>
                      {screen && (
                        <Link
                          to={`/${screen.id}`}
                          className="text-sm text-text-secondary underline decoration-border underline-offset-2 hover:text-text"
                        >
                          Open {screen.label}
                        </Link>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-semibold text-text">
                        {metric.value === null
                          ? 'No data'
                          : `${number(metric.value)} ${target.unit}`}
                      </span>
                      {metric.source && <SourceBadge source={metric.source} />}
                      <StatusPill tone={levelTone[metric.level]} label={levelLabel[metric.level]} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised/40 p-3.5">
          <p className="m-0 text-base text-text">
            If a reading stays out of range or you feel unwell, tell the flight surgeon. The Med bot
            can explain what each reading means.
          </p>
          {!alertOpen && (
            <div>
              <Button variant="quiet" onClick={() => askMedbot('emergency')}>
                Ask the Med bot
              </Button>
            </div>
          )}
        </div>

        <div>
          <p className="m-0 text-sm text-text-secondary">
            Limits shown here are for demonstration, not clinical limits.
          </p>
          <SourceLine text="to be confirmed" />
        </div>
      </div>
    </Card>
  )
}
