import { lazy, Suspense, type ComponentType } from 'react'
import { Link } from 'react-router'
import { ScreenBoundary } from './ScreenBoundary'

// Lane 08 adds watch/WatchApp.tsx. Until then /w explains that the view is not built yet.
const watchModules = import.meta.glob<{ default?: ComponentType; WatchApp?: ComponentType }>(
  '../watch/WatchApp.tsx',
)
const loadWatch = Object.values(watchModules)[0]

const WatchApp = loadWatch
  ? lazy(async () => {
      const mod = await loadWatch()
      const component = mod.default ?? mod.WatchApp
      if (!component) throw new Error('watch/WatchApp.tsx must export WatchApp')
      return { default: component }
    })
  : null

/** The bare watch view at /w: no shell, no Ophi. */
export function WatchRoute() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-2">
      {WatchApp ? (
        <ScreenBoundary label="Watch view">
          <Suspense
            fallback={
              <span className="font-mono text-label text-text-muted uppercase">Loading</span>
            }
          >
            <WatchApp />
          </Suspense>
        </ScreenBoundary>
      ) : (
        <div className="flex max-w-xs flex-col items-center gap-3 text-center">
          <p className="m-0 text-base text-text-secondary">
            The watch view is being built by Rami.
          </p>
          <Link to="/overview" className="text-base text-accent">
            Open the console
          </Link>
        </div>
      )}
    </div>
  )
}
