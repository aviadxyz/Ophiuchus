import { Button } from './Button'

export type EmptyStateProps = { message: string; actionLabel?: string; onAction?: () => void }

/** One sentence and, when given, one action. */
export function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-card py-10 text-center">
      <p className="m-0 max-w-description text-base text-text-secondary break-words">{message}</p>
      {actionLabel && onAction && (
        <Button variant="quiet" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
