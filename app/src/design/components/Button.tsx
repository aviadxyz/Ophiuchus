import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../cn'

export type ButtonVariant = 'primary' | 'quiet' | 'danger'
export type ButtonSize = 'md' | 'lg'

export type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  disabled?: boolean
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  children?: ReactNode
  type?: 'button' | 'submit' | 'reset'
  /** Required when the button shows only an icon. */
  'aria-label'?: string
  'aria-expanded'?: boolean
  'aria-controls'?: string
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-bg hover:bg-accent/85 font-semibold',
  quiet: 'border border-border text-text hover:bg-surface-raised',
  danger: 'bg-danger text-bg hover:bg-danger/85 font-semibold',
}

const sizeClass: Record<ButtonSize, string> = {
  md: 'h-10 px-3.5 text-base gap-2',
  lg: 'h-12 px-5 text-lg gap-2.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  disabled = false,
  onClick,
  children,
  type = 'button',
  ...aria
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex max-w-full shrink-0 cursor-pointer items-center justify-center rounded-md',
        'transition-colors duration-150 select-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        !children && (size === 'md' ? 'w-10 px-0' : 'w-12 px-0'),
      )}
      {...aria}
    >
      {Icon && <Icon aria-hidden="true" className={size === 'md' ? 'size-4' : 'size-5'} />}
      {children && <span className="truncate">{children}</span>}
    </button>
  )
}
