import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDialog } from '../useDialog'
import { Button } from './Button'

export type ConfirmDialogProps = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  /** Defaults to Cancel. */
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** Asks once before something that cannot be undone. Escape or the backdrop cancels. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const messageId = useId()
  useDialog(open, onCancel, panel)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-page-phone">
      <div aria-hidden="true" className="absolute inset-0 bg-bg/70" onClick={onCancel} />
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        className="relative w-full max-w-dialog rounded-lg border border-border bg-surface-raised p-card outline-none"
      >
        <h2 id={titleId} className="m-0 text-xl font-semibold break-words text-text">
          {title}
        </h2>
        <p id={messageId} className="m-0 mt-2 text-base break-words text-text-secondary">
          {message}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="quiet" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
