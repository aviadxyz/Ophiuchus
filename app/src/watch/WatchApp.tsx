import { useState, useEffect, useRef, useCallback, type TouchEvent, type PointerEvent } from 'react'
import { joinRoom } from '@/data'
import { HealthOverviewPage } from './pages/HealthOverviewPage'
import { MedbotPage } from './pages/MedbotPage'
import { EmergencyPage } from './pages/EmergencyPage'
import { AboutPage } from './pages/AboutPage'

export type WatchAppProps = {
  round?: boolean
  className?: string
}

const PAGE_COUNT = 4

export function WatchApp({ round = true, className = '' }: WatchAppProps) {
  const [currentPage, setCurrentPage] = useState(0)

  // Automatic room joining on load if ?room=CODE is in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const roomCode = params.get('room')
      if (roomCode) {
        joinRoom(roomCode)
      }
    }
  }, [])

  // Page navigation helpers
  const goToPage = useCallback((index: number) => {
    setCurrentPage(Math.max(0, Math.min(PAGE_COUNT - 1, index)))
  }, [])

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(PAGE_COUNT - 1, prev + 1))
  }, [])

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }, [])

  // Arrow key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not navigate pages if user is focused inside a form input
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
      ) {
        return
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextPage()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        prevPage()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nextPage, prevPage])

  // Touch / Pointer gesture swipe handling
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0].clientX
    touchStartYRef.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 35) {
      if (deltaX < 0) {
        nextPage()
      } else {
        prevPage()
      }
    }
    touchStartXRef.current = null
    touchStartYRef.current = null
  }

  const pointerStartXRef = useRef<number | null>(null)
  const pointerStartYRef = useRef<number | null>(null)

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Only drag with primary mouse button / touch
    if (e.button !== 0) return
    pointerStartXRef.current = e.clientX
    pointerStartYRef.current = e.clientY
  }

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (pointerStartXRef.current === null || pointerStartYRef.current === null) return
    const deltaX = e.clientX - pointerStartXRef.current
    const deltaY = e.clientY - pointerStartYRef.current

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        nextPage()
      } else {
        prevPage()
      }
    }
    pointerStartXRef.current = null
    pointerStartYRef.current = null
  }

  return (
    <div
      tabIndex={0}
      data-testid="watch-app"
      data-page={currentPage}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className={`relative flex flex-col items-center justify-between aspect-square w-full min-w-[180px] max-w-[450px] bg-bg border border-border text-text shadow-2xl select-none outline-none overflow-hidden transition-all duration-300 ${
        round ? 'rounded-full' : 'rounded-3xl'
      } ${className}`}
    >
      {/* Top Pagination Dots inside inscribed safe area */}
      <div
        className="z-10 flex items-center justify-center gap-1.5 pt-2"
        role="tablist"
        aria-label="Watch pages"
      >
        {Array.from({ length: PAGE_COUNT }).map((_, idx) => (
          <button
            key={idx}
            type="button"
            role="tab"
            aria-selected={currentPage === idx}
            aria-label={`Page ${idx + 1}`}
            onClick={() => goToPage(idx)}
            className={`cursor-pointer rounded-full transition-all duration-200 ${
              currentPage === idx
                ? 'w-3 h-1 bg-accent'
                : 'size-1 bg-border hover:bg-text-muted'
            }`}
          />
        ))}
      </div>

      {/* Main page content carousel */}
      <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center p-2">
        <div
          className="flex size-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentPage * 100}%)` }}
        >
          {/* Page 0: Health Overview */}
          <div className="size-full shrink-0 flex items-center justify-center px-1">
            <HealthOverviewPage />
          </div>

          {/* Page 1: Med bot */}
          <div className="size-full shrink-0 flex items-center justify-center px-1">
            <MedbotPage />
          </div>

          {/* Page 2: Emergency */}
          <div className="size-full shrink-0 flex items-center justify-center px-1">
            <EmergencyPage />
          </div>

          {/* Page 3: About */}
          <div className="size-full shrink-0 flex items-center justify-center px-1">
            <AboutPage />
          </div>
        </div>
      </div>

      {/* Bottom spacer / safe area padding */}
      <div className="h-2 w-full" />
    </div>
  )
}

export default WatchApp
