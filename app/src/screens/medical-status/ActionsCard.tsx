import { useNavigate } from 'react-router'
import { Button, Card, StatusPill, type Tone } from '@/design'
import { askMedbot } from '@/ophi'
import { visibleActions } from './derive'
import type { ActionButton, ActionItem } from './sample'

const tagTone: Record<ActionItem['tag'], Tone> = {
  DAILY: 'neutral',
  'EVERY 14 DAYS': 'neutral',
  'THIS WEEK': 'warn',
  'RIGHT AWAY': 'danger',
}

/** The next steps, in order. Buttons sit under the item they belong to. */
export function ActionsCard() {
  const navigate = useNavigate()
  const items = visibleActions()

  const button = (kind: ActionButton) => {
    switch (kind) {
      case 'medbot':
        return (
          <Button onClick={() => askMedbot('medical-status')}>Ask the Med bot about this</Button>
        )
      case 'nutrition':
        return (
          <Button variant="quiet" onClick={() => navigate('/nutrition')}>
            Open Nutrition
          </Button>
        )
      case 'emergency':
        return (
          <Button variant="quiet" onClick={() => navigate('/emergency')}>
            Open Emergency
          </Button>
        )
    }
  }

  return (
    <Card title="What to do">
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 rounded-md border border-border bg-bg p-3">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-mono text-sm text-text-secondary"
            >
              {item.number}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="m-0 text-base text-text">
                <span className="sr-only">Step {item.number}. </span>
                {item.text}
              </p>
              <div>
                <StatusPill tone={tagTone[item.tag]} label={item.tag} />
              </div>
              {item.button && <div>{button(item.button)}</div>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
