import { useEffect, useRef } from 'react'
import { cn } from '../cn'

export type ChatMessageView = {
  id: string
  side: 'me' | 'them'
  text: string
  time: string
  note?: string
}

export type ChatThreadProps = {
  messages: ChatMessageView[]
  /** Shows a waiting bubble on the `them` side. */
  pending?: boolean
  emptyText: string
}

/** Bubbles, oldest at the top, kept scrolled to the newest. Used by Med bot and Social. */
export function ChatThread({ messages, pending = false, emptyText }: ChatThreadProps) {
  const log = useRef<HTMLDivElement>(null)
  const last = messages[messages.length - 1]?.id
  useEffect(() => {
    // Scroll only the thread, never the page around it.
    const node = log.current
    if (node) node.scrollTop = node.scrollHeight
  }, [last, pending])

  return (
    <div
      ref={log}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-2"
    >
      {messages.length === 0 && !pending && (
        <p className="m-auto max-w-description px-4 text-center text-base text-text-muted">
          {emptyText}
        </p>
      )}
      {messages.map((message) => {
        const mine = message.side === 'me'
        return (
          <div
            key={message.id}
            className={cn(
              'flex max-w-[85%] flex-col gap-1',
              mine ? 'items-end self-end' : 'items-start self-start',
            )}
          >
            <span className="sr-only">{mine ? 'You said:' : 'Reply:'}</span>
            <div
              className={cn(
                'rounded-lg border px-3.5 py-2.5 text-base whitespace-pre-wrap break-words text-text',
                mine
                  ? 'rounded-br-sm border-accent/35 bg-accent/12'
                  : 'rounded-bl-sm border-border bg-surface-raised',
              )}
            >
              {message.text}
            </div>
            <span className="px-1 font-mono text-pill text-text-muted">
              {message.time}
              {message.note && <span className="ml-2 font-sans normal-case">{message.note}</span>}
            </span>
          </div>
        )
      })}
      {pending && (
        <div
          className="flex self-start rounded-lg rounded-bl-sm border border-border bg-surface-raised px-4 py-3.5"
          aria-label="Waiting for a reply"
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden="true"
              className="mx-0.5 size-1.5 animate-pulse rounded-full bg-text-secondary"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
