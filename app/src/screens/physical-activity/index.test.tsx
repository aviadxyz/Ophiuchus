import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createProfile,
  resetDemoProfile,
  setActiveProfile,
  startSimulator,
} from '@/data'
import PhysicalActivityScreen from './index'
import { TodayPrescriptionCard } from './TodayPrescriptionCard'

function renderScreen() {
  return render(
    <MemoryRouter>
      <PhysicalActivityScreen />
    </MemoryRouter>,
  )
}

describe('PhysicalActivityScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDemoProfile()
    setActiveProfile('demo')
  })

  it('renders the header, stat tiles, prescription, coverage, week view and sensor empty state when off', () => {
    renderScreen()

    // 1. Header
    expect(screen.getByText('DOMAIN · EXERCISE COUNTERMEASURES')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Physical activity' })).toBeInTheDocument()

    // 2. Stat tiles
    expect(screen.getByText('Minutes today')).toBeInTheDocument()
    expect(screen.getByText('Resistive this week')).toBeInTheDocument()
    expect(screen.getByText('Aerobic this week')).toBeInTheDocument()

    // 3. Today's prescription card
    expect(
      screen.getByRole('heading', { level: 2, name: "Today's prescription" }),
    ).toBeInTheDocument()

    // 4. Countermeasure coverage card
    expect(
      screen.getByRole('heading', { level: 2, name: 'Countermeasure coverage' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Bone loading')).toBeInTheDocument()
    expect(screen.getByText('Muscle')).toBeInTheDocument()
    expect(screen.getByText('Cardiovascular')).toBeInTheDocument()
    expect(
      screen.getByText('Illustrative model for this demo, not a clinical measure.'),
    ).toBeInTheDocument()

    // 5. Week view
    expect(screen.getByRole('heading', { level: 2, name: 'Week view' })).toBeInTheDocument()

    // 6. Sensor connection is off by default in test mode
    expect(screen.getByText('No heart-rate sensor connected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect sensor/i })).toBeInTheDocument()
  })

  it('renders heart rate stat tile with simulated badge when simulator is running', () => {
    startSimulator()
    renderScreen()
    expect(screen.getByText('Heart rate')).toBeInTheDocument()
    expect(screen.getAllByText('SIMULATED').length).toBeGreaterThanOrEqual(1)
  })

  it('allows marking a session as done, and undoing it', () => {
    renderScreen()

    // Today in seed has 1 done and 1 planned session
    const doneButtons = screen.getAllByRole('button', { name: /^done$/i })
    expect(doneButtons.length).toBeGreaterThan(0)

    // Mark the planned session done
    fireEvent.click(doneButtons[0]!)

    // Now both should be finished, showing Undo buttons
    const undoButtons = screen.getAllByRole('button', { name: /^undo$/i })
    expect(undoButtons.length).toBe(2)

    // Click Undo on one of them
    fireEvent.click(undoButtons[1]!)

    // It returns to planned and Done button appears again
    expect(screen.getByRole('button', { name: /^done$/i })).toBeInTheDocument()
  })

  it('allows marking a session as done with changes', () => {
    renderScreen()

    const changeButton = screen.getByRole('button', { name: /done with changes/i })
    fireEvent.click(changeButton)

    // Expect input for actual minutes
    const input = screen.getByLabelText(/actual minutes/i)
    expect(input).toBeInTheDocument()

    // Change minutes to 45
    fireEvent.change(input, { target: { value: '45' } })

    // Save changes
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    // Expect CHANGED pill and 45 min text
    expect(screen.getByText('CHANGED')).toBeInTheDocument()
    expect(screen.getByText(/45 min/)).toBeInTheDocument()
  })

  it('allows skipping a session with a reason', () => {
    renderScreen()

    const skipButton = screen.getByRole('button', { name: /^skip$/i })
    fireEvent.click(skipButton)

    // Select "Schedule conflict" chip
    const option = screen.getByRole('radio', { name: /schedule conflict/i })
    fireEvent.click(option)

    // Confirm skip
    fireEvent.click(screen.getByRole('button', { name: /confirm skip/i }))

    // Expect SKIPPED pill
    expect(screen.getByText('SKIPPED')).toBeInTheDocument()
    expect(screen.getByText(/Schedule conflict/)).toBeInTheDocument()
  })

  it('shows no zeros pretending to be data on a new member profile', () => {
    // Switch to a new member profile with no logged data
    const memberId = createProfile({ displayName: 'New Astronaut' })
    setActiveProfile(memberId)

    renderScreen()

    // Stat tiles should display missing data ("—" with "NO DATA"), never "0 min" or "0 sessions" pretending to be real data
    const noDataPills = screen.getAllByText('NO DATA')
    expect(noDataPills.length).toBeGreaterThanOrEqual(3)
    const dashes = screen.getAllByLabelText('No data')
    expect(dashes.length).toBeGreaterThanOrEqual(3)
  })
})

describe('TodayPrescriptionCard empty state', () => {
  it('renders EmptyState and allows logging a session when there are no planned sessions', () => {
    render(<TodayPrescriptionCard sessions={[]} />)

    expect(screen.getByText('No sessions planned today.')).toBeInTheDocument()
    const logButton = screen.getByRole('button', { name: /log a session/i })
    fireEvent.click(logButton)

    // Number field appears
    const input = screen.getByLabelText(/minutes/i)
    expect(input).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '40' } })

    // Save
    fireEvent.click(screen.getByRole('button', { name: /save session/i }))
  })
})
