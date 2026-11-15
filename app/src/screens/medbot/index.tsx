import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Stethoscope, X } from 'lucide-react'
import {
  Button,
  Card,
  ChatInput,
  ChatThread,
  EmptyState,
  ScreenHeader,
  StatusPill,
  TextField,
} from '@/design'
import type { ChatMessageView, HeaderPill, Level } from '@/design'
import {
  cancelAlert,
  raiseAlert,
  useActiveProfile,
  useAlerts,
  useExerciseSessions,
  useHealthSummary,
  useLatestVitals,
  useMission,
  useMoodCheckins,
  useSeries,
  useSleep,
  useTargets,
  useToday,
  addDays,
} from '@/data'
import { config } from '@/config'
import { getScreen } from '@/registry'
import { meta } from './meta'
import { isForwardingText, isUrgentText } from './words'
import { buildChatContext, formatDelay } from './context'
import { medicalRecordFor } from './medicalRecord'
import { getOpeningLine, getScriptedReply, UNWELL_QUESTION } from './scriptedReplies'
import { OutOfBalanceCard } from './OutOfBalanceCard'
import { ResearchSources } from './ResearchSources'
import { readSources, type ChatSource } from './sources'

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatAlertTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

/**
 * The conversation belongs to one profile. Keying the screen by the profile id throws the whole
 * conversation away the moment another profile becomes active, so nothing one person asked or was
 * told is ever shown to, or sent for, another.
 */
export default function MedbotScreen() {
  const profile = useActiveProfile()
  return <MedbotConversation key={profile.id} />
}

function MedbotConversation() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromParam = searchParams.get('from')

  // Screen registry resolution
  const arrivingScreen = useMemo(
    () => (fromParam ? getScreen(fromParam) : undefined),
    [fromParam],
  )
  const initialScreenLabel = arrivingScreen?.label ?? meta.label

  // Data store hooks
  const profile = useActiveProfile()
  const mission = useMission()
  const today = useToday()
  const targets = useTargets()
  const healthSummary = useHealthSummary()
  const allAlerts = useAlerts()
  const sleepRecords = useSleep(7)
  const moodCheckins = useMoodCheckins(7)
  const exerciseSessions = useExerciseSessions(today.date, today.date)
  // This profile's own history, for the Med bot. Every hook reads the active profile only.
  const weekSessions = useExerciseSessions(addDays(today.date, -6), today.date)
  const sleepSeries = useSeries('sleepHours', 14)
  const energySeries = useSeries('energyKcal', 14)
  const waterSeries = useSeries('waterMl', 14)
  const proteinSeries = useSeries('proteinG', 14)
  const exerciseSeries = useSeries('exerciseMinutes', 14)
  const moodSeries = useSeries('moodScore', 14)
  const massSeries = useSeries('bodyMassKg', 14)
  const { latest: latestVitals } = useLatestVitals()

  // Comms delay
  const commDelaySeconds = mission.commDelaySeconds
  const delayDisplay = useMemo(() => formatDelay(commDelaySeconds), [commDelaySeconds])

  // Context chip dismiss state
  const [contextDismissed, setContextDismissed] = useState(false)
  const activeScreenLabel = contextDismissed || !arrivingScreen ? meta.label : arrivingScreen.label
  const activeScreenId = contextDismissed || !arrivingScreen ? meta.id : arrivingScreen.id

  // Initial arrival opening bubble
  const initialLine = useMemo(() => getOpeningLine(fromParam), [fromParam])

  // Messages state
  const [messages, setMessages] = useState<ChatMessageView[]>(() => [
    {
      id: 'opening',
      side: 'them',
      text: initialLine,
      time: formatTime(new Date()),
    },
  ])

  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [lastCallOk, setLastCallOk] = useState<boolean | null>(null)

  // Safety & triage states for current interaction
  const [urgentDetected, setUrgentDetected] = useState(false)
  const [showForwardCard, setShowForwardCard] = useState(false)
  const [forwardSummary, setForwardSummary] = useState('')
  const [latestQuestion, setLatestQuestion] = useState('')
  const [hasForwardedLatest, setHasForwardedLatest] = useState(false)
  // The research passages behind the latest reply, keyed by that reply's id. Empty for scripted replies.
  const [latestSources, setLatestSources] = useState<{ replyId: string; sources: ChatSource[] }>({
    replyId: '',
    sources: [],
  })

  // Connection status pill: ONLINE if config.chatUrl is set and last call did not fail; otherwise OFFLINE
  const isOnline = Boolean(config.chatUrl) && lastCallOk !== false

  // Alerts sent from Med bot
  const sentAlerts = useMemo(
    () => allAlerts.filter((a) => a.kind === 'health' && a.screenId === 'medbot'),
    [allAlerts],
  )
  const openSentCount = useMemo(
    () => sentAlerts.filter((a) => a.status === 'open').length,
    [sentAlerts],
  )

  // Header pills
  const headerPills: HeaderPill[] = useMemo(() => {
    const list: HeaderPill[] = [
      isOnline
        ? { label: 'ONLINE', tone: 'ok' }
        : { label: 'OFFLINE', tone: 'neutral' },
    ]
    if (openSentCount > 0) {
      list.push({
        label: `${openSentCount} SENT TO SURGEON`,
        tone: 'info',
      })
    }
    return list
  }, [isOnline, openSentCount])

  // Suggested questions based on worst level from health summary
  const suggestedQuestions = useMemo(() => {
    const areas: Array<{ name: string; level: Level; question: string }> = [
      { name: 'sleep', level: healthSummary.sleep.level, question: 'How did I sleep this week?' },
      { name: 'food', level: healthSummary.food.level, question: 'How am I doing on food today?' },
      { name: 'water', level: healthSummary.water.level, question: 'How much water should I drink today?' },
      { name: 'exercise', level: healthSummary.exercise.level, question: 'What exercise should I do today?' },
      { name: 'mood', level: healthSummary.mood.level, question: 'How has my mood been lately?' },
    ]
    const priority: Record<Level, number> = { act: 3, watch: 2, ok: 1, none: 0 }
    let worst = areas[0]
    for (const a of areas) {
      if (priority[a.level] > priority[worst.level]) {
        worst = a
      }
    }
    return [
      UNWELL_QUESTION,
      worst.question,
      'How am I doing today?',
      'What should I do next?',
    ]
  }, [healthSummary])

  const nextId = useRef(1)

  // Send message handler
  const handleSend = async (textToSend: string) => {
    const text = textToSend.trim()
    if (!text || pending) return

    const sendTime = formatTime(new Date())
    const userMsg: ChatMessageView = {
      id: `user-${nextId.current++}`,
      side: 'me',
      text,
      time: sendTime,
    }

    setMessages((prev) => [...prev, userMsg])
    setDraft('')
    setLatestQuestion(text)
    setHasForwardedLatest(false)
    setLatestSources({ replyId: '', sources: [] })

    // Check urgency directly on input text
    const urgentDirect = isUrgentText(text)
    if (urgentDirect) {
      setUrgentDetected(true)
      setShowForwardCard(false)
    }

    setPending(true)

    // Remaining exercise minutes calculation
    const doneMinutes = exerciseSessions
      .filter((s) => s.status === 'done' || s.status === 'changed')
      .reduce((sum, s) => sum + s.actualMinutes, 0)
    const targetExMinutes = Math.round(targets.exerciseMinutes.value)
    const remainingEx = Math.max(0, targetExMinutes - doneMinutes)

    const base = config.chatUrl
    const endpoint = base ? (base.endsWith('/api/chat') ? base : `${base}/api/chat`) : ''

    // Helper to generate offline fallback
    const applyOfflineFallback = () => {
      const replyText = getScriptedReply(text, {
        summary: healthSummary,
        today,
        targets,
        remainingExerciseMinutes: remainingEx,
        now: new Date(),
      })
      const forwardOffline = !urgentDirect && isForwardingText(text)

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${nextId.current++}`,
          side: 'them',
          text: replyText,
          time: formatTime(new Date()),
          note: 'offline',
        },
      ])
      setPending(false)

      if (urgentDirect) {
        setUrgentDetected(true)
        setShowForwardCard(false)
      } else if (forwardOffline) {
        setShowForwardCard(true)
        setForwardSummary(text.slice(0, 200))
        setUrgentDetected(false)
      } else {
        setShowForwardCard(false)
        setUrgentDetected(false)
      }
    }

    // If no endpoint configured, answer immediately from offline fallback
    if (!endpoint) {
      applyOfflineFallback()
      return
    }

    // Call chat endpoint
    const contextBlock = buildChatContext({
      screenLabel: activeScreenLabel,
      mission,
      profile,
      today,
      targets,
      sleepRecords,
      moodCheckins,
      exerciseSessions,
      latestVitals,
      alerts: allAlerts,
      replyMode: 'standard',
      basics: {
        role: profile.role,
        sex: profile.sex,
        birthYear: profile.birthYear,
        heightCm: profile.heightCm,
        massKg: profile.massKg,
      },
      history: {
        sleepHours: sleepSeries,
        energyKcal: energySeries,
        waterMl: waterSeries,
        proteinG: proteinSeries,
        exerciseMinutes: exerciseSeries,
        moodScore: moodSeries,
        bodyMassKg: massSeries,
      },
      weekSessions,
      medicalRecord: medicalRecordFor(profile),
    })

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          screenId: activeScreenId,
          screenLabel: activeScreenLabel,
          context: contextBlock,
          replyMode: 'standard',
        }),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!response.ok) throw new Error(`Chat endpoint status ${response.status}`)
      const data = (await response.json()) as {
        reply?: string
        urgent?: boolean | string
        forward?: boolean | string
        sources?: unknown
      }

      setLastCallOk(true)
      const replyStr = data.reply ?? ''
      const isUrgent =
        urgentDirect ||
        data.urgent === true ||
        data.urgent === 'yes'

      const isForward =
        !isUrgent &&
        (data.forward === true ||
          data.forward === 'yes' ||
          replyStr.includes('This is one for the flight surgeon.'))

      const replyId = `assistant-${nextId.current++}`
      // An urgent reply shows no sources: nothing competes with the Emergency card.
      setLatestSources({ replyId, sources: isUrgent ? [] : readSources(data.sources) })
      setMessages((prev) => [
        ...prev,
        {
          id: replyId,
          side: 'them',
          text: replyStr,
          time: formatTime(new Date()),
          note: !profile.consent.assistant
            ? 'The Med bot is answering in general terms. Turn on personalized answers in About.'
            : undefined,
        },
      ])
      setPending(false)

      if (isUrgent) {
        setUrgentDetected(true)
        setShowForwardCard(false)
      } else if (isForward) {
        setShowForwardCard(true)
        setForwardSummary(text.slice(0, 200))
        setUrgentDetected(false)
      } else {
        setShowForwardCard(false)
        setUrgentDetected(false)
      }
    } catch {
      setLastCallOk(false)
      applyOfflineFallback()
    }
  }

  // Clear conversation handler
  const handleClear = () => {
    setMessages([
      {
        id: `opening-${nextId.current++}`,
        side: 'them',
        text: initialLine,
        time: formatTime(new Date()),
      },
    ])
    setDraft('')
    setUrgentDetected(false)
    setShowForwardCard(false)
    setForwardSummary('')
    setLatestQuestion('')
    setHasForwardedLatest(false)
    setLatestSources({ replyId: '', sources: [] })
  }

  // Forwarding alert submission
  const handleSendToSurgeon = () => {
    const summary = forwardSummary.trim()
    if (!summary) return
    raiseAlert('health', 'console', summary, 'medbot')
    setShowForwardCard(false)
    setHasForwardedLatest(true)
  }

  // Whether at least one user question has received an assistant reply
  const hasAssistantReply = messages.some((m) => m.side === 'them' && m.id !== 'opening')

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeader
        eyebrow={meta.eyebrow}
        title={meta.label}
        description={meta.description}
        pills={headerPills}
      />

      {/* What is off target today, kept outside the fixed-height chat column */}
      <OutOfBalanceCard />

      {/* Main Conversation Box with Fixed Height (CONTRACTS & /dev/components) */}
      <section
        aria-label="Med bot conversation"
        className="flex h-[36rem] max-w-full flex-col rounded-lg border border-border bg-surface px-3 py-2"
      >
        {/* Header bar: Icon + Med bot title + Clear conversation button */}
        <div className="flex items-center justify-between border-b border-border pb-2 pt-1 px-1">
          <div className="flex items-center gap-2">
            <Stethoscope className="size-4 text-accent" aria-hidden="true" />
            <span className="font-semibold text-text">Med bot</span>
          </div>
          <Button variant="quiet" size="md" onClick={handleClear}>
            Clear conversation
          </Button>
        </div>

        {/* Arrival context chip (if arrived from another screen and not dismissed) */}
        {!contextDismissed && arrivingScreen && (
          <div className="flex items-center px-1 pt-2">
            <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 py-1 text-sm text-text-secondary">
              <span className="truncate">Talking about: {initialScreenLabel}</span>
              <button
                type="button"
                aria-label="Dismiss context"
                onClick={() => setContextDismissed(true)}
                className="ml-1 shrink-0 cursor-pointer text-text-muted hover:text-text"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* Emergency Card: Prominent card above the reply */}
        {urgentDetected && (
          <div className="my-2">
            <Card title="Medical emergency">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 text-base text-text-secondary">
                  If you or a crewmate need immediate medical help, open Emergency now.
                </p>
                <Button variant="danger" size="md" onClick={() => navigate('/emergency')}>
                  Open Emergency
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Scrolling Chat Thread */}
        <ChatThread
          messages={messages}
          pending={pending}
          emptyText="No messages yet. Ask the Med bot a question."
        />

        {/* Quiet button under assistant reply when not urgent, not currently showing forward card, and not yet forwarded */}
        {!urgentDetected && !showForwardCard && hasAssistantReply && !hasForwardedLatest && (
          <div className="flex justify-start py-1 px-1">
            <Button
              variant="quiet"
              size="md"
              onClick={() => {
                setForwardSummary(latestQuestion.slice(0, 200))
                setShowForwardCard(true)
              }}
            >
              Send this to the flight surgeon
            </Button>
          </div>
        )}

        {/* Suggested questions chips */}
        <div className="flex flex-wrap gap-2 py-2 px-1" aria-label="Suggested questions">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              type="button"
              disabled={pending}
              onClick={() => handleSend(q)}
              className="inline-flex min-h-8 max-w-full cursor-pointer items-center rounded-full border border-border bg-surface-raised px-3 text-xs text-text-secondary transition-colors duration-150 hover:border-accent hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="truncate">{q}</span>
            </button>
          ))}
        </div>

        {/* Input area */}
        <ChatInput
          value={draft}
          onChange={setDraft}
          onSend={(val) => handleSend(val)}
          disabled={pending}
          maxLength={1000}
          placeholder="Ask a health question"
        />

        {/* Standing disclaimer line */}
        <p className="m-0 py-1 text-center font-sans text-xs text-text-muted">
          Demo assistant. Not medical advice.
        </p>
      </section>

      {/* Research passages behind the latest reply, under the conversation so the thread keeps its height */}
      <ResearchSources key={latestSources.replyId} sources={latestSources.sources} />

      {/* Flight surgeon forwarding card, under the conversation so the thread keeps its height */}
      {!urgentDetected && showForwardCard && (
        <Card title="This is one for the flight surgeon">
          <div className="flex flex-col gap-3">
            <TextField
              label="Summary"
              value={forwardSummary}
              onChange={setForwardSummary}
              maxLength={200}
            />
            <div className="flex justify-end gap-2">
              <Button variant="quiet" size="md" onClick={() => setShowForwardCard(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!forwardSummary.trim()}
                onClick={handleSendToSurgeon}
              >
                Send to flight surgeon
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Sent to Flight Surgeon List Card */}
      <Card title="Sent to flight surgeon">
        {commDelaySeconds > 0 && (
          <p className="m-0 mb-3 text-sm text-text-secondary">
            A signal to Earth takes about {delayDisplay} each way from here.
          </p>
        )}

        {sentAlerts.length === 0 ? (
          <EmptyState message="Nothing sent yet. The Med bot will suggest it when a question needs a person." />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {sentAlerts.map((alert) => (
              <div key={alert.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-mono text-xs text-text-muted">
                    {formatAlertTime(alert.at)}
                  </span>
                  <p className="m-0 text-base text-text break-words">{alert.message}</p>
                </div>
                <div className="flex items-center gap-3">
                  {alert.status === 'open' && (
                    <>
                      <StatusPill tone="info" label="WAITING FOR REPLY" />
                      <Button variant="quiet" size="md" onClick={() => cancelAlert(alert.id)}>
                        Withdraw
                      </Button>
                    </>
                  )}
                  {alert.status === 'cancelled' && (
                    <StatusPill tone="neutral" label="WITHDRAWN" />
                  )}
                  {alert.status === 'acknowledged' && (
                    <StatusPill tone="ok" label="ANSWERED" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="m-0 mt-3 text-xs text-text-muted">
          Demonstration. Nothing is sent to a real person.
        </p>
      </Card>
    </div>
  )
}
