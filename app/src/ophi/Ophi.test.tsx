import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { Ophi } from './Ophi'
import { resetOphiState } from './ophiState'

function renderOphiOnRoute(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="*" element={<Ophi />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Ophi and OphiPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    resetOphiState()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    resetOphiState()
  })

  it('renders a button with the accessible name "Ask Ophi to explain this screen"', () => {
    renderOphiOnRoute('/overview')
    const button = screen.getByRole('button', { name: 'Ask Ophi to explain this screen' })
    expect(button).toBeInTheDocument()
  })

  it('shows first-visit bubble once and remembers in localStorage', async () => {
    renderOphiOnRoute('/overview')
    expect(screen.getByTestId('ophi-first-visit-bubble')).toBeInTheDocument()
    expect(screen.getByText('Tap me if you want this screen explained.')).toBeInTheDocument()

    // Clicking Ophi dismisses the bubble and sets storage
    const button = screen.getByRole('button', { name: 'Ask Ophi to explain this screen' })
    await userEvent.click(button)

    expect(screen.queryByTestId('ophi-first-visit-bubble')).not.toBeInTheDocument()
    expect(localStorage.getItem('ophiuchus:v1:ophi-first-visit')).toBe('1')
  })

  it('is hidden on the three routes: /medbot, /w, and /games/...', () => {
    const { unmount: unmountMedbot } = renderOphiOnRoute('/medbot')
    expect(screen.queryByRole('button', { name: 'Ask Ophi to explain this screen' })).not.toBeInTheDocument()
    unmountMedbot()

    const { unmount: unmountWatch } = renderOphiOnRoute('/w')
    expect(screen.queryByRole('button', { name: 'Ask Ophi to explain this screen' })).not.toBeInTheDocument()
    unmountWatch()

    const { unmount: unmountGame } = renderOphiOnRoute('/games/futvolley')
    expect(screen.queryByRole('button', { name: 'Ask Ophi to explain this screen' })).not.toBeInTheDocument()
    unmountGame()
  })

  it('shows the guide of the current route (Nutrition)', async () => {
    renderOphiOnRoute('/nutrition')
    const button = screen.getByRole('button', { name: 'Ask Ophi to explain this screen' })
    await userEvent.click(button)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Nutrition' })).toBeInTheDocument()

    // Check guide sections
    expect(screen.getByRole('heading', { level: 3, name: 'What this shows' })).toBeInTheDocument()
    expect(
      screen.getByText(/What you have eaten and drunk today against what your body needs on this mission/),
    ).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 3, name: 'Why it matters in space' })).toBeInTheDocument()
    expect(screen.getByText(/Crews often eat less than they need in flight/)).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 3, name: 'How to read it' })).toBeInTheDocument()
    expect(screen.getByText(/Green means on target, amber means watch it, red means act today\./)).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 3, name: 'When to act' })).toBeInTheDocument()
    expect(screen.getByText(/Close an amber gap with your next meal or drink\./)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Ask the Med bot about this' })).toBeInTheDocument()
  })

  it('shows the guide for Mood', async () => {
    renderOphiOnRoute('/mood')
    const button = screen.getByRole('button', { name: 'Ask Ophi to explain this screen' })
    await userEvent.click(button)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Mood' })).toBeInTheDocument()
    expect(screen.getByText(/Your own daily check-ins and how they line up with your sleep\./)).toBeInTheDocument()
  })

  it('missing guide falls back to the default', async () => {
    renderOphiOnRoute('/research')
    const button = screen.getByRole('button', { name: 'Ask Ophi to explain this screen' })
    await userEvent.click(button)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Research' })).toBeInTheDocument()
    expect(
      screen.getByText(/This screen is still being built\. Here is what it will show:/),
    ).toBeInTheDocument()
  })

  it('Escape closes and restores focus to Ophi', async () => {
    renderOphiOnRoute('/mood')
    const button = screen.getByRole('button', { name: 'Ask Ophi to explain this screen' })
    button.focus()
    expect(button).toHaveFocus()

    await userEvent.click(button)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()

    // Press Escape
    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(button).toHaveFocus()
  })

  it('closes when clicking the close button or outside backdrop', async () => {
    renderOphiOnRoute('/nutrition')
    const button = screen.getByRole('button', { name: 'Ask Ophi to explain this screen' })
    await userEvent.click(button)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    // Close button
    const closeBtn = screen.getByRole('button', { name: 'Close' })
    await userEvent.click(closeBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Open again and click backdrop
    await userEvent.click(button)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    const backdrop = screen.getByTestId('ophi-backdrop')
    await userEvent.click(backdrop)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('on the route /emergency, state becomes alert and the panel opens automatically once per visit', async () => {
    renderOphiOnRoute('/emergency')

    // Panel automatically opened
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Emergency' })).toBeInTheDocument()

    // Button has alert styling / state
    const button = screen.getByRole('button', { name: 'Ask Ophi to explain this screen' })
    expect(button.className).toContain('drop-shadow-[0_0_14px_#f59e0b]')
  })
})
