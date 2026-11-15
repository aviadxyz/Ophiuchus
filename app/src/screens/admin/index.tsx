import { useEffect } from 'react'
import { ScreenHeader, type HeaderPill } from '@/design'
import { closeGroundView, useGroundShare, useGroundView } from '@/data'
import { GroundViewCard } from './GroundViewCard'
import { ShareCard } from './ShareCard'
import { meta } from './meta'
import { reportLevel, useClock } from './text'

export default function AdminScreen() {
  const view = useGroundView()
  const share = useGroundShare()
  const now = useClock()

  // Leaving the screen closes the ground view: the code and the reports are forgotten.
  useEffect(() => () => closeGroundView(), [])

  const pills: HeaderPill[] = []
  if (view.state === 'open') {
    const attention = view.reports.filter((r) => {
      const level = reportLevel(r)
      return level === 'act' || level === 'watch'
    }).length
    pills.push({ tone: 'info', label: `${view.reports.length} REPORTING` })
    pills.push({
      tone: attention > 0 ? 'warn' : 'ok',
      label: attention === 1 ? '1 NEEDS ATTENTION' : `${attention} NEED ATTENTION`,
    })
    if (view.mode === 'simulated') pills.push({ tone: 'neutral', label: 'SIMULATED CREW' })
  } else {
    pills.push({
      tone: share.on ? 'ok' : 'neutral',
      label: share.on ? 'MY RECORD SHARED' : 'MY RECORD NOT SHARED',
    })
  }

  return (
    <>
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={pills}
      />
      <div className="flex min-w-0 flex-col gap-6">
        <ShareCard now={now} />
        <GroundViewCard now={now} />
      </div>
    </>
  )
}
