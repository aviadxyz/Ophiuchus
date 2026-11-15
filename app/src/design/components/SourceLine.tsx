export type SourceLineProps = { text: string; href?: string }

/** "Source: ..." under a target or fact. Empty text reads "Source: to be confirmed". */
export function SourceLine({ text, href }: SourceLineProps) {
  const shown = text.trim() || 'to be confirmed'
  return (
    <p className="m-0 mt-1 text-xs text-text-muted break-words">
      Source:{' '}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-secondary underline decoration-border underline-offset-2 hover:text-text"
        >
          {shown}
        </a>
      ) : (
        shown
      )}
    </p>
  )
}
