import { useNavigate } from 'react-router'
import { Button, Card, SourceLine, StatusPill, type Tone } from '@/design'
import { askMedbot } from '@/ophi'
import { NEXT_TEST_IN_DAYS, type Domain, type Factor, type StepButton } from './sample'

/** What is measured and why, with the source that was checked and what still has none. */
export function BriefCard({ domain }: { domain: Domain }) {
  return (
    <Card
      title="What this measures"
      footer={<SourceLine text={domain.briefSource.text} href={domain.briefSource.href} />}
    >
      <div className="flex max-w-description flex-col gap-3">
        {domain.brief.map((text) => (
          <p key={text} className="m-0">
            {text}
          </p>
        ))}
        <p className="m-0 text-sm text-text-muted">
          Tests are weekly. The next one is due in {NEXT_TEST_IN_DAYS} days.
        </p>
      </div>
    </Card>
  )
}

const factorTone: Record<Factor['tag'], Tone> = {
  HIGHER: 'danger',
  WATCH: 'warn',
  BASELINE: 'neutral',
}

/** What moves this domain for this person, in plain sentences with the technical term under it. */
export function FactorsCard({ domain }: { domain: Domain }) {
  return (
    <Card title="What moves this for you">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {domain.factors.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="m-0 text-base text-text">{item.sentence}</p>
              <p className="m-0 text-xs text-text-muted">{item.technical}</p>
            </div>
            <div className="shrink-0">
              <StatusPill tone={factorTone[item.tag]} label={item.tag} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

const links: Record<Exclude<StepButton, 'medbot'>, { label: string; to: string }> = {
  'physical-activity': { label: 'Open Physical activity', to: '/physical-activity' },
  nutrition: { label: 'Open Nutrition', to: '/nutrition' },
  sleep: { label: 'Open Sleep', to: '/sleep' },
}

function StepAction({ button }: { button: StepButton }) {
  const navigate = useNavigate()
  if (button === 'medbot') {
    return <Button onClick={() => askMedbot('performance')}>Ask the Med bot about this</Button>
  }
  const link = links[button]
  return (
    <Button variant="quiet" onClick={() => navigate(link.to)}>
      {link.label}
    </Button>
  )
}

/** The plan agreed with the flight surgeon, in order. Buttons sit under the step they belong to. */
export function PlanCard({ domain }: { domain: Domain }) {
  return (
    <Card title="Plan agreed with the flight surgeon">
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {domain.steps.map((step, index) => (
          <li key={step.id} className="flex gap-3 rounded-md border border-border bg-bg p-3">
            <span
              aria-hidden="true"
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border font-mono text-sm text-text-secondary"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="m-0 text-base text-text">
                <span className="sr-only">Step {index + 1}. </span>
                {step.text}
              </p>
              <div>
                <StatusPill tone={step.tag === 'THIS WEEK' ? 'warn' : 'neutral'} label={step.tag} />
              </div>
              {step.button && (
                <div>
                  <StepAction button={step.button} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/** The references. One with a checked address links to it; one without says so. */
export function ReadingCard({ domain }: { domain: Domain }) {
  return (
    <Card title="Key reading">
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {domain.reading.map((item) => (
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
