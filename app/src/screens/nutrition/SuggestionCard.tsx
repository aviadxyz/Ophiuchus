import { Card, SourceLine } from '@/design'
import { useFoods, useHealthSummary, useTargets, useToday } from '@/data'
import { suggestionFor } from './suggestion'

/** One suggestion, from the first of five simple rules that applies. */
export function SuggestionCard() {
  const today = useToday()
  const targets = useTargets()
  const foods = useFoods()
  // The summary carries the current time, refreshed every minute.
  const now = new Date(useHealthSummary().updatedAt)
  const { text } = suggestionFor({ today, targets, foods, now })
  const used = [targets.energyKcal, targets.waterMl, targets.sodiumMg, targets.vitaminDIu]
  const sourceText = used.every((t) => t.verified)
    ? [...new Set(used.map((t) => t.sourceText))].join('; ')
    : ''
  return (
    <Card title="Suggestion" footer={<SourceLine text={sourceText} />}>
      <p className="m-0 max-w-description text-base text-text">{text}</p>
    </Card>
  )
}
