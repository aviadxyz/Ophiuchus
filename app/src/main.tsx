import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { App } from './App'

// A new deploy replaces the files an already-open page still points to. Without this, the open
// page keeps the old version and crashes on the next screen it loads. Reload once instead.
const RELOAD_MARK = 'ophiuchus:v1:reloaded-at'
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_MARK) ?? 0)
    if (Date.now() - last < 15_000) return // never loop
    sessionStorage.setItem(RELOAD_MARK, String(Date.now()))
  } catch {
    // Storage unavailable: reload anyway; the worst case is one extra reload.
  }
  window.location.reload()
}
// Vite raises this when a screen's code can no longer be fetched.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadOnce()
})
// The offline cache was replaced by a newer version while this page was open.
if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) reloadOnce()
  })
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
