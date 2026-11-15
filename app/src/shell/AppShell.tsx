import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Ophi } from '@/ophi'
import { getScreen } from '@/registry'
import { AlertBanner } from './AlertBanner'
import { MobileDrawer } from './MobileDrawer'
import { ScreenBoundary } from './ScreenBoundary'
import { ScreenLoading } from './ScreenLoading'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

function screenIdFrom(pathname: string) {
  return pathname.split('/')[1] ?? ''
}

/** Sidebar and content. Renders Ophi once, above everything. */
export function AppShell() {
  const { pathname } = useLocation()
  const screen = getScreen(screenIdFrom(pathname))
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.title = screen ? `${screen.label} · Ophiuchus` : 'Ophiuchus'
    window.scrollTo?.(0, 0)
  }, [pathname, screen])

  return (
    <div className="min-h-dvh bg-bg sm:pl-sidebar-icons lg:pl-sidebar">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-sidebar-icons border-r border-border bg-surface sm:block lg:w-sidebar">
        <Sidebar mode="rail" />
      </aside>
      <TopBar
        title={screen?.label ?? 'Ophiuchus'}
        menuOpen={menuOpen}
        onMenu={() => setMenuOpen(true)}
      />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-content px-page-phone pt-5 pb-28 outline-none sm:px-page sm:pt-8"
      >
        <AlertBanner />
        <ScreenBoundary key={pathname} label={screen?.label}>
          <Suspense fallback={<ScreenLoading />}>
            <Outlet />
          </Suspense>
        </ScreenBoundary>
      </main>
      <Ophi />
    </div>
  )
}
