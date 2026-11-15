/** Shown while a screen's code loads. */
export function ScreenLoading() {
  return (
    <div role="status" className="flex flex-col gap-3 py-2">
      <span className="h-3 w-40 animate-pulse rounded-sm bg-surface-raised" />
      <span className="h-8 w-64 max-w-full animate-pulse rounded-md bg-surface-raised" />
      <span className="h-4 w-full max-w-description animate-pulse rounded-sm bg-surface-raised" />
      <span className="sr-only">Loading screen</span>
    </div>
  )
}
