import { useMemo } from 'react'
import {
  addDays,
  levelFor,
  useExerciseSessions,
  useSeries,
  useTargets,
  useToday,
} from '@/data'
import {
  Card,
  GameLinks,
  ScreenHeader,
  StatTile,
  TrendChart,
  type HeaderPill,
  type Source,
  type Tone,
} from '@/design'
import {
  getCoverageScores,
  getMondayOfWeek,
  getStreak,
  getTodayStatus,
  getWeeklyCounts,
  getWeekViewData,
} from './compute'
import { CoverageCard } from './CoverageCard'
import { HeartRateTile } from './HeartRateTile'
import { meta } from './meta'
import { TodayPrescriptionCard } from './TodayPrescriptionCard'

export default function PhysicalActivityScreen() {
  const todaySummary = useToday()
  const today = todaySummary.date
  const targets = useTargets()

  // 1. Today's sessions
  const todaySessions = useExerciseSessions(today, today)

  // 2. 60-day history window for streak, week view, and weekly counts
  const historyStart = useMemo(() => addDays(today, -60), [today])
  const historySessions = useExerciseSessions(historyStart, today)

  // Dates for current week (Monday to today) and last 7 days window
  const monday = useMemo(() => getMondayOfWeek(today), [today])
  const last7DaysStart = useMemo(() => addDays(today, -6), [today])

  // Weekly counts (Monday to today)
  const weeklyCounts = useMemo(
    () => getWeeklyCounts(historySessions, monday, today),
    [historySessions, monday, today],
  )

  // Countermeasure coverage (last 7 days)
  const coverageScores = useMemo(
    () => getCoverageScores(historySessions, last7DaysStart, today),
    [historySessions, last7DaysStart, today],
  )

  // Streak calculation
  const streak = useMemo(
    () => getStreak(historySessions, today),
    [historySessions, today],
  )

  // Week view data (last 7 days)
  const weekView = useMemo(
    () => getWeekViewData(historySessions, last7DaysStart, today),
    [historySessions, last7DaysStart, today],
  )

  // 7-day sparkline trend for Minutes today tile
  const minutesSeries7 = useSeries('exerciseMinutes', 7)
  const minutesTrend = useMemo(
    () => minutesSeries7.map((pt) => pt.value),
    [minutesSeries7],
  )

  // Weekly session targets
  const resistiveTarget = targets.resistiveSessionsPerWeek?.value ?? 6
  const aerobicTarget = targets.aerobicSessionsPerWeek?.value ?? 6
  const targetTotal = resistiveTarget + aerobicTarget

  // Header pills
  const todayStatus = getTodayStatus(todaySessions)
  const weekPillTone: Tone =
    weeklyCounts.totalCount >= targetTotal
      ? 'ok'
      : weeklyCounts.totalCount > 0
        ? 'info'
        : 'neutral'
  const streakPillTone: Tone = streak > 0 ? 'ok' : 'neutral'

  const headerPills: HeaderPill[] = [
    { tone: todayStatus.tone, label: todayStatus.status },
    {
      tone: weekPillTone,
      label: `${weeklyCounts.totalCount} of ${targetTotal} sessions this week`,
    },
    {
      tone: streakPillTone,
      label: `${streak} day streak`,
    },
  ]

  // Week source for weekly session tiles
  const weekSource: Source | undefined = useMemo(() => {
    const thisWeek = historySessions.filter(
      (s) =>
        s.date >= monday &&
        s.date <= today &&
        (s.status === 'done' || s.status === 'changed'),
    )
    if (thisWeek.length === 0) return undefined
    if (thisWeek.some((s) => s.source === 'simulated')) return 'simulated'
    return 'entered'
  }, [historySessions, monday, today])

  return (
    <>
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={headerPills}
      />

      <div className="flex flex-col gap-6">
        {/* Three stat tiles */}
        <section aria-label="Key exercise metrics">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile
              label="Minutes today"
              value={todaySummary.exerciseMinutes.value}
              unit={targets.exerciseMinutes?.unit ?? 'min'}
              targetText={`Target ${targets.exerciseMinutes?.value ?? 120} min`}
              level={todaySummary.exerciseMinutes.level}
              source={todaySummary.exerciseMinutes.source ?? undefined}
              trend={minutesTrend}
            />
            <StatTile
              label="Resistive this week"
              value={weeklyCounts.hasData ? weeklyCounts.resistiveCount : null}
              unit={targets.resistiveSessionsPerWeek?.unit ?? 'sessions'}
              targetText={`Target ${resistiveTarget} sessions`}
              level={
                weeklyCounts.hasData && targets.resistiveSessionsPerWeek
                  ? levelFor(weeklyCounts.resistiveCount, targets.resistiveSessionsPerWeek)
                  : 'none'
              }
              source={weekSource}
            />
            <StatTile
              label="Aerobic this week"
              value={weeklyCounts.hasData ? weeklyCounts.aerobicCount : null}
              unit={targets.aerobicSessionsPerWeek?.unit ?? 'sessions'}
              targetText={`Target ${aerobicTarget} sessions`}
              level={
                weeklyCounts.hasData && targets.aerobicSessionsPerWeek
                  ? levelFor(weeklyCounts.aerobicCount, targets.aerobicSessionsPerWeek)
                  : 'none'
              }
              source={weekSource}
            />
          </div>
        </section>

        {/* Today's prescription */}
        <TodayPrescriptionCard sessions={todaySessions} />

        {/* Countermeasure coverage */}
        <CoverageCard scores={coverageScores} />

        {/* Week view */}
        <Card title="Week view">
          <TrendChart
            kind="bar"
            labels={weekView.labels}
            series={[
              { name: 'Planned', values: weekView.plannedValues, tone: 'info' },
              { name: 'Completed', values: weekView.completedValues, tone: 'ok' },
            ]}
            targetValue={targets.exerciseMinutes?.value ?? 120}
            summary={weekView.summary}
          />
        </Card>

        {/* Heart rate */}
        <section aria-label="Heart rate reading">
          <HeartRateTile />
        </section>

        {/* Mini games */}
        <GameLinks screenId={meta.id} />
      </div>
    </>
  )
}
