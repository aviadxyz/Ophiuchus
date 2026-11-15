import { ScreenHeader } from '@/design'
import { ActionsCard } from './ActionsCard'
import { AreasTable } from './AreasTable'
import { ConditionCard } from './ConditionCard'
import { MarkersTable } from './MarkersTable'
import { PlanCard } from './PlanCard'
import { ReadingCard } from './ReadingCard'
import { RiskCard } from './RiskCard'
import { Tiles } from './Tiles'
import { headerPills } from './derive'
import { meta } from './meta'

export default function MedicalStatusScreen() {
  return (
    <>
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={headerPills()}
      />
      <div className="flex flex-col gap-6">
        <p className="m-0 -mt-3 text-sm text-text-muted">
          Sample medical record for demonstration.
        </p>
        <ConditionCard />
        <Tiles />
        <MarkersTable />
        <AreasTable />
        <RiskCard />
        <PlanCard />
        <ActionsCard />
        <ReadingCard />
      </div>
    </>
  )
}
