import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createProfile, deleteProfileData, setActiveProfile } from '@/data'
import EnvironmentScreen from './index'
import { environmentMetrics } from './metrics'

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/environment']}>
      <EnvironmentScreen />
    </MemoryRouter>,
  )
}

/** The nine tiles, read as text, without the clock-dependent numbers. */
function tileNames() {
  return screen
    .getAllByRole('button', { name: /Open details/ })
    .map((button) => button.textContent ?? '')
}

let memberId: string | null = null

beforeEach(() => setActiveProfile('demo'))
afterEach(() => {
  if (memberId) deleteProfileData(memberId)
  memberId = null
})

describe('Environment', () => {
  it('shows the header, the simulated line and nine tiles in three groups', () => {
    renderScreen()
    expect(screen.getByRole('heading', { level: 1, name: 'Environment' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'Summary' })).getByText('SIMULATED'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/These values are simulated\. The app has no cabin sensor\./),
    ).toBeInTheDocument()
    for (const group of ['Air', 'Cabin', 'Radiation']) {
      expect(screen.getByRole('region', { name: group })).toBeInTheDocument()
    }
    expect(tileNames()).toHaveLength(9)
    for (const metric of environmentMetrics) {
      expect(screen.getByText(metric.name)).toBeInTheDocument()
    }
    expect(screen.getAllByText('SIMULATED').length).toBeGreaterThanOrEqual(9)
  })

  it('shows the same values on the demo profile and on a member profile', () => {
    const demo = renderScreen()
    const demoTiles = tileNames()
    demo.unmount()
    memberId = createProfile({ displayName: 'Test Person' })
    setActiveProfile(memberId)
    renderScreen()
    expect(tileNames()).toEqual(demoTiles)
  })

  it('opens a drawer for every tile with the chart, extremes, advice and source', async () => {
    const user = userEvent.setup()
    renderScreen()
    for (const metric of environmentMetrics) {
      await user.click(screen.getByText(metric.name).closest('button')!)
      const drawer = screen.getByRole('dialog', { name: metric.name })
      for (const heading of [
        'What this is',
        'The last 24 hours',
        'What it does to the body',
        'What to do',
      ]) {
        expect(within(drawer).getByText(heading)).toBeInTheDocument()
      }
      expect(within(drawer).getByText('Highest')).toBeInTheDocument()
      expect(within(drawer).getByText('Lowest')).toBeInTheDocument()
      expect(within(drawer).getByText(/^Source:/)).toBeInTheDocument()
      expect(
        within(drawer).getByText(/24 hours, one value per hour/, { selector: 'figcaption' }),
      ).toBeInTheDocument()
      for (const link of metric.links) {
        expect(
          within(drawer).getByRole('link', { name: `Related: ${link.label}` }),
        ).toHaveAttribute('href', link.to)
      }
      await user.click(within(drawer).getByRole('button', { name: 'Close' }))
    }
  })

  it('says a limit is to be confirmed when it is not verified', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByText('Oxygen').closest('button')!)
    expect(
      within(screen.getByRole('dialog')).getByText(/Source: to be confirmed/),
    ).toBeInTheDocument()
  })

  it('links the connecting card to Physical activity, Sleep and Risks', () => {
    renderScreen()
    const card = within(screen.getByText('How this connects to your health').closest('section')!)
    expect(card.getByRole('link', { name: 'Physical activity' })).toHaveAttribute(
      'href',
      '/physical-activity',
    )
    expect(card.getByRole('link', { name: 'Sleep' })).toHaveAttribute('href', '/sleep')
    expect(card.getByRole('link', { name: 'Risks' })).toHaveAttribute('href', '/risks')
  })
})
