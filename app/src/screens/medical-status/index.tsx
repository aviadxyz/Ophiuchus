import { useState } from 'react'
import { EmptyState, ScreenHeader } from '@/design'
import { useActiveProfile } from '@/data'
import { ActionsCard } from './ActionsCard'
import { AreasTable } from './AreasTable'
import { ConditionCard } from './ConditionCard'
import { MarkersTable } from './MarkersTable'
import { PlanCard } from './PlanCard'
import { ReadingCard } from './ReadingCard'
import { RiskCard } from './RiskCard'
import { ScheduleDrawer } from './ScheduleDrawer'
import { Tiles } from './Tiles'
import { headerPills } from './derive'
import { meta } from './meta'

export default function MedicalStatusScreen() {
  const profile = useActiveProfile()
  const [openMarkerId, setOpenMarkerId] = useState<string | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  // The sample record belongs to the demo profile. A team member's profile holds only what that
  // person records, so nothing is invented for a real person.
  if (profile.kind === 'member') {
    return (
      <>
        <ScreenHeader eyebrow={meta.eyebrow} title={meta.label} description={meta.description} />
        <EmptyState message="No medical record has been entered for this profile. The demo profile shows a sample record." />
      </>
    )
  }
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
        <Tiles onOpenMarker={setOpenMarkerId} onOpenSchedule={() => setScheduleOpen(true)} />
        <MarkersTable openId={openMarkerId} onOpen={setOpenMarkerId} />
        <AreasTable />
        <RiskCard />
        <PlanCard />
        <ActionsCard />
        <ReadingCard />
        <ScheduleDrawer open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      </div>
    </>
  )
}
