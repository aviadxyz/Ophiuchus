import { cn } from '../cn'

export type ChipOption = string | { value: string; label: string }

export type ChipGroupProps = {
  options: ChipOption[]
  /** Selected values. For a single choice, a list of zero or one. */
  selected: string[]
  onChange: (selected: string[]) => void
  multiple?: boolean
  /** Read by screen readers. */
  label?: string
}

function normalize(option: ChipOption) {
  return typeof option === 'string' ? { value: option, label: option } : option
}

/** Tags and pickers. Selected chips show a check mark, not only a color. */
export function ChipGroup({
  options,
  selected,
  onChange,
  multiple = false,
  label,
}: ChipGroupProps) {
  const items = options.map(normalize)
  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={label}
      className="flex flex-wrap gap-2"
    >
      {items.map((item) => {
        const on = selected.includes(item.value)
        const toggle = () => {
          if (multiple)
            onChange(on ? selected.filter((v) => v !== item.value) : [...selected, item.value])
          else if (!on) onChange([item.value])
        }
        return (
          <button
            key={item.value}
            type="button"
            role={multiple ? undefined : 'radio'}
            aria-pressed={multiple ? on : undefined}
            aria-checked={multiple ? undefined : on}
            onClick={toggle}
            className={cn(
              'inline-flex min-h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm',
              'transition-colors duration-150',
              on
                ? 'border-accent/35 bg-accent/12 text-text'
                : 'border-border text-text-secondary hover:bg-surface-raised hover:text-text',
            )}
          >
            {on && (
              <span aria-hidden="true" className="text-accent">
                ✓
              </span>
            )}
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
