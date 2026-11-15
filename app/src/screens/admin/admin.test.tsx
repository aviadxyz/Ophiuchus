// The Admin screen on the demo profile: nothing here reaches the network.

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeGroundView, setGroundShare } from '@/data'
import AdminScreen from './index'
import { ago, delayWords, isLate } from './text'

function renderScreen() {
  return render(
    <MemoryRouter>
      <AdminScreen />
    </MemoryRouter>,
  )
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(async () => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
  await setGroundShare(false)
  closeGroundView()
})

afterEach(() => {
  closeGroundView()
  vi.unstubAllGlobals()
})

describe('Admin screen', () => {
  it('asks before sharing and remembers the choice', async () => {
    const user = userEvent.setup()
    const { unmount } = renderScreen()
    const toggle = screen.getByRole('switch', { name: /^Share .+'s record with the ground team$/ })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/They do not see your mood notes/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Not now' }))
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(toggle)
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Share my record' }),
    )
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    unmount()
    renderScreen()
    expect(
      screen.getByRole('switch', { name: /^Share .+'s record with the ground team$/ }),
    ).toHaveAttribute('aria-checked', 'true')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('opens the simulated crew after a confirmation, shows a row in detail, and closes', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Look at the simulated crew' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/They are private/)).toBeInTheDocument()
    expect(screen.queryByText(/Every person in this list is simulated/)).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Open the records' }))

    expect(screen.getByText(/Every person in this list is simulated/)).toBeInTheDocument()
    expect(screen.getByText(/Signal delay on this mission/)).toBeInTheDocument()
    expect(screen.getAllByText('No newer report has arrived').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('6 REPORTING')).toBeInTheDocument()
    expect(screen.getByText('3 NEED ATTENTION')).toBeInTheDocument()

    await user.click(screen.getByText('kestrel_9'))
    expect(screen.getByText('Questions for the flight surgeon')).toBeInTheDocument()
    expect(screen.getByText(/slept badly for two nights/)).toBeInTheDocument()
    expect(screen.getAllByText('Source: to be confirmed').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await user.click(screen.getByRole('button', { name: 'Close the ground view' }))
    expect(screen.queryByText('kestrel_9')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open with the ground code' })).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('says the server cannot be reached when no ground server is set', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Open with the ground code' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Open the records' }),
    )
    const field = screen.getByLabelText('Ground code')
    expect(field).toHaveAttribute('type', 'password')
    await user.type(field, 'not-a-real-code')
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(await screen.findByText('The server cannot be reached.')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('Admin words', () => {
  const now = new Date('2026-11-16T12:00:00Z').getTime()
  it('says how long ago and whether a report is late', () => {
    expect(ago(new Date(now - 20_000).toISOString(), now)).toBe('just now')
    expect(ago(new Date(now - 6 * 60_000).toISOString(), now)).toBe('6 min ago')
    expect(ago(new Date(now - 62 * 60_000).toISOString(), now)).toBe('about an hour ago')
    expect(ago(new Date(now - 9 * 3_600_000).toISOString(), now)).toBe('about 9 hours ago')
    expect(isLate(new Date(now - 59 * 60_000).toISOString(), now)).toBe(false)
    expect(isLate(new Date(now - 61 * 60_000).toISOString(), now)).toBe(true)
    expect(delayWords(240)).toBe('4 minutes')
  })
})
