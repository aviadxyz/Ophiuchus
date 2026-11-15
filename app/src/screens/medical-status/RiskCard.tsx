import { Card, StatusPill } from '@/design'
import { riskFactors } from './sample'

/** What makes a flare-up more likely, in plain sentences with the technical term underneath. */
export function RiskCard() {
  return (
    <Card title="What makes a flare-up more likely for you">
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {riskFactors.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="m-0 text-base text-text">{item.sentence}</p>
              <p className="m-0 text-xs text-text-muted">{item.technical}</p>
            </div>
            <div className="shrink-0">
              <StatusPill tone={item.tag === 'HIGHER' ? 'danger' : 'warn'} label={item.tag} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
