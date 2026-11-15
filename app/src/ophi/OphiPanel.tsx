import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { X } from 'lucide-react'
import { Button, SectionLabel } from '@/design'
import { getScreen, loadGuide, type Guide } from '@/registry'

export type OphiPanelProps = {
  open: boolean
  onClose: () => void
  onAskMedbot: (screenId: string) => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function OphiPanel({ open, onClose, onAskMedbot, returnFocusRef }: OphiPanelProps) {
  const { pathname } = useLocation()
  const screenId = pathname.replace(/^\//, '').split('/')[0] || 'overview'
  const screen = getScreen(screenId)
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  const [loadedData, setLoadedData] = useState<{ id: string; guide: Guide | null }>({
    id: '',
    guide: null,
  })

  // Load guide for the current screen
  useEffect(() => {
    let active = true
    loadGuide(screenId).then((loaded) => {
      if (active) {
        setLoadedData({ id: screenId, guide: loaded ?? null })
      }
    })
    return () => {
      active = false
    }
  }, [screenId])

  const guide = loadedData.id === screenId ? loadedData.guide : null
  const loading = loadedData.id !== screenId

  // Focus trap, Escape handling, and restore focus on close
  useEffect(() => {
    if (!open) return

    const triggerElement = returnFocusRef?.current ?? (document.activeElement as HTMLElement | null)
    const panelNode = panelRef.current

    // Move focus inside dialog
    const focusables = panelNode ? Array.from(panelNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []
    const firstFocusable = focusables[0] ?? panelNode
    firstFocusable?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key === 'Tab' && panelNode) {
        const items = Array.from(panelNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        if (items.length === 0) {
          event.preventDefault()
          return
        }
        const first = items[0]
        const last = items[items.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      triggerElement?.focus()
    }
  }, [open, onClose, returnFocusRef])

  if (!open) return null

  const screenTitle = screen?.label ?? 'Screen Guide'

  const handleMedbotClick = () => {
    onClose()
    onAskMedbot(screenId)
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop for click-outside dismissal */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-bg/60 backdrop-blur-[1px] transition-opacity duration-150 sm:bg-bg/40"
        data-testid="ophi-backdrop"
      />

      {/* Dialog: bottom sheet on phone, anchored beside Ophi on PC */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          'absolute flex flex-col border-border bg-surface outline-none shadow-2xl transition-all duration-200',
          // Phone: bottom sheet
          'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-lg border-t',
          // PC (sm: >= 640px): anchored beside Ophi in the bottom-right corner
          'sm:inset-auto sm:bottom-6 sm:right-32 sm:w-[420px] sm:max-h-[80vh] sm:rounded-lg sm:border',
        ].join(' ')}
        data-testid="ophi-panel-dialog"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <h2 id={titleId} className="m-0 text-lg font-semibold text-text truncate">
            {screenTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-raised hover:text-text cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm text-text-secondary">
          {loading && !guide ? (
            <p className="text-text-muted">Loading guide...</p>
          ) : guide ? (
            <>
              {/* 1. What this shows */}
              <div className="space-y-1">
                <SectionLabel as="h3">What this shows</SectionLabel>
                <p className="text-sm text-text leading-relaxed">{guide.shows}</p>
              </div>

              {/* 2. Why it matters in space */}
              <div className="space-y-1">
                <SectionLabel as="h3">Why it matters in space</SectionLabel>
                <p className="text-sm text-text leading-relaxed">{guide.whyItMatters}</p>
              </div>

              {/* 3. How to read it */}
              <div className="space-y-1">
                <SectionLabel as="h3">How to read it</SectionLabel>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-text">
                  {guide.howToRead.slice(0, 3).map((bullet, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              {/* 4. When to act (omit if empty) */}
              {guide.whenToAct?.trim() ? (
                <div className="space-y-1">
                  <SectionLabel as="h3">When to act</SectionLabel>
                  <p className="text-sm text-text leading-relaxed">{guide.whenToAct}</p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-text-muted">No guide information available for this screen.</p>
          )}
        </div>

        {/* Footer: Ask the Med bot button */}
        <div className="shrink-0 border-t border-border px-5 py-3.5 bg-surface-raised/40">
          <Button variant="primary" size="md" onClick={handleMedbotClick}>
            Ask the Med bot about this
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
