import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProfile, deleteProfileData, setActiveProfile } from '@/data'
import MedicalStatusScreen from './index'

const askMedbot = vi.hoisted(() => vi.fn())
vi.mock('@/ophi', () => ({ askMedbot }))

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/medical-status']}>
      <Routes>
        <Route path="/medical-status" element={<MedicalStatusScreen />} />
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

describe('Medical status', () => {
  it('shows the header pills, the sample line and every section', () => {
    renderScreen()
    expect(screen.getByRole('heading', { level: 1, name: 'Medical status' })).toBeInTheDocument()
    const pills = within(screen.getByRole('list', { name: 'Summary' }))
    expect(pills.getByText('1 ACT')).toBeInTheDocument()
    expect(pills.getByText('4 WATCH')).toBeInTheDocument()
    expect(pills.getByText('2 ON TARGET')).toBeInTheDocument()
    expect(screen.getByText('Sample medical record for demonstration.')).toBeInTheDocument()
    for (const title of [
      'Your condition in plain words',
      'Markers to watch',
      'Where it is active',
      'What makes a flare-up more likely for you',
      'Plan agreed with the flight surgeon',
      'What to do',
      'Key reading',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('puts the marker above its limit first, with its ACT pill', () => {
    renderScreen()
    const tiles = screen.getByRole('region', { name: 'Key markers' })
    expect(within(tiles).getAllByText('ACT')).toHaveLength(1)
    expect(within(tiles).getAllByText('WATCH')).toHaveLength(2)
    expect(within(tiles).getByText('Next sample')).toBeInTheDocument()
    expect(within(tiles).getByText('Every 14 days')).toBeInTheDocument()
    expect(within(tiles).getAllByLabelText(/source: simulated/i)).toHaveLength(4)
  })

  it('says "Source: to be confirmed" under the condition and under each reference', () => {
    renderScreen()
    // The condition and two references are unchecked. The third reference links to its paper.
    expect(screen.getAllByText('Source: to be confirmed')).toHaveLength(3)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://pubmed.ncbi.nlm.nih.gov/31289321/')
  })

  it('shows the sample record on the demo profile only, and never a name', () => {
    const first = renderScreen()
    expect(first.container.textContent).toContain('Inflammatory bowel disease')
    expect(first.container.textContent).not.toMatch(/Demo crew member/)
    first.unmount()
    act(() => {
      memberId = createProfile({ displayName: 'Test member' })
      setActiveProfile(memberId)
    })
    // A member's profile holds only what that person records: no sample condition is shown.
    const second = renderScreen()
    expect(second.container.textContent).not.toContain('Inflammatory bowel disease')
    expect(second.container.textContent).toContain('No medical record has been entered')
    expect(second.container.textContent).not.toMatch(/Test member/)
  })

  it('shows fixed day counts and no calendar dates', () => {
    const { container } = renderScreen()
    const text = container.textContent ?? ''
    expect(text).toContain('7 days ago')
    expect(text).toContain('in 8 days')
    expect(text).not.toMatch(/\b20\d\d\b/)
  })

  it('opens a marker from its tile at the top, and the sample schedule from the last tile', async () => {
    const user = userEvent.setup()
    renderScreen()
    const tiles = within(screen.getByRole('region', { name: 'Key markers' }))
    await user.click(tiles.getByRole('button', { name: /Haemoglobin/ }))
    expect(screen.getByRole('dialog', { name: 'Haemoglobin' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(tiles.getByRole('button', { name: /Next sample/ }))
    const schedule = screen.getByRole('dialog', { name: 'Sample schedule' })
    expect(within(schedule).getByText(/in 8 days/)).toBeInTheDocument()
    expect(within(schedule).getAllByText(/, 07:30/)).toHaveLength(4)
  })

  it('opens a marker with its plain-words meaning, its trend and the baseline line', async () => {
    const user = userEvent.setup()
    renderScreen()
    const row = screen.getByRole('rowheader', { name: /Gut inflammation marker/ }).closest('tr')!
    await user.click(row)
    const drawer = screen.getByRole('dialog', { name: 'Gut inflammation marker' })
    expect(within(drawer).getByText(/protein from white blood cells/)).toBeInTheDocument()
    expect(within(drawer).getAllByText('312 µg/g').length).toBeGreaterThan(0)
    expect(within(drawer).getByText('under 250')).toBeInTheDocument()
    // Each of the three samples is listed with the day and time it was taken.
    expect(within(drawer).getByText('150 µg/g')).toBeInTheDocument()
    expect(within(drawer).getByText('180 µg/g')).toBeInTheDocument()
    expect(within(drawer).getAllByText(/days ago/)).toHaveLength(3)
    expect(within(drawer).getByText(/34 days ago/)).toBeInTheDocument()
    expect(within(drawer).getAllByText(/, 07:30/).length).toBeGreaterThanOrEqual(3)
    expect(
      within(drawer).getByText('Target: personal baseline in this sample record.'),
    ).toBeInTheDocument()
  })

  it('shows no chart in the drawer of a marker without a trend', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('rowheader', { name: /Blood protein/ }).closest('tr')!)
    const drawer = screen.getByRole('dialog', { name: 'Blood protein' })
    expect(within(drawer).queryByRole('img')).not.toBeInTheDocument()
    expect(
      within(drawer).getByText('Target: personal baseline in this sample record.'),
    ).toBeInTheDocument()
  })

  it('opens an area with its finding', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('rowheader', { name: /Rectum/ }).closest('tr')!)
    const drawer = screen.getByRole('dialog', { name: 'Rectum' })
    expect(
      within(drawer).getByText('Mild inflammation at the very end of the bowel.'),
    ).toBeInTheDocument()
    expect(within(drawer).getByText('ACTIVE · MILD')).toBeInTheDocument()
  })

  it('lists five steps and every button does what it says', async () => {
    const user = userEvent.setup()
    renderScreen()
    const steps = screen.getByRole('heading', { name: 'What to do' }).closest('section')!
    expect(within(steps).getAllByRole('listitem')).toHaveLength(5)

    await user.click(within(steps).getByRole('button', { name: 'Ask the Med bot about this' }))
    expect(askMedbot).toHaveBeenCalledWith('medical-status')

    await user.click(within(steps).getByRole('button', { name: 'Open Nutrition' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/nutrition')
  })

  it('goes to Emergency from the last step', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Open Emergency' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/emergency')
  })

  it('has nothing that can be edited', () => {
    renderScreen()
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })
})
