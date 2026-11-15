import { useState } from 'react'
import { Scale } from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  NumberField,
  SourceBadge,
  SourceLine,
  TrendChart,
} from '@/design'
import { addBodyMass, useSeries, useTargets } from '@/data'
import { formatNumber, shortDate } from './format'
import { droppedTooFar } from './nutrients'

function WeighIn() {
  const [kg, setKg] = useState<number | null>(null)
  const error =
    kg !== null && (kg < 20 || kg > 300) ? 'Enter a weight from 20 to 300 kg.' : undefined
  return (
    <form
      className="flex flex-wrap items-start gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (kg === null || error) return
        addBodyMass(kg)
        setKg(null)
      }}
    >
      <div className="w-44">
        <NumberField
          label="Log today's weight"
          value={kg}
          onChange={setKg}
          min={20}
          max={300}
          step={0.1}
          unit="kg"
          {...(error ? { error } : {})}
        />
      </div>
      <div className="pt-[1.65rem]">
        <Button type="submit" icon={Scale} disabled={kg === null || error !== undefined}>
          Log weight
        </Button>
      </div>
    </form>
  )
}

/** Body mass over the last two weeks, a note when it has dropped, and a weigh-in field. */
export function BodyMassCard() {
  const series = useSeries('bodyMassKg', 14)
  const targets = useTargets()
  const [showForm, setShowForm] = useState(false)
  const logged = series.filter((p): p is typeof p & { value: number } => p.value !== null)
  const latest = logged.at(-1)
  const dropped = droppedTooFar(logged.map((p) => p.value))

  return (
    <Card
      title="Body mass"
      footer={
        <SourceLine text={targets.bodyMassKg.verified ? targets.bodyMassKg.sourceText : ''} />
      }
    >
      <div className="flex flex-col gap-4">
        {latest === undefined ? (
          <>
            <EmptyState
              message="No body mass logged yet."
              actionLabel="Log today's weight"
              onAction={() => setShowForm(true)}
            />
            {showForm && <WeighIn />}
          </>
        ) : (
          <>
            <p className="m-0 flex flex-wrap items-center gap-x-2 text-base text-text">
              <span className="font-semibold tabular-nums">{formatNumber(latest.value)} kg</span>
              <span className="text-sm text-text-secondary">on {shortDate(latest.date)}</span>
              {latest.source && <SourceBadge source={latest.source} />}
            </p>
            <TrendChart
              kind="line"
              labels={series.map((p) => shortDate(p.date))}
              series={[
                { name: 'Body mass (kg)', values: series.map((p) => p.value), tone: 'info' },
              ]}
              summary={`Body mass in kilograms over the last 14 days. ${logged.length} weigh-ins. The latest is ${formatNumber(latest.value)} kg.`}
              height={200}
            />
            {dropped && (
              <p
                role="note"
                className="m-0 rounded-md border border-warn/35 bg-warn/12 px-3 py-2 text-base text-text"
              >
                Down more than 5% since the start of the mission. Worth raising with your flight
                surgeon.
              </p>
            )}
            <WeighIn />
          </>
        )}
      </div>
    </Card>
  )
}
