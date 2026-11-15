import type { ReactNode } from 'react'

export type FieldFrameProps = {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}

/** Label above, hint or error below. Internal to TextField and NumberField. */
export function FieldFrame({ id, label, hint, error, children }: FieldFrameProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium break-words text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-message`}
          className="m-0 flex items-center gap-1.5 text-xs text-danger"
          role="alert"
        >
          <span aria-hidden="true" className="font-mono">
            !
          </span>
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-message`} className="m-0 text-xs text-text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
