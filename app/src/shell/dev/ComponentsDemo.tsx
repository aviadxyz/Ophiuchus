import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  ChatInput,
  ChatThread,
  ChipGroup,
  ConfirmDialog,
  DataTable,
  DetailDrawer,
  EmptyState,
  NumberField,
  ProgressBar,
  ProgressRing,
  ScreenHeader,
  SectionLabel,
  SourceBadge,
  SourceLine,
  Sparkline,
  StatTile,
  StatusPill,
  Switch,
  TextField,
  TrendChart,
  levelLabel,
  levelTone,
  levels,
  sources,
  tones,
  type ChatMessageView,
} from '@/design'

// Every shared component in every tone, level, source and state. All values are made up for
// display only. Other agents open /dev/components to see what exists.

const LONG =
  'A deliberately long piece of text that keeps going so you can see how this component wraps, truncates or stacks when the words do not fit on one line at phone width.'

const days = [
  'Nov 1',
  'Nov 2',
  'Nov 3',
  'Nov 4',
  'Nov 5',
  'Nov 6',
  'Nov 7',
  'Nov 8',
  'Nov 9',
  'Nov 10',
  'Nov 11',
  'Nov 12',
  'Nov 13',
  'Nov 14',
]

function Section({ name, note, children }: { name: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <div>
        <h2 className="m-0 font-mono text-base font-semibold text-text">{`<${name}>`}</h2>
        {note && <p className="m-0 mt-1 text-sm text-text-muted">{note}</p>}
      </div>
      {children}
    </section>
  )
}

function Gallery() {
  const [drawer, setDrawer] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [confirmed, setConfirmed] = useState(0)
  const [text, setText] = useState('')
  const [num, setNum] = useState<number | null>(72)
  const [tags, setTags] = useState<string[]>(['Calm'])
  const [single, setSingle] = useState<string[]>(['3'])
  const [on, setOn] = useState(true)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessageView[]>([
    {
      id: '1',
      side: 'them',
      text: 'Hello. Ask me anything about the readings on your screens.',
      time: '14:02',
    },
    { id: '2', side: 'me', text: 'Is a resting heart rate of 64 normal for me?', time: '14:03' },
    { id: '3', side: 'them', text: LONG, time: '14:03', note: 'offline reply' },
  ])
  const [clicks, setClicks] = useState(0)

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-8 px-page-phone py-6 sm:px-page">
      <ScreenHeader
        eyebrow="DEV · COMPONENTS"
        title="Shared components"
        description="Everything exported from @/design, in every tone, level, source and state. Build screens from these only."
        pills={[
          { tone: 'ok', label: 'On target' },
          { tone: 'warn', label: '2 to watch' },
          { tone: 'danger', label: '1 to act' },
          { tone: 'info', label: 'Fourth pill is never shown' },
        ]}
      />

      <Section name="ScreenHeader" note="Long text and no pills.">
        <ScreenHeader
          eyebrow="DOMAIN · A VERY LONG EYEBROW THAT KEEPS GOING TO TEST WRAPPING"
          title="A screen title that is much longer than it should be"
          description={LONG}
        />
      </Section>

      <Section name="StatusPill" note="tone: ok, info, warn, danger, neutral.">
        <div className="flex flex-wrap gap-2">
          {tones.map((tone) => (
            <StatusPill key={tone} tone={tone} label={tone} />
          ))}
          {levels.map((level) => (
            <StatusPill key={level} tone={levelTone[level]} label={levelLabel[level]} />
          ))}
          <StatusPill tone="warn" label="A long pill label that has to truncate somewhere" />
        </div>
      </Section>

      <Section name="SourceBadge" note="source: live, entered, imported, simulated.">
        <div className="flex flex-wrap gap-4">
          {sources.map((source) => (
            <SourceBadge key={source} source={source} />
          ))}
        </div>
      </Section>

      <Section
        name="StatTile"
        note="Four across on PC, two on phone. A missing value shows a dash and NO DATA."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Energy"
            value={1840}
            unit="kcal"
            targetText="Target by now 1900 kcal"
            level="ok"
            source="entered"
            trend={[2100, 2050, null, 1980, 1700, 1900, 1840]}
          />
          <StatTile
            label="Water"
            value={1.2}
            unit="L"
            targetText="Target by now 1.8 L"
            level="watch"
            source="imported"
            trend={[2.1, 1.9, 2.0, 1.4, 1.2]}
          />
          <StatTile
            label="Heart rate"
            value={128}
            unit="bpm"
            targetText="Zone 2 under 140 bpm"
            level="act"
            source="live"
            onOpen={() => setDrawer(true)}
          />
          <StatTile
            label="Sleep"
            value={null}
            unit="h"
            targetText="Target 7 to 9 h"
            level="ok"
            source="simulated"
            trend={[null, null, null]}
          />
          <StatTile label={LONG} value={7.5} unit="h" targetText={LONG} level="none" />
          <StatTile label="No level, no source" value="5 of 7" />
        </div>
      </Section>

      <Section
        name="DataTable"
        note="Rows on PC, stacked cards under 640 px. The first column is the row name."
      >
        <DataTable
          columns={['Risk', 'Hazard', 'Likelihood']}
          rows={[
            {
              id: 'a',
              barTone: 'danger',
              cells: ['Bone loss', 'Gravity', 'High'],
              pill: { tone: 'danger', label: 'High' },
              onOpen: () => setDrawer(true),
            },
            {
              id: 'b',
              barTone: 'warn',
              cells: ['Sleep loss', 'Isolation', 'Moderate'],
              pill: { tone: 'warn', label: 'Moderate high' },
              onOpen: () => setDrawer(true),
            },
            {
              id: 'c',
              barTone: 'info',
              cells: ['Radiation dose', 'Radiation', 'Moderate'],
              pill: { tone: 'info', label: 'Moderate' },
            },
            {
              id: 'd',
              barTone: 'ok',
              cells: [LONG, 'Hostile environment', LONG],
              pill: { tone: 'ok', label: 'On target' },
            },
          ]}
        />
        <DataTable
          columns={['Name', 'Value']}
          rows={[]}
          emptyText="No rows yet. This is the empty state."
        />
      </Section>

      <Section name="Card" note="Optional title and footer.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card
            title="With title and footer"
            footer={
              <SourceLine text="NASA Human Research Program" href="https://www.nasa.gov/hrp/" />
            }
          >
            Card content in text secondary.
          </Card>
          <Card>{LONG}</Card>
        </div>
      </Section>

      <Section
        name="Button"
        note="variant: primary, quiet, danger. size: md, lg. Optional icon. Disabled."
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setClicks((c) => c + 1)}>Primary</Button>
          <Button variant="quiet" onClick={() => setClicks((c) => c + 1)}>
            Quiet
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirm(true)}>
            Delete
          </Button>
          <Button size="lg" icon={Plus} onClick={() => setClicks((c) => c + 1)}>
            Large with icon
          </Button>
          <Button icon={Plus} aria-label="Add" onClick={() => setClicks((c) => c + 1)} />
          <Button disabled>Disabled</Button>
          <span className="text-sm text-text-muted">Clicked {clicks} times.</span>
        </div>
      </Section>

      <Section
        name="DetailDrawer"
        note="Right side on PC, bottom sheet on phone. Escape, backdrop or the close button close it."
      >
        <div>
          <Button variant="quiet" onClick={() => setDrawer(true)}>
            Open drawer
          </Button>
        </div>
        <DetailDrawer open={drawer} title="Bone loss" onClose={() => setDrawer(false)}>
          <p className="m-0">{LONG}</p>
          <SourceLine text="" />
        </DetailDrawer>
      </Section>

      <Section name="ConfirmDialog" note="Focus starts on Cancel.">
        <div className="flex items-center gap-3">
          <Button variant="quiet" onClick={() => setConfirm(true)}>
            Open dialog
          </Button>
          <span className="text-sm text-text-muted">Confirmed {confirmed} times.</span>
        </div>
        <ConfirmDialog
          open={confirm}
          title="Delete this entry?"
          message="This removes the entry from this device. It cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirmed((c) => c + 1)
            setConfirm(false)
          }}
          onCancel={() => setConfirm(false)}
        />
      </Section>

      <Section
        name="TextField / NumberField"
        note="label, value, onChange, hint, error; numbers add min, max, unit."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Note"
            value={text}
            onChange={setText}
            hint="Optional. Stays on this device."
          />
          <TextField
            label="Handle"
            value="a"
            onChange={() => {}}
            error="Use 3 to 20 letters, digits or underscores."
          />
          <NumberField
            label="Body mass"
            value={num}
            onChange={setNum}
            min={30}
            max={200}
            step={0.1}
            unit="kg"
            hint={`Value: ${num ?? 'empty'}`}
          />
          <NumberField
            label="Water"
            value={null}
            onChange={() => {}}
            unit="ml"
            error="Enter an amount."
          />
        </div>
      </Section>

      <Section name="ChipGroup" note="multiple or single choice. Selected chips show a check mark.">
        <ChipGroup
          label="Feelings"
          options={['Calm', 'Tired', 'Focused', 'Irritable', 'Homesick']}
          selected={tags}
          onChange={setTags}
          multiple
        />
        <ChipGroup
          label="Score"
          options={[
            { value: '1', label: 'Very low' },
            { value: '2', label: 'Low' },
            { value: '3', label: 'Okay' },
            { value: '4', label: 'Good' },
            { value: '5', label: 'Very good' },
          ]}
          selected={single}
          onChange={setSingle}
        />
      </Section>

      <Section name="ProgressBar" note="value 0 to 1, tone, label.">
        <div className="grid gap-4 sm:grid-cols-2">
          {tones.map((tone, i) => (
            <ProgressBar
              key={tone}
              value={[1, 0.62, 0.45, 0.2, 0][i] ?? 0}
              tone={tone}
              label={`Tone ${tone}`}
            />
          ))}
          <ProgressBar value={1.7} label="Values over 1 are capped" />
        </div>
      </Section>

      <Section name="ProgressRing" note="value 0 to 1, tone, size, content in the middle.">
        <div className="flex flex-wrap items-center gap-4">
          {tones.map((tone, i) => (
            <ProgressRing
              key={tone}
              value={[0.9, 0.6, 0.45, 0.2, 0][i] ?? 0}
              tone={tone}
              size={72}
              label={tone}
            >
              <span className="font-mono text-pill uppercase text-text-secondary">{tone}</span>
            </ProgressRing>
          ))}
          <ProgressRing value={0.75} size={120} label="Hold to send">
            <span className="text-number font-semibold text-text">75%</span>
          </ProgressRing>
        </div>
      </Section>

      <Section name="EmptyState" note="One sentence and, when given, one action.">
        <EmptyState
          message="No meals logged today."
          actionLabel="Add a meal"
          onAction={() => setClicks((c) => c + 1)}
        />
        <EmptyState message={LONG} />
      </Section>

      <Section name="SourceLine" note="Empty text reads to be confirmed.">
        <div>
          <SourceLine
            text="NASA Human Research Program, Risks"
            href="https://www.nasa.gov/hrp/risks/"
          />
          <SourceLine text="" />
          <SourceLine text={LONG} />
        </div>
      </Section>

      <Section name="SectionLabel">
        <SectionLabel>Console</SectionLabel>
      </Section>

      <Section name="Sparkline" note="Gaps for missing days. A lone value between gaps is a dot.">
        <div className="grid max-w-md grid-cols-2 gap-4">
          <Sparkline values={[3, 4, 5, 4, 6, 7, 6]} tone="ok" summary="Rising over a week" />
          <Sparkline values={[3, 4, null, 4, 6, null, 6, 5]} tone="warn" />
          <Sparkline values={[null, null, null]} tone="danger" />
          <Sparkline values={[5]} tone="info" />
        </div>
      </Section>

      <Section
        name="TrendChart"
        note="kind line or bar, gaps allowed, optional target line, summary for screen readers."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Line, two series, target">
            <TrendChart
              kind="line"
              labels={days}
              series={[
                {
                  name: 'Sleep',
                  values: [7.2, 7.5, 6.9, 7.1, 7.4, 7.0, 7.3, 6.8, 5.1, 4.9, null, 6.8, 7.2, 7.4],
                  tone: 'ok',
                },
                {
                  name: 'Mood',
                  values: [4, 4, 4, 5, 4, 4, 4, 4, 3, 2, 3, null, 4, 4],
                  tone: 'info',
                },
              ]}
              targetValue={7}
              summary="Sleep stayed near seven hours except two short nights. Mood dipped on the same days."
            />
          </Card>
          <Card title="Bar, with gaps">
            <TrendChart
              kind="bar"
              labels={days.slice(0, 7)}
              series={[
                {
                  name: 'Exercise minutes',
                  values: [95, 110, null, 120, 60, 0, 105],
                  tone: 'warn',
                },
              ]}
              targetValue={90}
              summary="Exercise minutes over seven days. One day missing."
            />
          </Card>
          <Card title="No data">
            <TrendChart
              kind="line"
              labels={days}
              series={[{ name: 'Empty', values: [], tone: 'neutral' }]}
              summary="No data."
            />
          </Card>
        </div>
      </Section>

      <Section name="Switch" note="Always shows ON or OFF.">
        <div className="flex max-w-md flex-col gap-4">
          <Switch
            label="Share my mood"
            checked={on}
            onChange={setOn}
            hint="Friends see your latest score and up to two feelings."
          />
          <Switch label="Disabled setting" checked={false} onChange={() => {}} disabled />
        </div>
      </Section>

      <Section name="ChatThread / ChatInput" note="Used by Med bot and Social. Enter sends.">
        <div className="flex h-96 max-w-xl flex-col rounded-lg border border-border bg-surface px-3">
          <ChatThread messages={messages} pending={draft.length > 0} emptyText="No messages yet." />
          <ChatInput
            value={draft}
            onChange={setDraft}
            placeholder="Type a message"
            onSend={(t) => {
              setMessages((m) => [
                ...m,
                { id: String(m.length + 1), side: 'me', text: t, time: 'now' },
              ])
              setDraft('')
            }}
          />
        </div>
        <div className="flex h-40 max-w-xl flex-col rounded-lg border border-border bg-surface px-3">
          <ChatThread messages={[]} emptyText="No messages yet. Say hello." />
        </div>
      </Section>

      <Section name="GameLinks" note="Renders nothing when no game lists the screen, as here.">
        <p className="m-0 text-sm text-text-muted">
          No games are registered yet, so this section is empty on purpose.
        </p>
      </Section>
    </div>
  )
}

const widths = [
  { value: '360', label: '360 px' },
  { value: '1440', label: '1440 px' },
]

/** /dev/components. Not in the sidebar. The width toggle loads the gallery in a frame of that width. */
export default function ComponentsDemo() {
  const [params] = useSearchParams()
  const [width, setWidth] = useState('1440')
  if (params.get('frame') === '1') return <Gallery />
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-page-phone py-3 sm:px-page">
        <Link to="/overview" className="text-base text-accent">
          Back to the console
        </Link>
        <span className="flex-1" />
        <span className="font-mono text-label uppercase tracking-wider text-text-muted">Width</span>
        <ChipGroup
          label="Preview width"
          options={widths}
          selected={[width]}
          onChange={(v) => setWidth(v[0] ?? '1440')}
        />
      </header>
      <div className="flex-1 overflow-x-auto">
        <iframe
          key={width}
          title={`Components at ${width} px`}
          src="/dev/components?frame=1"
          className="mx-auto block h-[calc(100dvh-4rem)] border-x border-border bg-bg"
          style={{ width: Number(width) }}
        />
      </div>
    </div>
  )
}
