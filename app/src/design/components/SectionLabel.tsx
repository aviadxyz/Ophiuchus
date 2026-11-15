import type { ReactNode } from 'react'

export type SectionLabelProps = { children: ReactNode; as?: 'h2' | 'h3' | 'p' | 'span' }

/** Mono, uppercase, muted. Used for group headings such as CONSOLE. */
export function SectionLabel({ children, as: Tag = 'h2' }: SectionLabelProps) {
  return (
    <Tag className="m-0 font-mono text-label font-medium uppercase tracking-wider text-text-muted">
      {children}
    </Tag>
  )
}
