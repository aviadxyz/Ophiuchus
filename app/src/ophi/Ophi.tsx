import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { hasArtImage } from './art'
import { ROUTE_BOTTOM_OFFSETS } from './offsets'
import { OphiPanel } from './OphiPanel'
import { OphiStandIn } from './OphiStandIn'
import { setOphiState, useOphiState, type OphiState } from './ophiState'
import './ophi.css'

const FIRST_VISIT_STORAGE_KEY = 'ophiuchus:v1:ophi-first-visit'

function isHiddenRoute(pathname: string): boolean {
  return (
    pathname === '/medbot' ||
    pathname.startsWith('/medbot/') ||
    pathname === '/w' ||
    pathname.startsWith('/w/') ||
    pathname === '/games' ||
    pathname.startsWith('/games/')
  )
}

export function Ophi() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = useOphiState()

  const [panelOpen, setPanelOpen] = useState(false)
  const [firstVisit, setFirstVisit] = useState(() => {
    try {
      return !localStorage.getItem(FIRST_VISIT_STORAGE_KEY)
    } catch {
      return false
    }
  })
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  const buttonRef = useRef<HTMLButtonElement>(null)
  const lastPathnameRef = useRef<string | null>(null)
  const previousStateBeforeOpenRef = useRef<OphiState>('idle')

  const screenId = location.pathname.replace(/^\//, '').split('/')[0] || 'overview'

  // Emergency screen: on visit, switch state to alert. The panel stays closed so it never
  // covers the Emergency controls; the person can still tap Ophi to open it.
  useEffect(() => {
    const isEmergency = location.pathname === '/emergency' || location.pathname.startsWith('/emergency/')
    const wasEmergency = lastPathnameRef.current === '/emergency' || lastPathnameRef.current?.startsWith('/emergency/')

    if (isEmergency && !wasEmergency) {
      setOphiState('alert')
    } else if (!isEmergency && wasEmergency && state === 'alert') {
      setOphiState('idle')
    }

    lastPathnameRef.current = location.pathname
  }, [location.pathname, state])

  const dismissFirstVisit = () => {
    if (firstVisit) {
      setFirstVisit(false)
      try {
        localStorage.setItem(FIRST_VISIT_STORAGE_KEY, '1')
      } catch {
        // Ignore storage write errors
      }
    }
  }

  const handleTogglePanel = () => {
    dismissFirstVisit()

    if (!panelOpen) {
      previousStateBeforeOpenRef.current = state
      if (state === 'idle' || state === 'hint') {
        setOphiState('talking')
      }
      setPanelOpen(true)
    } else {
      if (state === 'talking') {
        setOphiState(previousStateBeforeOpenRef.current || 'idle')
      }
      setPanelOpen(false)
    }
  }

  const handleClosePanel = () => {
    if (state === 'talking') {
      setOphiState(previousStateBeforeOpenRef.current || 'idle')
    }
    setPanelOpen(false)
  }

  const handleAskMedbot = (targetScreenId: string) => {
    handleClosePanel()
    const url = `/medbot?from=${encodeURIComponent(targetScreenId)}`
    navigate(url)
  }

  // Hidden on /medbot, /w, and /games/...
  if (isHiddenRoute(location.pathname)) {
    return null
  }

  const isAlert = state === 'alert'
  const isHint = state === 'hint'
  const isThinking = state === 'thinking'

  // Image source determination
  const hasSpecificStateImage = hasArtImage(`ophi-${state}.png`)
  const hasIdleImage = hasArtImage('ophi-idle.png')
  const imageKey = hasSpecificStateImage ? `ophi-${state}` : 'ophi-idle'
  const imageError = Boolean(failedImages[imageKey])
  const useBitmap = !imageError && (hasSpecificStateImage || hasIdleImage)
  const imageSrc = hasSpecificStateImage ? `/ophi/ophi-${state}.png` : '/ophi/ophi-idle.png'
  const isUsingFallbackIdle = !hasSpecificStateImage && hasIdleImage

  // Route offset class if specified
  const customBottomOffset = ROUTE_BOTTOM_OFFSETS[screenId] ?? 'bottom-5 sm:bottom-6'

  return (
    <>
      {/* The wrapper lets taps through; only Ophi's own button and his bubble catch them. */}
      <div
        className={[
          'pointer-events-none fixed right-4 sm:right-6 z-30 select-none',
          customBottomOffset,
        ].join(' ')}
      >
        {/* First visit bubble */}
        {firstVisit && !panelOpen && (
          <div
            role="status"
            onClick={dismissFirstVisit}
            className="pointer-events-auto absolute bottom-full right-0 mb-3 w-48 sm:w-56 cursor-pointer rounded-lg border border-border bg-surface-raised p-2.5 text-xs sm:text-sm text-text shadow-xl"
            data-testid="ophi-first-visit-bubble"
          >
            <p className="m-0 leading-snug">Tap me if you want this screen explained.</p>
            {/* Speech bubble pointer */}
            <div className="absolute -bottom-1.5 right-6 size-3 rotate-45 border-r border-b border-border bg-surface-raised" />
          </div>
        )}

        {/* Character Button */}
        <button
          ref={buttonRef}
          type="button"
          onClick={handleTogglePanel}
          aria-label="Ask Ophi to explain this screen"
          aria-expanded={panelOpen}
          className={[
            'pointer-events-auto group relative flex size-12 sm:size-24 cursor-pointer items-center justify-center rounded-full',
            'transition-transform duration-150 outline-none hover:scale-105 active:scale-95',
            'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            // Slow idle float when not alert
            !isAlert ? 'ophi-floating' : '',
            // Orange glow for alert
            isAlert ? 'drop-shadow-[0_0_14px_var(--color-emergency)]' : '',
          ].join(' ')}
        >
          {useBitmap ? (
            <div className="relative size-full">
              <img
                key={imageSrc}
                src={imageSrc}
                alt=""
                onError={() => setFailedImages((prev) => ({ ...prev, [imageKey]: true }))}
                className="size-full object-contain"
              />

              {/* State additions on top of idle image */}
              {isUsingFallbackIdle && (
                <>
                  {isHint && (
                    <span
                      data-testid="ophi-hint-dot"
                      className="absolute top-2 left-1/2 -translate-x-1/2 size-2 rounded-full bg-warn shadow-[0_0_6px_var(--color-warn)]"
                    />
                  )}
                  {isThinking && (
                    <div
                      data-testid="ophi-thinking-bubble"
                      className="absolute -top-3 left-0 flex items-center gap-1 rounded-full border border-border bg-surface-raised px-2 py-0.5"
                    >
                      <span className="size-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="size-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="size-1 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <OphiStandIn state={state} waving={firstVisit} />
          )}
        </button>
      </div>

      {/* Screen Guide Panel */}
      <OphiPanel
        open={panelOpen}
        onClose={handleClosePanel}
        onAskMedbot={handleAskMedbot}
        returnFocusRef={buttonRef}
      />
    </>
  )
}
