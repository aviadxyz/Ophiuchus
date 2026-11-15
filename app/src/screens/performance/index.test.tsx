import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProfile, deleteProfileData, levelFor, setActiveProfile, type Target } from '@/data'
import PerformanceScreen from './index'
import { domainOrder, domains } from './sample'

const askMedbot = vi.hoisted(() => vi.fn())
vi.mock('@/ophi', () => ({ askMedbot }))

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/performance']}>
      <Routes>
        <Route path="/performance" element={<PerformanceScreen />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

let memberId: string | null = null

beforeEach(() => {
  askMedbot.mockClear()
  setActiveProfile('demo')
})

afterEach(() => {
  if (memberId) deleteProfileData(memberId)
  memberId = null
})

describe('Performance', () => {
  it('gives every test the level the shared rules give its numbers', () => {
    for (const id of domainOrder) {
      for (const marker of domains[id].markers) {
        const target: Target = {
          id: 'heartRate',
          label: marker.plainName,
          kind: marker.rule.kind,
          value: marker.rule.value,
          unit: marker.unit,
          sourceText: '',
          sourceUrl: '',
          verified: false,
        }
        expect(`${marker.id}: ${levelFor(marker.trend[2], target)}`).toBe(
          `${marker.id}: ${marker.level}`,
        )
      }
    }
  })

  it('opens on the thinking tests, with the header pills and the sample line', () => {
    renderScreen()
    expect(screen.getByRole('heading', { level: 1, name: 'Performance' })).toBeInTheDocument()
    expect(screen.getByText('Sample performance record for demonstration.')).toBeInTheDocument()
    const pills = within(screen.getByRole('list', { name: 'Summary' }))
    expect(pills.getByText('3 WATCH')).toBeInTheDocument()
    expect(pills.getByText('8 ON TARGET')).toBeInTheDocument()
    const tiles = within(screen.getByRole('region', { name: 'Key results' }))
    expect(tiles.getByText('Attention lapses')).toBeInTheDocument()
    expect(tiles.getAllByLabelText(/source: simulated/i)).toHaveLength(4)
  })

  it('shows bone and muscle loss on the physical side, each with dated weekly tests', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('radio', { name: 'Physical' }))
    const tiles = within(screen.getByRole('region', { name: 'Key results' }))
    expect(tiles.getByText('Muscle lost')).toBeInTheDocument()
    await user.click(tiles.getByRole('button', { name: /Hip bone density lost/ }))
    const drawer = screen.getByRole('dialog', { name: 'Hip bone density lost' })
    expect(within(drawer).getByText(/Bones that carry no weight lose mineral/)).toBeInTheDocument()
    expect(within(drawer).getAllByText(/, 09:00/).length).toBeGreaterThanOrEqual(3)
    expect(within(drawer).getByText(/15 days ago/)).toBeInTheDocument()
    expect(within(drawer).getByText(/1 day ago/)).toBeInTheDocument()
    expect(within(drawer).getByText('under 0.5%')).toBeInTheDocument()
  })

  it('links the references that were checked and says which were not', async () => {
    const user = userEvent.setup()
    renderScreen()
    expect(screen.getAllByText('Source: to be confirmed')).toHaveLength(1)
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toContain(
      'https://pubmed.ncbi.nlm.nih.gov/26564759/',
    )
    await user.click(screen.getByRole('radio', { name: 'Physical' }))
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toContain(
      'https://pubmed.ncbi.nlm.nih.gov/15758512/',
    )
  })

  it('makes every plan button do what it says', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Ask the Med bot about this' }))
    expect(askMedbot).toHaveBeenCalledWith('performance')
    await user.click(screen.getByRole('radio', { name: 'Physical' }))
    await user.click(screen.getByRole('button', { name: 'Open Physical activity' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/physical-activity')
  })

  it('shows no sample record on a team member profile, and never a name', () => {
    act(() => {
      memberId = createProfile({ displayName: 'Test member' })
      setActiveProfile(memberId)
    })
    const { container } = renderScreen()
    expect(container.textContent).toContain('No performance tests have been recorded')
    expect(container.textContent).not.toContain('Hip bone density')
    expect(container.textContent).not.toMatch(/Test member/)
  })
})
