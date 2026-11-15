import { SectionLabel, StatusPill, type Level } from '@/design'
import { systemStatusLabel, systemStatusTone } from './systemStatus'

export type SystemListItem = {
  id: string
  label: string
  kind: 'organ' | 'whole-body'
  status: Level | 'untracked'
}

export type SystemListProps = {
  systems: SystemListItem[]
  selectedId?: string
  onSelect: (id: string) => void
}

export function SystemList({ systems, selectedId, onSelect }: SystemListProps) {
  const organs = systems.filter((s) => s.kind === 'organ')
  const wholeBody = systems.filter((s) => s.kind === 'whole-body')

  const renderRow = (sys: SystemListItem) => {
    const isSelected = selectedId === sys.id
    const tone = systemStatusTone[sys.status]
    const label = systemStatusLabel[sys.status]

    return (
      <button
        key={sys.id}
        type="button"
        onClick={() => onSelect(sys.id)}
        aria-pressed={isSelected}
        className={[
          'flex w-full min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors',
          isSelected
            ? 'border-border bg-surface-raised text-text font-medium'
            : 'border-border/50 bg-surface text-text hover:border-border hover:bg-surface-raised',
        ].join(' ')}
      >
        <span className="min-w-0 text-base break-words">{sys.label}</span>
        <div className="shrink-0">
          <StatusPill tone={tone} label={label} />
        </div>
      </button>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {/* Organs Section */}
      <div className="flex flex-col gap-2">
        <SectionLabel>ORGANS</SectionLabel>
        <div className="flex flex-col gap-1.5">{organs.map(renderRow)}</div>
      </div>

      {/* Whole Body Section */}
      <div className="flex flex-col gap-2">
        <SectionLabel>WHOLE BODY</SectionLabel>
        <div className="flex flex-col gap-1.5">{wholeBody.map(renderRow)}</div>
      </div>
    </div>
  )
}
