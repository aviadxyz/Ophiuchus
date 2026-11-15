import { Card } from '@/design'
import { plan } from './sample'

/** The plan agreed with the flight surgeon: names only, never amounts. */
export function PlanCard() {
  return (
    <Card title="Plan agreed with the flight surgeon">
      <dl className="m-0 flex flex-col gap-3">
        {plan.map((line) => (
          <div key={line.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
            <dt className="font-mono text-label uppercase tracking-wider text-text-muted sm:w-56 sm:shrink-0">
              {line.label}
            </dt>
            <dd className="m-0 min-w-0 text-base text-text">{line.text}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
