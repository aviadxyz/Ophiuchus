import { Card, SourceLine } from '@/design'
import { reading } from './sample'

/** Three references. None is checked yet, so each says "Source: to be confirmed" and has no link. */
export function ReadingCard() {
  return (
    <Card title="Key reading">
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {reading.map((title) => (
          <li key={title} className="rounded-md border border-border bg-bg p-3">
            <p className="m-0 text-base break-words text-text">{title}</p>
            <SourceLine text="" />
          </li>
        ))}
      </ol>
    </Card>
  )
}
