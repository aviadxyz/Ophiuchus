import { EmptyState, ScreenHeader } from '@/design'
import { meta } from './meta'

export default function AboutScreen() {
  return (
    <>
      <ScreenHeader eyebrow={meta.eyebrow} title={meta.label} description={meta.description} />
      <EmptyState
        message={`${meta.label} is being built by ${meta.owner === 'unassigned' ? 'the team' : meta.owner}.`}
      />
    </>
  )
}
