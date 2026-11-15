import { useId, useState } from 'react'
import { Button, Card, SourceLine } from '@/design'
import type { ChatSource } from './sources'

/** Passages shown before "Show all". */
const FIRST_SHOWN = 2

/**
 * The research passages the Med bot was given for its latest reply, with a link to each page.
 * Renders nothing when the reply has none: scripted replies never get an invented source.
 */
export function ResearchSources({ sources }: { sources: readonly ChatSource[] }) {
  const [showAll, setShowAll] = useState(false)
  const listId = useId()
  if (sources.length === 0) return null
  const shown = showAll ? sources : sources.slice(0, FIRST_SHOWN)

  return (
    <Card title="From the team's research">
      <ul id={listId} className="m-0 flex list-none flex-col gap-3 p-0">
        {shown.map((source, index) => (
          <li key={`${source.url}-${index}`} className="min-w-0">
            <p className="m-0 text-base break-words text-text">“{source.quote}”</p>
            <SourceLine text={source.title} href={source.url} />
          </li>
        ))}
      </ul>
      {sources.length > FIRST_SHOWN && !showAll && (
        <div className="mt-3">
          <Button
            variant="quiet"
            size="md"
            aria-expanded={false}
            aria-controls={listId}
            onClick={() => setShowAll(true)}
          >
            Show all
          </Button>
        </div>
      )}
      <p className="m-0 mt-3 text-xs text-text-muted">
        Taken automatically from NASA and Canadian Space Agency pages. Not reviewed by a clinician.
      </p>
    </Card>
  )
}
