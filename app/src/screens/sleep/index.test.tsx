import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createProfile, deleteProfileData, resetDemoProfile, setActiveProfile } from '@/data'
import SleepScreen from './index'
import { range, shortDate, summarizeWeek } from './derive'

const askMedbot = vi.hoisted(() => vi.fn())
vi.mock('@/ophi', () => ({ askMedbot }))

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/sleep']}>
      <Routes>
        <Route path="/sleep" element={<SleepScreen />} />
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
  act(() => resetDemoProfile())
})

const point = (value: number | null) => ({ date: '2026-11-01', value, source: null })

describe('Sleep calculations', () => {
  it('leaves out nights with no record and never counts them as zero', () => {
    const week = summarizeWeek([point(6), point(null), point(8), point(7)], 7)
    expect(week).toEqual({ nights: 3, average: 7, debt: 1, onTarget: 2 })
  })

  it('gives nothing for a week with no record', () => {
    expect(summarizeWeek([point(null)], 7)).toEqual({
      nights: 0,
      average: null,
      debt: null,
      onTarget: 0,
    })
  })

  it('formats a date and finds the lowest reading', () => {
    expect(shortDate('2026-11-04')).toBe('4 Nov')
    expect(range([62, 49, 57])).toEqual({ min: 49, mean: 56, max: 62, minIndex: 1 })
  })
})

describe('Sleep', () => {
  it('shows the demo profile its nights, the sample night and the references', () => {
    renderScreen()
    expect(screen.getByRole('heading', { level: 1, name: 'Sleep' })).toBeInTheDocument()
    const tiles = within(screen.getByRole('region', { name: 'Sleep summary' }))
    expect(tiles.getByText('Last night')).toBeInTheDocument()
    expect(tiles.getByText('Sleep debt, 7 nights')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Last 14 nights' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Last night, hour by hour' })).toBeInTheDocument()
    expect(screen.getByText(/lowest at 03:00/)).toBeInTheDocument()
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('https://pubmed.ncbi.nlm.nih.gov/25127232/')
    expect(hrefs).toContain('https://pubmed.ncbi.nlm.nih.gov/28725719/')
  })

  it('switches what the sample night shows', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('radio', { name: 'Cabin humidity' }))
    expect(screen.getByText(/The air was on the dry side all night/)).toBeInTheDocument()
  })

  it('shows a team member no sample night, and missing data as missing', () => {
    act(() => {
      memberId = createProfile({ displayName: 'Test member' })
      setActiveProfile(memberId)
    })
    const { container } = renderScreen()
    expect(screen.queryByRole('heading', { name: 'Last night, hour by hour' })).toBeNull()
    expect(
      screen.getByText('No night has been recorded yet. Log last night below.'),
    ).toBeInTheDocument()
    expect(container.textContent).toContain('NO DATA')
    expect(container.textContent).not.toMatch(/Test member/)
  })

  it('records last night for a team member, marked as entered', async () => {
    const user = userEvent.setup()
    act(() => {
      memberId = createProfile({ displayName: 'Test member' })
      setActiveProfile(memberId)
    })
    renderScreen()
    await user.type(screen.getByLabelText(/Hours slept/), '6.5')
    await user.click(screen.getByRole('radio', { name: '4 Good' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    const tiles = within(screen.getByRole('region', { name: 'Sleep summary' }))
    expect(tiles.getAllByText('6.5').length).toBeGreaterThan(0)
    expect(tiles.getByLabelText(/source: entered/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Correct last night' })).toBeInTheDocument()
  })

  it('makes the step buttons do what they say', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Ask the Med bot about this' }))
    expect(askMedbot).toHaveBeenCalledWith('sleep')
    await user.click(screen.getByRole('button', { name: 'Open Environment' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/environment')
  })
})
