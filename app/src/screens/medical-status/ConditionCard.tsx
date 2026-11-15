import { Card, SourceLine } from '@/design'
import { condition } from './sample'

/** The condition in plain words, with a source line that is still to be confirmed. */
export function ConditionCard() {
  return (
    <Card title="Your condition in plain words" footer={<SourceLine text="" />}>
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
