import { useState } from 'react'
import {
  DataTable,
  ScreenHeader,
  levelTone,
  type DataTableRow,
  type HeaderPill,
  type Tone,
} from '@/design'
import { SystemDrawer } from './SystemDrawer'
import { formatReading, signsFor, statusLabel, useReadings, type SystemSigns } from './readings'
import { meta } from './meta'
import { riskSystems, type RiskSystem } from './systems'

const DESCRIPTION =
  'What spaceflight does to each part of the body, the signs you are showing today, and what is done about it.'
const RESEARCH_NOTE =
  'Research gathered by the team from NASA and Canadian Space Agency pages. It has not been reviewed by a clinician.'

const statusTone = (status: SystemSigns['status']): Tone =>
  status === 'untracked' ? 'neutral' : levelTone[status]

function signsText({ status, readings, offTarget }: SystemSigns): string {
  if (status === 'untracked') return 'This app has no reading for this system.'
  if (status === 'watch' || status === 'act') {
    return offTarget.map((reading) => `${reading.label} ${formatReading(reading)}`).join('; ')
  }
  if (status === 'ok') return 'All readings on target.'
  const missing = readings.filter((reading) => reading.hasStatus && reading.value === null)
  return `No data yet: ${missing.map((reading) => reading.label).join(', ')}.`
}

const risksText = (system: RiskSystem) =>
  system.emptyNote ? 'Nothing in the research yet.' : system.majorRisks.join(', ')

export default function RisksScreen() {
  const readings = useReadings()
  const [openId, setOpenId] = useState<string | null>(null)

  const signs = new Map(riskSystems.map((system) => [system.id, signsFor(system, readings)]))
  const toWatch = [...signs.values()].filter((s) => s.status === 'watch' || s.status === 'act')
  const anyAct = toWatch.some((s) => s.status === 'act')

  const pills: HeaderPill[] = [
    {
      tone: anyAct ? 'danger' : toWatch.length > 0 ? 'warn' : 'neutral',
      label: `${toWatch.length} TO WATCH`,
    },
    { tone: 'neutral', label: 'DRAFT RESEARCH' },
  ]

  const rows: DataTableRow[] = riskSystems.map((system) => {
    const own = signs.get(system.id)!
    return {
      id: system.id,
      barTone: statusTone(own.status),
      cells: [system.label, risksText(system), signsText(own)],
      pill: { tone: statusTone(own.status), label: statusLabel[own.status] },
      onOpen: () => setOpenId(system.id),
    }
  })

  const open = riskSystems.find((system) => system.id === openId) ?? null

  return (
    <>
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={DESCRIPTION}
        pills={pills}
      />
      <p className="m-0 mb-4 max-w-description text-sm text-text-muted break-words">
        {RESEARCH_NOTE}
      </p>
      <DataTable columns={['System', 'Major risks', 'Your signs today']} rows={rows} />
      <SystemDrawer
        system={open}
        signs={open ? (signs.get(open.id) ?? null) : null}
        onClose={() => setOpenId(null)}
      />
    </>
  )
}
