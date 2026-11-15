import { Button, Card, SourceBadge, StatusPill, type Tone } from '@/design'
import type { RoutineItem, RoutineState } from './routine'

export type RoutineCardProps = {
  items: RoutineItem[]
  onAddWater: () => void
  onNavigate: (route: string) => void
}

const routinePillConfig: Record<RoutineState, { tone: Tone; label: string }> = {
  done: { tone: 'ok', label: 'DONE' },
  due: { tone: 'warn', label: 'DUE' },
  'not-planned': { tone: 'neutral', label: 'NOT PLANNED' },
}

export function RoutineCard({ items, onAddWater, onNavigate }: RoutineCardProps) {
  const allDone = items.every((i) => i.state !== 'due')

  return (
    <Card
      title="Today's routine"
      footer="Worked out from what you have logged today. Nothing extra is stored."
    >
      <div className="flex flex-col">
        {allDone && (
          <p className="m-0 mb-3 text-base font-medium text-accent">All done for today.</p>
        )}

        <div className="flex flex-col divide-y divide-border/40">
          {items.map((item) => {
            const pill = routinePillConfig[item.state]
            const isDue = item.state === 'due'

            const handleAction = () => {
              if (item.id === 'water') {
                onAddWater()
              } else if (item.actionRoute) {
                onNavigate(item.actionRoute)
              }
            }

            return (
              <div
                key={item.id}
                className="flex flex-col gap-2.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-medium text-text break-words">
                      {item.label}
                    </span>
                    <StatusPill tone={pill.tone} label={pill.label} />
                  </div>

                  {(item.detail || (item.source && item.state === 'done')) && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                      {item.detail && <span>{item.detail}</span>}
                      {item.source && item.state === 'done' && (
                        <SourceBadge source={item.source} />
                      )}
                    </div>
                  )}
                </div>

                {isDue && item.actionLabel && (
                  <div className="shrink-0 self-start sm:self-center">
                    <Button
                      variant={item.id === 'water' ? 'primary' : 'quiet'}
                      size="md"
                      onClick={handleAction}
                    >
                      {item.actionLabel}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
