import { useState } from 'react'
import { ChipGroup, EmptyState, ScreenHeader } from '@/design'
import { useActiveProfile } from '@/data'
import { BriefCard, FactorsCard, PlanCard, ReadingCard } from './Cards'
import { MarkersTable, Tiles } from './Markers'
import { headerPills } from './derive'
import { meta } from './meta'
import { domainOrder, domains, type DomainId } from './sample'

export default function PerformanceScreen() {
  const profile = useActiveProfile()
  const [domainId, setDomainId] = useState<DomainId>('cognitive')
  const [openMarkerId, setOpenMarkerId] = useState<string | null>(null)
  // The sample record belongs to the demo profile. A team member's profile holds only what that
  // person records, so nothing is invented for a real person.
  if (profile.kind === 'member') {
    return (
      <>
        <ScreenHeader eyebrow={meta.eyebrow} title={meta.label} description={meta.description} />
        <EmptyState message="No performance tests have been recorded for this profile. The demo profile shows a sample record." />
      </>
    )
  }
  const domain = domains[domainId]
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
          Sample performance record for demonstration.
        </p>
        <ChipGroup
          label="Which kind of readiness"
          options={domainOrder.map((id) => ({ value: id, label: domains[id].label }))}
          selected={[domainId]}
          onChange={([next]) => {
            if (next === 'cognitive' || next === 'physical') {
              setDomainId(next)
              setOpenMarkerId(null)
            }
          }}
        />
        <BriefCard domain={domain} />
        <Tiles domain={domain} onOpen={setOpenMarkerId} />
        <MarkersTable domain={domain} openId={openMarkerId} onOpen={setOpenMarkerId} />
        <FactorsCard domain={domain} />
        <PlanCard domain={domain} />
        <ReadingCard domain={domain} />
      </div>
    </>
  )
}
