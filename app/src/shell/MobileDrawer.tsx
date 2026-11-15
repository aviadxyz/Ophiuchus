import { useRef } from 'react'
import { X } from 'lucide-react'
import { useDialog } from '@/design/useDialog'
import { Sidebar } from './Sidebar'

type MobileDrawerProps = { open: boolean; onClose: () => void }

/** The sidebar as a drawer under 640 px, opened from the top bar. */
export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const panel = useRef<HTMLDivElement>(null)
  useDialog(open, onClose, panel)
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 sm:hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-bg/70 transition-opacity duration-200 starting:opacity-0"
        onClick={onClose}
      />
      <div
        id="mobile-drawer"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-[85vw] max-w-sidebar flex-col border-r border-border bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] outline-none transition-transform duration-200 starting:-translate-x-full"
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="font-mono text-label font-medium uppercase tracking-wider text-text-muted">
            Ophiuchus
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-2 inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-text-secondary hover:bg-surface-raised hover:text-text"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <Sidebar mode="full" onNavigate={onClose} />
        </div>
      </div>
    </div>
  )
}
