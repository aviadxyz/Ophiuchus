import { Link } from 'react-router'
import {
  DetailDrawer,
  SectionLabel,
  SourceBadge,
  SourceLine,
  StatusPill,
  TrendChart,
  levelLabel,
  levelTone,
} from '@/design'
import { useEnvironmentSeries, useTargets, type EnvironmentSample } from '@/data'
import { formatNumber, hourLabel, levelOf, targetFor, targetWords, unitOf } from './derive'
import type { EnvironmentMetric } from './metrics'

export type EnvironmentDrawerProps = {
  metric: EnvironmentMetric | null
  sample: EnvironmentSample
  onClose: () => void
}

export function EnvironmentDrawer({ metric, sample, onClose }: EnvironmentDrawerProps) {
  return (
    <DetailDrawer open={metric !== null} title={metric?.name ?? ''} onClose={onClose}>
      {metric && <DrawerBody metric={metric} sample={sample} />}
    </DetailDrawer>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel as="h3">{title}</SectionLabel>
      {children}
    </section>
  )
}

function DrawerBody({ metric, sample }: { metric: EnvironmentMetric; sample: EnvironmentSample }) {
  const targets = useTargets()
  const series = useEnvironmentSeries(metric.id, 24)
  const target = targetFor(metric, targets)
  const unit = unitOf(metric, targets)
  const value = sample[metric.id]
  const level = levelOf(metric, value, targets)
  const values = series.map((point) => point.value)
  const highest = series.reduce((best, point) => (point.value > best.value ? point : best))
  const lowest = series.reduce((best, point) => (point.value < best.value ? point : best))
  const chartSeries = [{ name: metric.name, values, tone: 'ok' as const }]
  const isRange = target?.kind === 'range'
  if (isRange && target) {
    const lower = series.map(() => target.value)
    const upper = series.map(() => target.upper ?? target.value)
    chartSeries.push({ name: 'Lower limit', values: lower, tone: 'neutral' as never })
    chartSeries.push({ name: 'Upper limit', values: upper, tone: 'neutral' as never })
  }
  const show = (n: number) => `${formatNumber(n, metric.digits)} ${unit}`
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-number font-semibold tabular-nums text-text">
          {formatNumber(value, metric.digits)}
        </span>
        <span className="text-sm text-text-muted">{unit}</span>
        {level && <StatusPill tone={levelTone[level]} label={levelLabel[level]} />}
        <SourceBadge source={sample.source} />
      </div>
      <Section title="What this is">
        <p className="m-0 text-base text-text break-words">{metric.what}</p>
      </Section>
      <Section title="The last 24 hours">
        <TrendChart
          kind="line"
          labels={series.map((point) => hourLabel(point.at))}
          series={chartSeries}
          {...(target && !isRange ? { targetValue: target.value } : {})}
          summary={`${metric.name} over the last 24 hours, one value per hour. Highest ${show(highest.value)} at ${hourLabel(highest.at)}, lowest ${show(lowest.value)} at ${hourLabel(lowest.at)}.`}
        />
        <dl className="m-0 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-text-muted">Highest</dt>
            <dd className="m-0 font-semibold text-text">
              {show(highest.value)} at {hourLabel(highest.at)}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Lowest</dt>
            <dd className="m-0 font-semibold text-text">
              {show(lowest.value)} at {hourLabel(lowest.at)}
            </dd>
          </div>
        </dl>
        <p className="m-0 text-sm text-text-secondary">{targetWords(target)}</p>
      </Section>
      <Section title="What it does to the body">
        <p className="m-0 break-words">{metric.body}</p>
      </Section>
      <Section title="What to do">
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
          {metric.todo.map((step) => (
            <li key={step} className="break-words">
              {step}
            </li>
          ))}
        </ul>
      </Section>
      {target ? (
        <SourceLine
          text={target.verified ? target.sourceText : ''}
          {...(target.verified && target.sourceUrl ? { href: target.sourceUrl } : {})}
        />
      ) : (
        <SourceLine text="to be confirmed" />
      )}
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {metric.links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="text-text-secondary underline decoration-border underline-offset-2 hover:text-text"
          >
            Related: {link.label}
          </Link>
        ))}
      </p>
    </div>
  )
}
