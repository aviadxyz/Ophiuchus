import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  addWater,
  useAlerts,
  useExerciseSessions,
  useHealthSummary,
  useLatestVitals,
  useMission,
  useMoodCheckins,
  useSeries,
  useTargets,
  useToday,
} from '@/data'
import {
  Button,
  Card,
  ScreenHeader,
  StatTile,
  type HeaderPill,
} from '@/design'
import { askMedbot, setOphiState, useOphiState } from '@/ophi'
import { RoutineCard } from './RoutineCard'
import { SystemDrawer } from './SystemDrawer'
import { SystemList } from './SystemList'
import { BodyFigure } from './figure'
import { meta } from './meta'
import { routine, timeOfAt } from './routine'
import { systemStatus } from './systemStatus'
import { systems } from './systems'

export default function OverviewScreen() {
  const navigate = useNavigate()
  const mission = useMission()
  const today = useToday()
  const targets = useTargets()
  const alerts = useAlerts()
  const healthSummary = useHealthSummary()
  const latestVitals = useLatestVitals()

  const [selectedSystemId, setSelectedSystemId] = useState<string | undefined>()

  // 7-day series for tiles
  const sleepSeries = useSeries('sleepHours', 7)
  const energySeries = useSeries('energyKcal', 7)
  const waterSeries = useSeries('waterMl', 7)
  const exerciseSeries = useSeries('exerciseMinutes', 7)
  const moodSeries = useSeries('moodScore', 7)

  // Series and entries for routine & drawer
  const bodyMassSeries7 = useSeries('bodyMassKg', 7)
  const bodyMassSeries14 = useSeries('bodyMassKg', 14)
  const todaySessions = useExerciseSessions(today.date, today.date)
  const recentMoods = useMoodCheckins(1)

  // Compute routine items
  const routineItems = useMemo(() => {
    return routine({
      today,
      latestVitals,
      moodCheckins: recentMoods,
      exerciseSessions: todaySessions,
      bodyMassSeries: bodyMassSeries7,
    })
  }, [today, latestVitals, recentMoods, todaySessions, bodyMassSeries7])

  // Header pills calculations
  const doneCount = routineItems.filter((i) => i.state === 'done').length
  const dueCount = routineItems.filter((i) => i.state === 'due').length
  const totalTracked = doneCount + dueCount
  const routineTone = dueCount === 0 ? 'ok' : 'warn'

  const openAlerts = useMemo(() => {
    return alerts.filter((a) => a.status === 'open')
  }, [alerts])

  const headerPills = useMemo<HeaderPill[]>(() => {
    const list: HeaderPill[] = [
      { tone: 'neutral', label: `MISSION DAY ${mission.day}` },
      { tone: routineTone, label: `${doneCount} OF ${totalTracked} DONE` },
    ]
    if (openAlerts.length > 0) {
      list.push({
        tone: 'danger',
        label: `${openAlerts.length} OPEN ALERT${openAlerts.length === 1 ? '' : 'S'}`,
      })
    }
    return list
  }, [mission.day, routineTone, doneCount, totalTracked, openAlerts.length])

  // Body systems with statuses
  const systemsWithStatus = useMemo(() => {
    return systems.map((sys) => ({
      id: sys.id,
      label: sys.label,
      kind: sys.kind,
      status: systemStatus(sys, today),
    }))
  }, [today])

  const selectedSystem = useMemo(() => {
    return systems.find((s) => s.id === selectedSystemId) ?? null
  }, [selectedSystemId])

  const selectedSystemStatus = useMemo(() => {
    return selectedSystem ? systemStatus(selectedSystem, today) : 'untracked'
  }, [selectedSystem, today])

  // Ophi's hint behavior
  const ophiState = useOphiState()
  const hasDueItem = dueCount > 0
  const ophiStateRef = useRef(ophiState)

  useEffect(() => {
    ophiStateRef.current = ophiState
  }, [ophiState])

  useEffect(() => {
    if (hasDueItem && ophiState === 'idle') {
      setOphiState('hint')
    } else if (!hasDueItem && ophiState === 'hint') {
      setOphiState('idle')
    }
  }, [hasDueItem, ophiState])

  useEffect(() => {
    return () => {
      if (ophiStateRef.current === 'hint') {
        setOphiState('idle')
      }
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header */}
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={headerPills}
      />

      {/* 2. Five Tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {/* Sleep */}
        <StatTile
          label="Sleep"
          value={today.sleepHours?.value !== null ? Number(today.sleepHours.value.toFixed(1)) : null}
          unit="h"
          targetText={targets.sleepHours ? `Target ${targets.sleepHours.value} h` : undefined}
          level={today.sleepHours?.level}
          source={today.sleepHours?.source ?? undefined}
          trend={sleepSeries.map((p) => (p.value !== null ? Number(p.value.toFixed(1)) : null))}
          onOpen={() => navigate('/sleep')}
        />

        {/* Energy */}
        <StatTile
          label="Energy"
          value={today.energyKcal?.value !== null ? Math.round(today.energyKcal.value) : null}
          unit="kcal"
          targetText={targets.energyKcal ? `Target ${targets.energyKcal.value} kcal` : undefined}
          level={today.energyKcal?.level}
          source={today.energyKcal?.source ?? undefined}
          trend={energySeries.map((p) => (p.value !== null ? Math.round(p.value) : null))}
          onOpen={() => navigate('/nutrition')}
        />

        {/* Water */}
        <StatTile
          label="Water"
          value={
            today.waterMl?.value !== null
              ? Number((today.waterMl.value / 1000).toFixed(1))
              : null
          }
          unit="L"
          targetText={
            targets.waterMl
              ? `Target ${(targets.waterMl.value / 1000).toFixed(1)} L`
              : undefined
          }
          level={today.waterMl?.level}
          source={today.waterMl?.source ?? undefined}
          trend={waterSeries.map((p) =>
            p.value !== null ? Number((p.value / 1000).toFixed(1)) : null,
          )}
          onOpen={() => navigate('/nutrition')}
        />

        {/* Exercise */}
        <StatTile
          label="Exercise"
          value={
            today.exerciseMinutes?.value !== null ? Math.round(today.exerciseMinutes.value) : null
          }
          unit="min"
          targetText={
            targets.exerciseMinutes ? `Target ${targets.exerciseMinutes.value} min` : undefined
          }
          level={today.exerciseMinutes?.level}
          source={today.exerciseMinutes?.source ?? undefined}
          trend={exerciseSeries.map((p) => (p.value !== null ? Math.round(p.value) : null))}
          onOpen={() => navigate('/physical-activity')}
        />

        {/* Mood */}
        <StatTile
          label="Mood"
          value={today.moodScore?.value ?? null}
          unit="of 5"
          targetText={targets.moodScore ? `Target ${targets.moodScore.value} of 5` : undefined}
          level={today.moodScore?.level}
          source={today.moodScore?.source ?? undefined}
          trend={moodSeries.map((p) => p.value)}
          onOpen={() => navigate('/mood')}
        />
      </div>

      {/* 3 & 6 & 8. Routine Card and Body Card */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <RoutineCard
            items={routineItems}
            onAddWater={() => addWater(250)}
            onNavigate={(route) => navigate(route)}
          />
        </div>

        <div className="lg:col-span-7">
          <Card title="Body">
            <div className="flex flex-col items-center gap-6">
              <div className="w-full max-w-[320px]">
                <BodyFigure
                  systems={systemsWithStatus}
                  selectedId={selectedSystemId}
                  onSelect={(id) => setSelectedSystemId(id)}
                  heartRate={latestVitals?.latest?.heartRate}
                />
              </div>
              <div className="min-w-0 w-full">
                <SystemList
                  systems={systemsWithStatus}
                  selectedId={selectedSystemId}
                  onSelect={(id) => setSelectedSystemId(id)}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 4. Open Alerts */}
      {openAlerts.length > 0 && (
        <Card title="Open alerts">
          <div className="flex flex-col divide-y divide-border/40">
            {openAlerts.map((alert) => {
              const timeStr = timeOfAt(alert.at)
              const originLabel = alert.origin === 'console' ? 'This console' : 'Watch'
              const handleOpen = () => {
                if (alert.kind === 'emergency') {
                  navigate('/emergency')
                } else if (alert.screenId) {
                  navigate(`/${alert.screenId.replace(/^\//, '')}`)
                } else {
                  navigate('/emergency')
                }
              }

              return (
                <div
                  key={alert.id}
                  className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-mono text-label uppercase tracking-wider text-danger">
                      {timeStr ? `${timeStr} · ${originLabel}` : originLabel}
                    </p>
                    <p className="m-0 mt-0.5 text-base text-text break-words">{alert.message}</p>
                  </div>
                  <div className="shrink-0 self-start sm:self-center">
                    <Button variant="quiet" size="md" onClick={handleOpen}>
                      Open
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* 5. Ophi's Read */}
      <Card title="Ophi's read">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-base text-text break-words">
            {healthSummary.ophiLine || 'Log something today and I will tell you how it looks.'}
          </p>
          <div className="shrink-0 self-start sm:self-center">
            <Button variant="quiet" size="md" onClick={() => askMedbot('overview')}>
              Ask the Med bot
            </Button>
          </div>
        </div>
      </Card>

      {/* 7. System Drawer */}
      <SystemDrawer
        system={selectedSystem}
        status={selectedSystemStatus}
        open={Boolean(selectedSystem)}
        onClose={() => setSelectedSystemId(undefined)}
        onNavigate={(route) => navigate(route)}
        today={today}
        targets={targets}
        latestVitals={latestVitals}
        bodyMassSeries={bodyMassSeries14}
      />
    </div>
  )
}
