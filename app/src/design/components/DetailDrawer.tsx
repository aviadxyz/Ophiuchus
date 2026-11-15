import { useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useDialog } from '../useDialog'

export type DetailDrawerProps = {
  open: boolean
  title: string
  onClose: () => void
  children?: ReactNode
}

/** Slides in from the right on PC, from the bottom on phone. */
export function DetailDrawer({ open, title, onClose, children }: DetailDrawerProps) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useDialog(open, onClose, panel)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-40">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-bg/70 transition-opacity duration-200 starting:opacity-0"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          'absolute flex flex-col border-border bg-surface outline-none transition-transform duration-200',
          'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-lg border-t starting:translate-y-full',
          'sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-drawer sm:max-w-full sm:rounded-none sm:border-t-0 sm:border-l',
          'sm:starting:translate-x-full sm:starting:translate-y-0',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-card py-4">
          <h2 id={titleId} className="m-0 min-w-0 text-xl font-semibold break-words text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-surface-raised hover:text-text"
            aria-label="Close"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-card py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-base text-text-secondary">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
