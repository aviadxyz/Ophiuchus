import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProfile, deleteProfileData, resetDemoProfile, setActiveProfile } from '@/data'
import NutritionScreen from './index'

// Charts need a real layout engine. The screen's own text is what is tested here.
vi.mock('@/design', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/design')>()),
  TrendChart: ({ summary }: { summary: string }) => <div data-testid="trend">{summary}</div>,
}))

function renderScreen() {
  return render(
    <MemoryRouter>
      <NutritionScreen />
    </MemoryRouter>,
  )
}

let memberId: string | null = null

beforeEach(() => {
  setActiveProfile('demo')
  resetDemoProfile()
})

afterEach(() => {
  if (memberId) deleteProfileData(memberId)
  memberId = null
})

function useMemberOnly() {
  act(() => {
    memberId = createProfile({ displayName: 'Test member' })
    setActiveProfile(memberId)
  })
}

describe('Nutrition on the demo profile', () => {
  it('fills the tiles, the table and the suggestion', () => {
    renderScreen()
    const tiles = screen.getByRole('region', { name: "Today's totals" })
    for (const label of ['Energy', 'Water', 'Protein', 'Sodium']) {
      expect(within(tiles).getByText(label)).toBeInTheDocument()
    }
    expect(within(tiles).getByText(/limit 3,500/)).toBeInTheDocument()
    expect(within(tiles).getAllByLabelText(/source: simulated/i).length).toBeGreaterThanOrEqual(3)

    const table = screen.getByRole('table')
    for (const nutrient of ['Vitamin D', 'Calcium', 'Iron', 'Sodium', 'Omega-3', 'Potassium']) {
      expect(
        within(table).getByRole('rowheader', { name: new RegExp(nutrient) }),
      ).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { name: 'Suggestion' })).toBeInTheDocument()
    expect(screen.getByText(/ OFF TARGET$/)).toBeInTheDocument()
  })

  it('shows source lines under targets', () => {
    renderScreen()
    expect(screen.getAllByText(/Source:/).length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText(/NASA HRP.*Evidence Report/).length).toBeGreaterThanOrEqual(2)
  })

  it('adds water with one tap and shows it in the water line', async () => {
    const user = userEvent.setup()
    renderScreen()
    const line = () => screen.getByText(/^Water:/).textContent ?? ''
    expect(line()).toContain('0.8 L in 3 entries')
    await user.click(screen.getByRole('button', { name: 'Add water 250 ml' }))
    expect(line()).toContain('1.0 L in 4 entries')
  })

  it('adds a food from the drawer and keeps the drawer open', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Add food' }))
    const drawer = screen.getByRole('dialog', { name: 'Add food' })
    await user.type(within(drawer).getByLabelText('Search foods'), 'walnut')
    const row = within(drawer).getByRole('group', { name: 'Walnuts' })
    await user.click(within(row).getByRole('button', { name: 'Add Walnuts' }))
    expect(within(row).getByText('Added')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Add food' })).toBeInTheDocument()
  })

  it('refuses portions outside 0.5 to 5', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Add food' }))
    const drawer = screen.getByRole('dialog', { name: 'Add food' })
    await user.type(within(drawer).getByLabelText('Search foods'), 'walnut')
    const row = within(drawer).getByRole('group', { name: 'Walnuts' })
    const field = within(row).getByLabelText('Portions')
    await user.clear(field)
    await user.type(field, '7')
    expect(within(row).getByText('Use 0.5 to 5.')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Add Walnuts' })).toBeDisabled()
  })

  it('removes a meal', async () => {
    const user = userEvent.setup()
    renderScreen()
    const removeButtons = screen.getAllByRole('button', { name: /^Remove (?!last drink)/ })
    const before = removeButtons.length
    await user.click(removeButtons[0]!)
    expect(screen.getAllByRole('button', { name: /^Remove (?!last drink)/ })).toHaveLength(
      before - 1,
    )
  })

  it('opens a nutrient and shows foods that help', async () => {
    const user = userEvent.setup()
    renderScreen()
    const [first] = screen.getAllByRole('button', { name: 'Open details' })
    await user.click(first!)
    const drawer = screen.getByRole('dialog', { name: 'Vitamin D' })
    expect(within(drawer).getByText('Richest in Vitamin D')).toBeInTheDocument()
    expect(within(drawer).getByText('Vitamin D supplement')).toBeInTheDocument()
    expect(within(drawer).getByText(/NASA HRP.*Evidence Report/)).toBeInTheDocument()
    expect(within(drawer).getByTestId('trend')).toBeInTheDocument()
  })

  it('handles twenty meals in one day', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Add food' }))
    const drawer = screen.getByRole('dialog', { name: 'Add food' })
    await user.type(within(drawer).getByLabelText('Search foods'), 'almonds')
    const add = within(within(drawer).getByRole('group', { name: 'Almonds' })).getByRole('button', {
      name: 'Add Almonds',
    })
    for (let i = 0; i < 20; i++) await user.click(add)
    await user.keyboard('{Escape}')
    expect(screen.getAllByText('Almonds').length).toBeGreaterThanOrEqual(20)
  })
})

describe('Nutrition on an empty member profile', () => {
  it('shows no data as missing, never as zero', () => {
    useMemberOnly()
    renderScreen()
    const tiles = screen.getByRole('region', { name: "Today's totals" })
    expect(within(tiles).getAllByText('No data yet')).toHaveLength(4)
    expect(within(tiles).getAllByText('NO DATA')).toHaveLength(4)
    expect(tiles.textContent).not.toMatch(/\b0\b/)
    expect(screen.getAllByText('No data yet').length).toBeGreaterThanOrEqual(10)
    expect(screen.getByText('No food logged yet today.')).toBeInTheDocument()
    expect(screen.getByText('Water: none logged yet')).toBeInTheDocument()
    expect(screen.getByText('NUTRIENTS NO DATA')).toBeInTheDocument()
    expect(screen.queryByText(/OFF TARGET/)).not.toBeInTheDocument()
  })

  it('has an empty body mass state with the weigh-in action, and logs a weight', async () => {
    const user = userEvent.setup()
    useMemberOnly()
    renderScreen()
    expect(screen.getByText('No body mass logged yet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: "Log today's weight" }))
    await user.type(screen.getByLabelText("Log today's weight"), '70')
    await user.click(screen.getByRole('button', { name: 'Log weight' }))
    expect(screen.getAllByText(/70 kg/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('ENTERED').length).toBeGreaterThan(0)
  })

  it('adds water and shows it as entered', async () => {
    const user = userEvent.setup()
    useMemberOnly()
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Add water 250 ml' }))
    expect(screen.getByText(/^Water: 0.3 L in 1 entry/)).toBeInTheDocument()
    expect(screen.getAllByLabelText('Source: entered').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Source: simulated')).not.toBeInTheDocument()
  })

  it('suggests the vitamin D supplement', () => {
    useMemberOnly()
    renderScreen()
    expect(screen.getByText(/No vitamin D logged today/)).toBeInTheDocument()
  })
})
