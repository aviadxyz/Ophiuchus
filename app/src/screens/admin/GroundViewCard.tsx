import { useId, useState, type FormEvent } from 'react'
import { KeyRound, Users, X } from 'lucide-react'
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  levelLabel,
  levelTone,
  SourceBadge,
  type DataTableRow,
} from '@/design'
import {
  closeGroundView,
  openGroundView,
  openSimulatedGroundView,
  useGroundView,
  useMission,
} from '@/data'
import { ReportDrawer } from './ReportDrawer'
import { ago, clockTime, delayWords, isLate, OPEN_CONFIRM, reportLevel } from './text'

type Step = 'closed' | 'code'

const ERRORS: Partial<Record<ReturnType<typeof useGroundView>['state'], string>> = {
  'wrong-code': 'That code is not right.',
  'not-set-up':
    'The ground code has not been set on the server yet. You can look at the simulated crew instead.',
  offline: 'The server cannot be reached.',
}

/** "Ground view": for the medical team on Earth. Read only. */
export function GroundViewCard({ now }: { now: number }) {
  const view = useGroundView()
  const [step, setStep] = useState<Step>('closed')
  const [confirming, setConfirming] = useState<'live' | 'simulated' | null>(null)

  const close = () => {
    closeGroundView()
    setStep('closed')
  }

  const open = view.state === 'open'

  return (
    <Card title="Ground view">
      <div className="flex flex-col gap-4">
        <p className="m-0 max-w-description text-base text-text-secondary">
          This part is for the medical team on Earth. It shows the record of each crew member who
          chose to share it, and changes nothing.
        </p>

        {open ? (
          <CrewList now={now} />
        ) : step === 'code' ? (
          <CodeForm
            onCancel={close}
            onSimulated={() => {
              setStep('closed')
              openSimulatedGroundView()
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" icon={KeyRound} onClick={() => setConfirming('live')}>
              Open with the ground code
            </Button>
            <Button variant="quiet" icon={Users} onClick={() => setConfirming('simulated')}>
              Look at the simulated crew
            </Button>
          </div>
        )}

        {open && (
          <div>
            <Button variant="quiet" icon={X} onClick={close}>
              Close the ground view
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title="Open the crew’s records?"
        message={OPEN_CONFIRM}
        confirmLabel="Open the records"
        cancelLabel="Cancel"
        onConfirm={() => {
          const which = confirming
          setConfirming(null)
          if (which === 'live') setStep('code')
          else openSimulatedGroundView()
        }}
        onCancel={() => setConfirming(null)}
      />
    </Card>
  )
}

function CodeForm({ onCancel, onSimulated }: { onCancel: () => void; onSimulated: () => void }) {
  const view = useGroundView()
  const [code, setCode] = useState('')
  const id = useId()
  const checking = view.state === 'checking'
  const error = ERRORS[view.state]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!code.trim() || checking) return
    void openGroundView(code)
    setCode('')
  }

  return (
    <form className="flex max-w-md flex-col gap-3" onSubmit={submit}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-text">
          Ground code
        </label>
        {/* The shared TextField has no password type, so this field uses the same look. */}
        <input
          id={id}
          type="password"
          value={code}
          autoComplete="off"
          onChange={(event) => setCode(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-message` : undefined}
          className={`h-10 w-full min-w-0 rounded-md border bg-bg px-3 text-base text-text transition-colors duration-150 focus-visible:border-accent ${error ? 'border-danger' : 'border-border'}`}
        />
        {error && (
          <p
            id={`${id}-message`}
            role="alert"
            className="m-0 flex items-center gap-1.5 text-xs text-danger"
          >
            <span aria-hidden="true" className="font-mono">
              !
            </span>
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" disabled={!code.trim() || checking}>
          {checking ? 'Checking the code' : 'Open'}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        {view.state === 'not-set-up' && (
          <Button variant="quiet" icon={Users} onClick={onSimulated}>
            Look at the simulated crew
          </Button>
        )}
      </div>
    </form>
  )
}

function CrewList({ now }: { now: number }) {
  const view = useGroundView()
  const mission = useMission()
  const [openId, setOpenId] = useState<string | null>(null)
  const selected = view.reports.find((r) => r.reportId === openId) ?? null

  const rows: DataTableRow[] = view.reports.map((report) => {
    const level = reportLevel(report)
    const openAlerts = report.alerts.filter((a) => a.status === 'open').length
    const late = isLate(report.sentAt, now)
    return {
      id: report.reportId,
      barTone: levelTone[level],
      pill: { tone: levelTone[level], label: levelLabel[level] },
      onOpen: () => setOpenId(report.reportId),
      cells: [
        <span key="name" className="flex flex-wrap items-center gap-2">
          <span className="break-words">{report.displayName}</span>
          {report.kind === 'demo' && <SourceBadge source="simulated" />}
        </span>,
        report.role,
        openAlerts === 0 ? 'None open' : `${openAlerts} open`,
        <span key="sent" className="flex flex-col">
          <span>
            Sent {clockTime(report.sentAt, now)} · {ago(report.sentAt, now)}
          </span>
          {late && <span className="text-text-muted">No newer report has arrived</span>}
        </span>,
      ],
    }
  })

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {view.mode === 'simulated' && (
        <p className="m-0 flex flex-wrap items-center gap-2 text-base text-text">
          <SourceBadge source="simulated" />
          Every person in this list is simulated. None of it is a real crew member’s record.
        </p>
      )}
      <p className="m-0 text-sm text-text-secondary">
        Signal delay on this mission: {delayWords(mission.commDelaySeconds)}. A report is at least
        that old when it arrives.
        {view.fetchedAt &&
          ` List fetched at ${clockTime(view.fetchedAt, now)}${view.mode === 'live' ? ', checked again every 30 seconds' : ''}.`}
      </p>
      {rows.length === 0 ? (
        <EmptyState message="No crew member is sharing a record yet. Each person chooses for themselves in the card above, on their own device." />
      ) : (
        <DataTable columns={['Crew member', 'Role', 'Alerts', 'Report']} rows={rows} />
      )}
      <ReportDrawer report={selected} now={now} onClose={() => setOpenId(null)} />
    </div>
  )
}
