import { useId } from 'react'
import { cn } from '../cn'

export type SwitchProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
  disabled?: boolean
}

/** An on/off setting. Always shows the word ON or OFF next to the control. */
export function Switch({ label, checked, onChange, hint, disabled = false }: SwitchProps) {
  const labelId = useId()
  const hintId = useId()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={labelId} className="m-0 text-base font-medium break-words text-text">
          {label}
        </p>
        {hint && (
          <p id={hintId} className="m-0 mt-0.5 text-xs break-words text-text-muted">
            {hint}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full py-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors duration-150',
            checked ? 'bg-accent' : 'bg-border',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 size-5 rounded-full bg-text transition-transform duration-150',
              checked && 'translate-x-5',
            )}
          />
        </span>
        <span
          aria-hidden="true"
          className={cn('w-7 font-mono text-label', checked ? 'text-accent' : 'text-text-muted')}
        >
          {checked ? 'ON' : 'OFF'}
        </span>
      </button>
    </div>
  )
}
