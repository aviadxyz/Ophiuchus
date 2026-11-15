import { Card, ProgressBar, StatusPill } from '@/design'
import { coverageLabel, type CoverageScores } from './compute'

export type CoverageCardProps = {
  scores: CoverageScores
}

export function CoverageCard({ scores }: CoverageCardProps) {
  return (
    <Card title="Countermeasure coverage">
      <div className="flex flex-col gap-5">
        {/* Bone loading */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-text">Bone loading</span>
            <StatusPill
              tone={scores.boneLoading.tone}
              label={coverageLabel(scores.boneLoading.tone)}
            />
          </div>
          <ProgressBar
            value={scores.boneLoading.score}
            tone={scores.boneLoading.tone}
            label={`${scores.boneLoading.actualMinutes} of 240 min weekly goal`}
          />
          <p className="m-0 text-xs text-text-secondary">
            Add more resistive sessions or harness treadmill runs to stimulate bone remodeling.
          </p>
        </div>

        {/* Muscle */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-text">Muscle</span>
            <StatusPill
              tone={scores.muscle.tone}
              label={coverageLabel(scores.muscle.tone)}
            />
          </div>
          <ProgressBar
            value={scores.muscle.score}
            tone={scores.muscle.tone}
            label={`${scores.muscle.actualMinutes} of 240 min weekly goal`}
          />
          <p className="m-0 text-xs text-text-secondary">
            Complete full-load resistive sets targeting major leg and core muscle groups.
          </p>
        </div>

        {/* Cardiovascular */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-text">Cardiovascular</span>
            <StatusPill
              tone={scores.cardiovascular.tone}
              label={coverageLabel(scores.cardiovascular.tone)}
            />
          </div>
          <ProgressBar
            value={scores.cardiovascular.score}
            tone={scores.cardiovascular.tone}
            label={`${scores.cardiovascular.actualMinutes} of 300 min weekly goal`}
          />
          <p className="m-0 text-xs text-text-secondary">
            Log cycle intervals, treadmill sessions, or active mini games to raise aerobic endurance.
          </p>
        </div>
      </div>

      <p className="mt-4 m-0 border-t border-border pt-3 text-xs text-text-muted">
        Illustrative model for this demo, not a clinical measure.
      </p>
    </Card>
  )
}
