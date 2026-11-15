import { useState } from 'react'
import { Card, DataTable, DetailDrawer, StatusPill, type DataTableRow } from '@/design'
import { areas, capsuleExam } from './sample'

/** The four active areas of the bowel. A row opens its finding. */
export function AreasTable() {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = areas.find((a) => a.id === openId)

  const rows: DataTableRow[] = areas.map((area) => ({
    id: area.id,
    barTone: area.tone,
    cells: [
      <span key="area" className="flex flex-col">
        <span>{area.plainName}</span>
        {area.technicalName !== area.plainName && (
          <span className="text-xs font-normal text-text-muted">{area.technicalName}</span>
        )}
      </span>,
      area.finding,
    ],
    pill: { tone: area.tone, label: area.pill },
    onOpen: () => setOpenId(area.id),
  }))

  return (
    <Card
      title="Where it is active"
      footer={`From the last camera-capsule exam, ${capsuleExam.daysAgo} days ago.`}
    >
      <DataTable columns={['Area', 'Finding']} rows={rows} />
      <DetailDrawer
        open={open !== undefined}
        title={open?.plainName ?? ''}
        onClose={() => setOpenId(null)}
      >
        {open && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusPill tone={open.tone} label={open.pill} />
              {open.technicalName !== open.plainName && (
                <span className="text-xs text-text-muted">{open.technicalName}</span>
              )}
            </div>
            <p className="m-0 text-base text-text-secondary">{open.finding}</p>
          </div>
        )}
      </DetailDrawer>
    </Card>
  )
}
