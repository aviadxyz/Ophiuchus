import { Card, SourceLine } from '@/design'
import { condition, conditionSource } from './sample'

/** The condition in plain words. One sentence has a checked source; the rest says it has none yet. */
export function ConditionCard() {
  return (
    <Card
      title="Your condition in plain words"
      footer={<SourceLine text={conditionSource.text} href={conditionSource.href} />}
    >
      <h3 className="m-0 text-lg font-semibold text-text">{condition.title}</h3>
      <p className="m-0 mb-4 text-sm text-text-muted">{condition.note}</p>
      <div className="flex max-w-description flex-col gap-3">
        {condition.paragraphs.map((text) => (
          <p key={text} className="m-0">
            {text}
          </p>
        ))}
      </div>
    </Card>
  )
}
