import { Card, SourceLine } from '@/design'
import { reading } from './sample'

/** Three references, each linking to the paper or page it names. */
export function ReadingCard() {
  return (
    <Card title="Key reading">
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {reading.map((item) => (
          <li key={item.title} className="rounded-md border border-border bg-bg p-3">
            <p className="m-0 text-base break-words text-text">{item.title}</p>
            <SourceLine
              text={item.href ? (item.linkText ?? 'Open the paper') : ''}
              href={item.href}
            />
          </li>
        ))}
      </ol>
    </Card>
  )
}
