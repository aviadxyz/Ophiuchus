import { Card, ProgressBar, StatusPill } from '@/design'
import { coverageLabel, type CoverageScores } from './compute'

export type CoverageCardProps = {
  scores: CoverageScores
}

type CoverageRowProps = {
  name: string
  coverage: CoverageScores[keyof CoverageScores]
  goalMinutes: number
  advice: string
}

export const GOAL_MET_TEXT = 'Goal met this week.'

function CoverageRow({ name, coverage, goalMinutes, advice }: CoverageRowProps) {
  const goalMet = coverage.actualMinutes >= goalMinutes
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-text">{name}</span>
        <StatusPill tone={coverage.tone} label={coverageLabel(coverage.tone)} />
      </div>
      <ProgressBar
        value={coverage.score}
        tone={coverage.tone}
        label={`${coverage.actualMinutes} of ${goalMinutes} min weekly goal`}
      />
      <p className="m-0 text-xs text-text-secondary">{goalMet ? GOAL_MET_TEXT : advice}</p>
    </div>
  )
}

export function CoverageCard({ scores }: CoverageCardProps) {
  return (
    <Card title="Countermeasure coverage">
      <div className="flex flex-col gap-5">
        <CoverageRow
          name="Bone loading"
          coverage={scores.boneLoading}
          goalMinutes={240}
          advice="Add more resistive sessions or harness treadmill runs to stimulate bone remodeling."
        />
        <CoverageRow
          name="Muscle"
          coverage={scores.muscle}
          goalMinutes={240}
          advice="Complete full-load resistive sets targeting major leg and core muscle groups."
        />
        <CoverageRow
          name="Cardiovascular"
          coverage={scores.cardiovascular}
          goalMinutes={300}
          advice="Log cycle intervals, treadmill sessions, or active mini games to raise aerobic endurance."
        />
      </div>

      <p className="mt-4 m-0 border-t border-border pt-3 text-xs text-text-muted">
        Illustrative model for this demo, not a clinical measure.
      </p>
    </Card>
  )
}
