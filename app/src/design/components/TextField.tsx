import { useId } from 'react'
import { cn } from '../cn'
import { inputClass } from '../fieldStyles'
import { FieldFrame } from './FieldFrame'

export type TextFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
  placeholder?: string
  type?: 'text' | 'email' | 'search' | 'url'
  maxLength?: number
  disabled?: boolean
  autoComplete?: string
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  type = 'text',
  ...rest
}: TextFieldProps) {
  const id = useId()
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        className={cn(inputClass, error ? 'border-danger' : 'border-border')}
        {...rest}
      />
    </FieldFrame>
  )
}
