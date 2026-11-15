import { SendHorizontal } from 'lucide-react'
import { cn } from '../cn'

export type ChatInputProps = {
  value: string
  onChange: (value: string) => void
  onSend: (text: string) => void
  disabled?: boolean
  maxLength?: number
  placeholder?: string
  /** Read by screen readers. Defaults to "Message". */
  label?: string
}

/** One text line and a send button. Enter sends. Sticks to the bottom, above the phone keyboard. */
export function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  maxLength = 500,
  placeholder,
  label = 'Message',
}: ChatInputProps) {
  const text = value.trim()
  const canSend = !disabled && text.length > 0
  return (
    <form
      className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-bg pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onSubmit={(event) => {
        event.preventDefault()
        if (canSend) onSend(text)
      }}
    >
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={label}
        enterKeyHint="send"
        autoComplete="off"
        className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base text-text placeholder:text-text-muted focus-visible:border-accent disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send"
        className={cn(
          'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md bg-accent text-bg',
          'transition-colors duration-150 hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        <SendHorizontal aria-hidden="true" className="size-5" />
      </button>
    </form>
  )
}
