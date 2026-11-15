import { useState } from 'react'
import { ScreenHeader, SectionLabel } from '@/design'
import { useEnvironment, useTargets } from '@/data'
import { ConnectsCard } from './ConnectsCard'
import { EnvironmentDrawer } from './EnvironmentDrawer'
import { EnvironmentTile } from './EnvironmentTile'
import { headerPills, levelCounts } from './derive'
import { meta } from './meta'
import { environmentMetrics, groups, type EnvironmentMetric } from './metrics'

export default function EnvironmentScreen() {
  const { sample } = useEnvironment()
  const targets = useTargets()
  const [open, setOpen] = useState<EnvironmentMetric | null>(null)
  return (
    <>
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={headerPills(levelCounts(sample, targets))}
      />
      <div className="flex flex-col gap-6">
        <p className="m-0 -mt-3 max-w-description text-sm text-text-muted">
          These values are simulated. The app has no cabin sensor. They are the same for every crew
          member, because everyone shares the same station.
        </p>
        {groups.map((group) => (
          <section key={group} aria-label={group} className="flex flex-col gap-3">
            <SectionLabel>{group}</SectionLabel>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {environmentMetrics
                .filter((metric) => metric.group === group)
                .map((metric) => (
                  <EnvironmentTile
                    key={metric.id}
                    metric={metric}
                    sample={sample}
                    onOpen={() => setOpen(metric)}
                  />
                ))}
            </div>
          </section>
        ))}
        <ConnectsCard />
      </div>
      <EnvironmentDrawer metric={open} sample={sample} onClose={() => setOpen(null)} />
    </>
  )
}
