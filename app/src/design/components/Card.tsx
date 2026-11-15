import type { ReactNode } from 'react'

export type CardProps = { title?: string; footer?: ReactNode; children?: ReactNode }

/** Surface background, border, 12 px radius, 20 px padding. */
export function Card({ title, footer, children }: CardProps) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg border border-border bg-surface p-card">
      {title && <h2 className="m-0 mb-3 text-lg font-semibold break-words text-text">{title}</h2>}
      <div className="min-w-0 text-base text-text-secondary">{children}</div>
      {footer && (
        <div className="mt-4 border-t border-border pt-3 text-sm text-text-secondary">{footer}</div>
      )}
    </section>
  )
}
