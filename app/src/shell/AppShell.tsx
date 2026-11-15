import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useDevice } from '@/data'
import { Ophi } from '@/ophi'
import { getScreen } from '@/registry'
import { AlertBanner } from './AlertBanner'
import { AutoAlertBanner } from './AutoAlertBanner'
import { BottomBar } from './BottomBar'
import { DeviceSetup } from './DeviceSetup'
import { MobileDrawer } from './MobileDrawer'
import { QuickLogSheet } from './QuickLogSheet'
import { ScreenBoundary } from './ScreenBoundary'
import { ScreenLoading } from './ScreenLoading'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

function screenIdFrom(pathname: string) {
  return pathname.split('/')[1] ?? ''
}

/**
 * From 640 px: the crew console, sidebar and content. Under 640 px: a personal app with a top bar
 * and a bottom bar. Until this device is set up, the first-open card instead. Renders Ophi once.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const screen = getScreen(screenIdFrom(pathname))
  const { setupDone } = useDevice()

  useEffect(() => {
    document.title = screen ? `${screen.label} · Ophiuchus` : 'Ophiuchus'
    window.scrollTo?.(0, 0)
  }, [pathname, screen])

  // The layout mounts afresh after the card, so a menu that was open when setup was reset is closed.
  return setupDone ? <ShellLayout pathname={pathname} label={screen?.label} /> : <DeviceSetup />
}

function ShellLayout({ pathname, label }: { pathname: string; label?: string }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

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
      <TopBar title={label ?? 'Ophiuchus'} />
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <QuickLogSheet open={logOpen} onClose={() => setLogOpen(false)} />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-content px-page-phone pt-5 pb-[calc(9rem+env(safe-area-inset-bottom))] outline-none sm:px-page sm:pt-8 sm:pb-28"
      >
        <AutoAlertBanner />
        <AlertBanner />
        <ScreenBoundary key={pathname} label={label}>
          <Suspense fallback={<ScreenLoading />}>
            <Outlet />
          </Suspense>
        </ScreenBoundary>
      </main>
      <BottomBar
        logOpen={logOpen}
        moreOpen={menuOpen}
        onLog={() => setLogOpen(true)}
        onMore={() => setMenuOpen(true)}
      />
      <Ophi />
    </div>
  )
}
