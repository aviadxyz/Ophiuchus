// Exports the Ophi interface per CONTRACTS section 12.

export type { OphiState } from './ophiState'
export { setOphiState, useOphiState } from './ophiState'

/**
 * Navigates to /medbot?from=<screenId>. Uses the History API and tells the router, so it works
 * from anywhere without importing the shell.
 */
export function askMedbot(screenId: string): void {
  const url = `/medbot?from=${encodeURIComponent(screenId)}`
  window.history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
}

export { Ophi } from './Ophi'
export { OphiPanel } from './OphiPanel'
