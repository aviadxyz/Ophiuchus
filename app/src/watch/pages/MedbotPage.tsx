import { useState, useRef, useCallback } from 'react'
import { HeartPulse, Mic } from 'lucide-react'
import { config } from '@/config'
import {
  useActiveProfile,
  useHealthSummary,
  useMission,
  useToday,
  useTargets,
  useSleep,
  useMoodCheckins,
  useExerciseSessions,
  useLatestVitals,
  useAlerts,
} from '@/data'
import { buildWatchChatContext } from '../medbotContext'
import { getWatchScriptedReply } from '../scriptedReplies'

const PRESET_QUESTIONS = [
  'How am I doing today?',
  'What should I do next?',
  "I don't feel well.",
] as const

type SpeechResultItem = { transcript: string }
type SpeechResultList = { [index: number]: { [index: number]: SpeechResultItem }; length: number }
type SpeechRecognitionEvent = {
  resultIndex: number
  results: SpeechResultList
}

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: unknown) => void) | null
  onend: (() => void) | null
}

type SpeechConstructor = new () => SpeechRecognitionInstance

function getSpeechConstructor(): SpeechConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: SpeechConstructor
    webkitSpeechRecognition?: SpeechConstructor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition
}

export function MedbotPage() {
  const profile = useActiveProfile()
  const mission = useMission()
  const today = useToday()
  const targets = useTargets()
  const summary = useHealthSummary()
  const sleepRecords = useSleep(7)
  const moodCheckins = useMoodCheckins(7)
  const exerciseSessions = useExerciseSessions(mission.startDate, today.date)
  const latestVitals = useLatestVitals().latest
  const alerts = useAlerts()

  const [hasSpeech] = useState(() => Boolean(getSpeechConstructor()))
  const [isListening, setIsListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const transcriptRef = useRef<string>('')

  const speak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        window.speechSynthesis.speak(utterance)
      } catch {
        // Ignore speech synthesis failures in headless / unsupported environments
      }
    }
  }

  const handleSend = useCallback(
    async (questionText: string) => {
      const q = questionText.trim()
      if (!q) return

      setLoading(true)
      setReply(null)
      setIsOffline(false)

      const chatUrl = config.chatUrl
      let answer: string | null = null
      let offlineFallback = false

      if (chatUrl) {
        try {
          const contextBlock = buildWatchChatContext({
            screenLabel: 'Watch',
            mission,
            profile,
            today,
            targets,
            sleepRecords,
            moodCheckins,
            exerciseSessions,
            latestVitals,
            alerts,
            replyMode: 'watch',
          })

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 8000)

          const res = await fetch(chatUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: q,
              screenId: 'watch',
              screenLabel: 'Watch',
              context: contextBlock,
              replyMode: 'watch',
            }),
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (res.ok) {
            const data = (await res.json()) as { reply?: string }
            if (typeof data.reply === 'string' && data.reply.trim().length > 0) {
              answer = data.reply.trim()
            }
          }
        } catch {
          // Timeout or network error
          offlineFallback = true
        }
      } else {
        offlineFallback = true
      }

      if (!answer) {
        offlineFallback = true
        answer = getWatchScriptedReply(q, {
          summary,
          today,
          targets,
        })
      }

      setIsOffline(offlineFallback)
      setReply(answer)
      setLoading(false)
      speak(answer)
    },
    [
      profile,
      mission,
      today,
      targets,
      summary,
      sleepRecords,
      moodCheckins,
      exerciseSessions,
      latestVitals,
      alerts,
    ],
  )

  const startListening = () => {
    if (isListening) return
    const SpeechClass = getSpeechConstructor()
    if (!SpeechClass) return

    try {
      const recognition: SpeechRecognitionInstance = new SpeechClass()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'
      transcriptRef.current = ''

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let final = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          final += event.results[i][0].transcript
        }
        transcriptRef.current = final
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
      recognitionRef.current = recognition
      setIsListening(true)
    } catch {
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (!isListening) return
    setIsListening(false)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }

    const text = transcriptRef.current.trim()
    if (text) {
      void handleSend(text)
    }
  }

  return (
    <div className="flex size-full flex-col items-center justify-between py-2 text-center select-none">
      {/* Header */}
      <div className="flex items-center gap-1.5 pt-1">
        <HeartPulse className="size-4 text-accent" aria-hidden="true" />
        <span className="font-semibold text-sm tracking-wide text-text">Med bot</span>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col items-center justify-center w-full px-3 py-1">
        {loading ? (
          <div className="flex flex-col items-center gap-1">
            <span className="size-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="text-xs text-text-muted">Thinking...</span>
          </div>
        ) : reply ? (
          <div
            onClick={() => setReply(null)}
            className="flex flex-col items-center gap-1 cursor-pointer max-h-[140px] overflow-y-auto px-1"
            title="Tap to ask another question"
          >
            <p className="m-0 text-xs leading-relaxed text-text font-normal">
              {reply}
            </p>
            {isOffline && (
              <span
                data-testid="offline-badge"
                className="font-mono text-[10px] text-text-muted italic"
              >
                offline
              </span>
            )}
            <span className="text-[9px] text-accent mt-1">Tap to reset</span>
          </div>
        ) : hasSpeech ? (
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onPointerDown={startListening}
              onPointerUp={stopListening}
              onPointerLeave={stopListening}
              aria-label="Hold to talk"
              className={`flex size-20 cursor-pointer items-center justify-center rounded-full border-2 transition-all ${
                isListening
                  ? 'scale-105 border-accent bg-accent/20 text-accent animate-pulse'
                  : 'border-border bg-surface hover:bg-surface-raised active:scale-95 text-text'
              }`}
            >
              <Mic className="size-8" />
            </button>
            <span className="text-xs text-text-secondary">
              {isListening ? 'Listening...' : 'Hold to talk'}
            </span>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-1.5 px-2">
            {PRESET_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void handleSend(q)}
                className="w-full truncate rounded border border-border bg-surface px-2 py-1 text-[11px] font-medium text-text hover:bg-surface-raised active:scale-98 cursor-pointer transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer spacing */}
      <div className="h-4" />
    </div>
  )
}
