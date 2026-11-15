import { useId, useState } from 'react'
import { cn } from '../cn'
import { inputClass } from '../fieldStyles'
import { FieldFrame } from './FieldFrame'

export type NumberFieldProps = {
  label: string
  /** null means empty. */
  value: number | null
  onChange: (value: number | null) => void
  hint?: string
  error?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
}

function parse(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/** A number input with an optional unit. Typing keeps partial input such as "1." until it is a number. */
export function NumberField({
  label,
  value,
  onChange,
  hint,
  error,
  min,
  max,
  step,
  unit,
  disabled,
}: NumberFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    if (parse(draft) !== value) setDraft(value === null ? '' : String(value))
  }
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          onChange={(event) => {
            const text = event.target.value
            if (!/^-?[0-9]*[.,]?[0-9]*$/.test(text)) return
            setDraft(text)
            const parsed = parse(text)
            if (parsed !== null || text.trim() === '') {
              setLastValue(parsed)
              onChange(parsed)
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
            event.preventDefault()
            const delta = (step ?? 1) * (event.key === 'ArrowUp' ? 1 : -1)
            let next = (value ?? 0) + delta
            if (min !== undefined) next = Math.max(min, next)
            if (max !== undefined) next = Math.min(max, next)
            next = Math.round(next * 1000) / 1000
            setDraft(String(next))
            setLastValue(next)
            onChange(next)
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-message` : undefined}
          aria-valuemin={min}
          aria-valuemax={max}
          className={cn(
            inputClass,
            'tabular-nums',
            unit && 'pr-14',
            error ? 'border-danger' : 'border-border',
          )}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-text-muted">
            {unit}
          </span>
        )}
      </div>
    </FieldFrame>
  )
}
