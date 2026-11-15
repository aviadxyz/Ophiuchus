import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Card, ChipGroup, SourceBadge, SourceLine, StatusPill, TrendChart } from '@/design'
import { askMedbot } from '@/ophi'
import { range } from './derive'
import { channels, factors, NIGHT_HOURS, reading, steps, type ChannelId } from './sample'

/** One sample night, hour by hour: the body and the cabin it slept in. Demo profile only. */
export function NightCard() {
  const [channelId, setChannelId] = useState<ChannelId>('heartRate')
  const channel = channels.find((c) => c.id === channelId) ?? channels[0]
  if (!channel) return null
  const stats = range(channel.values)
  return (
    <Card title="Last night, hour by hour">
      <div className="flex flex-col gap-4">
        <p className="m-0 max-w-description">
          Your body and your sleep station on the same clock, so a cause can be told from a result.
          Choose what to look at.
        </p>
        <ChipGroup
          label="What to look at"
          options={channels.map((c) => ({ value: c.id, label: c.label }))}
          selected={[channelId]}
          onChange={([next]) => {
            const found = channels.find((c) => c.id === next)
            if (found) setChannelId(found.id)
          }}
        />
        <dl className="m-0 flex flex-wrap gap-x-6 gap-y-2">
          {[
            ['Lowest', `${stats.min} ${channel.unit}`, `at ${NIGHT_HOURS[stats.minIndex] ?? ''}`],
            ['Average', `${stats.mean} ${channel.unit}`, ''],
            ['Highest', `${stats.max} ${channel.unit}`, ''],
          ].map(([label, value, when]) => (
            <div key={label} className="flex flex-col">
              <dt className="font-mono text-label uppercase tracking-wider text-text-muted">
                {label}
              </dt>
              <dd className="m-0 flex flex-wrap items-baseline gap-x-2">
                <span className="text-lg font-semibold tabular-nums text-text">{value}</span>
                {when && <span className="text-xs text-text-muted">{when}</span>}
              </dd>
            </div>
          ))}
          <div className="flex items-end">
            <SourceBadge source="simulated" />
          </div>
        </dl>
        <TrendChart
          kind="line"
          height={200}
          labels={[...NIGHT_HOURS]}
          series={[{ name: channel.label, values: [...channel.values], tone: 'info' }]}
          summary={`${channel.label} for each hour of the night: ${channel.values
            .map((value, i) => `${value} ${channel.unit} at ${NIGHT_HOURS[i] ?? ''}`)
            .join(', ')}.`}
        />
        <p className="m-0 max-w-description text-text">{channel.note}</p>
      </div>
    </Card>
  )
}

/** What makes sleep harder for this person, in plain sentences with the detail under it. */
export function FactorsCard() {
  return (
    <Card title="What moves your sleep">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {factors.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="m-0 text-base text-text">{item.sentence}</p>
              <p className="m-0 text-xs text-text-muted">{item.technical}</p>
            </div>
            <div className="shrink-0">
              <StatusPill tone={item.tag === 'HIGHER' ? 'danger' : 'warn'} label={item.tag} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** The steps that help, in order. Shown on every profile: they are general, not personal. */
export function StepsCard() {
  const navigate = useNavigate()
  return (
    <Card title="What helps" footer={<SourceLine text="" />}>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {steps.map((step, index) => (
          <li key={step.id} className="flex gap-3 rounded-md border border-border bg-bg p-3">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-mono text-sm text-text-secondary"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="m-0 text-base text-text">
                <span className="sr-only">Step {index + 1}. </span>
                {step.text}
              </p>
              <div>
                <StatusPill tone="neutral" label={step.tag} />
              </div>
              {step.link === 'environment' && (
                <div>
                  <Button variant="quiet" onClick={() => navigate('/environment')}>
                    Open Environment
                  </Button>
                </div>
              )}
              {step.link === 'medbot' && (
                <div>
                  <Button onClick={() => askMedbot('sleep')}>Ask the Med bot about this</Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/** The references. Two link to the paper; the one that names a body of work says so. */
export function ReadingCard() {
  return (
    <Card title="Key reading">
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {reading.map((item) => (
          <li key={item.title} className="rounded-md border border-border bg-bg p-3">
            <p className="m-0 text-base break-words text-text">{item.title}</p>
            <SourceLine
              text={item.href ? (item.linkText ?? 'Open the paper') : ''}
              href={item.href}
            />
          </li>
        ))}
      </ol>
    </Card>
  )
}
