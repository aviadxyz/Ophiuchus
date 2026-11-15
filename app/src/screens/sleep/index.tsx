import { EmptyState, GameLinks, ScreenHeader } from '@/design'
import { meta } from './meta'

export default function SleepScreen() {
  return (
    <>
      <ScreenHeader eyebrow={meta.eyebrow} title={meta.label} description={meta.description} />
      <EmptyState
        message={`${meta.label} is being built by ${meta.owner === 'unassigned' ? 'the team' : meta.owner}.`}
      />
      {/* Shows every mini game whose meta lists this screen. Nothing when there is none. */}
      <GameLinks screenId={meta.id} />
    </>
  )
}
