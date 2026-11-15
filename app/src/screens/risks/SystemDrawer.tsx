import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { askMedbot } from '@/ophi'
import {
  Button,
  DetailDrawer,
  SectionLabel,
  SourceBadge,
  SourceLine,
  StatusPill,
  levelLabel,
  levelTone,
} from '@/design'
import { formatReading, type Reading, type SystemSigns } from './readings'
import type { RiskSystem } from './systems'

export type SystemDrawerProps = {
  system: RiskSystem | null
  signs: SystemSigns | null
  onClose: () => void
}

const NOT_TRACKED = 'This app does not track a reading for this system.'
const SURGEON_LINE = 'If this stays off target, raise it with the flight surgeon.'

export function SystemDrawer({ system, signs, onClose }: SystemDrawerProps) {
  return (
    <DetailDrawer open={system !== null} title={system?.label ?? ''} onClose={onClose}>
      {system && signs && <DrawerBody system={system} signs={signs} />}
    </DetailDrawer>
  )
}

function DrawerBody({ system, signs }: { system: RiskSystem; signs: SystemSigns }) {
  const needsAction = signs.readings.some((reading) => reading.level === 'act')
  return (
    <div className="flex flex-col gap-6">
      <Section title="What this system does">
        <p className="m-0 text-base text-text break-words">{system.whatItDoes}</p>
        <p className="m-0 text-xs text-text-muted">
          Written by the team, not taken from the research.
        </p>
      </Section>

      <Section title="What spaceflight does to it">
        {system.emptyNote ? (
          <p className="m-0 text-base break-words">{system.emptyNote}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {system.risks.map((risk) => (
              <li key={risk.researchId} className="min-w-0">
                <span className="text-base font-semibold break-words text-text">{risk.name}</span>
                {risk.text && <p className="m-0 mt-0.5 text-sm break-words">{risk.text}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Your signs today">
        {signs.readings.length === 0 ? (
          <p className="m-0 text-base break-words">{NOT_TRACKED}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {signs.readings.map((reading) => (
              <ReadingRow key={reading.id} reading={reading} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="What is done about it">
        {system.countermeasures.length === 0 ? (
          <p className="m-0 text-base break-words">{system.countermeasuresNote}</p>
        ) : (
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
            {system.countermeasures.map((item) => (
              <li key={item.researchId} className="text-base break-words">
                {item.name}
                {item.status === 'studied' && (
                  <span className="text-text-muted"> (being studied)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Evidence">
        {system.evidence.length === 0 ? (
          <p className="m-0 text-base break-words">No quotes from the research for this system.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {system.evidence.map((quote) => (
              <li key={quote.id} className="min-w-0">
                <blockquote className="m-0 text-sm break-words text-text">
                  {`“${quote.text}”`}
                </blockquote>
                <SourceLine text={quote.sourceTitle} href={quote.sourceUrl} />
                <p className="m-0 text-xs break-all text-text-muted">{quote.sourceUrl}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="flex flex-col items-start gap-2">
        {needsAction && <p className="m-0 text-base text-text">{SURGEON_LINE}</p>}
        <Button variant="quiet" onClick={() => askMedbot('risks')}>
          Ask the Med bot about this
        </Button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel as="h3">{title}</SectionLabel>
      {children}
    </section>
  )
}

function ReadingRow({ reading }: { reading: Reading }) {
  return (
    <li className="flex min-w-0 flex-col gap-1 border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-base font-semibold break-words text-text">
          {reading.label}
        </span>
        {reading.hasStatus ? (
          <StatusPill tone={levelTone[reading.level]} label={levelLabel[reading.level]} />
        ) : (
          <span className="text-xs text-text-muted">No status for this reading</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base text-text">{formatReading(reading)}</span>
        {reading.source && <SourceBadge source={reading.source} />}
      </div>
      {reading.targetText && (
        <>
          <p className="m-0 text-sm">Target: {reading.targetText}</p>
          <SourceLine text={reading.sourceText} href={reading.sourceUrl} />
        </>
      )}
      {reading.loggedAt && (
        <Link
          to={reading.loggedAt.path}
          className="w-fit text-xs text-text-secondary underline decoration-border underline-offset-2 hover:text-text"
        >
          Log it in {reading.loggedAt.label}
        </Link>
      )}
    </li>
  )
}
