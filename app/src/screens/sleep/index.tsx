import {
  Card,
  GameLinks,
  ScreenHeader,
  SourceLine,
  StatTile,
  TrendChart,
  levelLabel,
  levelTone,
  type HeaderPill,
} from '@/design'
import { useActiveProfile, useSeries, useTargets, useToday } from '@/data'
import { LogCard } from './LogCard'
import { FactorsCard, NightCard, ReadingCard, StepsCard } from './NightDetail'
import { shortDate, summarizeWeek } from './derive'
import { meta } from './meta'

export default function SleepScreen() {
  const profile = useActiveProfile()
  const today = useToday()
  const targets = useTargets()
  const series = useSeries('sleepHours', 14)
  const target = targets.sleepHours
  const lastNight = today.sleepHours
  const week = summarizeWeek(series, target.value)
  const todayDate = series[series.length - 1]?.date ?? today.date
  const recorded = series.filter((point) => point.value !== null).length

  const pills: HeaderPill[] = [
    { tone: levelTone[lastNight.level], label: `LAST NIGHT ${levelLabel[lastNight.level]}` },
  ]
  if (week.nights > 0) {
    pills.push({ tone: 'neutral', label: `${week.onTarget} OF ${week.nights} NIGHTS ON TARGET` })
  }

  return (
    <>
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={pills}
      />
      <div className="flex flex-col gap-6">
        <section aria-label="Sleep summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Last night"
            value={lastNight.value}
            unit="h"
            targetText={`Target ${target.value} h`}
            level={lastNight.level}
            {...(lastNight.source ? { source: lastNight.source } : {})}
            trend={series.slice(-7).map((point) => point.value)}
          />
          <StatTile
            label="7-night average"
            value={week.average}
            unit="h"
            targetText={`Target ${target.value} h`}
          />
          <StatTile
            label="Sleep debt, 7 nights"
            value={week.debt}
            unit="h"
            targetText="Hours short of the target"
          />
          <StatTile
            label="Nights recorded"
            value={week.nights}
            unit="of 7"
            targetText="A night with no record is not counted"
          />
        </section>

        <Card
          title="Last 14 nights"
          footer={
            <SourceLine
              text={target.verified ? target.sourceText : ''}
              href={target.sourceUrl || undefined}
            />
          }
        >
          {recorded === 0 ? (
            <p className="m-0">No night has been recorded yet. Log last night below.</p>
          ) : (
            <TrendChart
              kind="bar"
              height={220}
              labels={series.map((point) => shortDate(point.date))}
              series={[
                {
                  name: 'Hours slept',
                  values: series.map((point) => point.value),
                  tone: levelTone[lastNight.level],
                },
              ]}
              targetValue={target.value}
              summary={`Hours slept on each of the last 14 nights, with ${recorded} of 14 recorded. The target is ${target.value} hours.`}
            />
          )}
        </Card>

        <LogCard today={todayDate} hasRecord={lastNight.value !== null} />

        {profile.kind === 'demo' && (
          <>
            <p className="m-0 text-sm text-text-muted">
              The two cards below are a sample record for demonstration.
            </p>
            <NightCard />
            <FactorsCard />
          </>
        )}

        <StepsCard />
        <ReadingCard />
      </div>
      {/* Shows every mini game whose meta lists this screen. Nothing when there is none. */}
      <GameLinks screenId={meta.id} />
    </>
  )
}
