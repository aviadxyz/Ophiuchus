import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acknowledgeAlert,
  cancelAutoAlert,
  createProfile,
  deleteProfileData,
  joinRoom,
  leaveRoom,
  raiseAlert,
  resetDemoProfile,
  setActiveProfile,
  setVitalsWatch,
  useAlerts,
} from '@/data'
import EmergencyScreen from './index'

const askMedbot = vi.hoisted(() => vi.fn())
vi.mock('@/ophi', () => ({ askMedbot }))

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function AlertWatcher() {
  const alerts = useAlerts()
  const openAlert = alerts.find((a) => a.kind === 'emergency' && a.status === 'open')
  return (
    <div data-testid="alert-watcher">
      {openAlert ? `Open alert: ${openAlert.message}` : 'No open alert'}
    </div>
  )
}

function renderScreen(initialRoute = '/emergency') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route
          path="/emergency"
          element={
            <>
              <AlertWatcher />
              <EmergencyScreen />
            </>
          }
        />
        <Route path="/watch" element={<Where />} />
        <Route
          path="/overview"
          element={
            <>
              <AlertWatcher />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Emergency screen', () => {
  beforeEach(() => {
    askMedbot.mockClear()
    setActiveProfile('demo')
    resetDemoProfile()
  })

  afterEach(() => {
    resetDemoProfile()
    vi.useRealTimers()
  })

  it('renders header, delay line, trigger card, empty alerts list, and demonstration notice', () => {
    renderScreen()

    expect(screen.getByRole('heading', { level: 1, name: 'Emergency' })).toBeInTheDocument()
    const summaryList = screen.getByRole('list', { name: 'Summary' })
    expect(within(summaryList).getByText('NO OPEN ALERT')).toBeInTheDocument()

    // Delay line (commDelaySeconds is 240 by default in MISSION)
    expect(screen.getByText(/A signal to Earth takes about/i)).toBeInTheDocument()
    expect(screen.getByText(/4 minutes/i)).toBeInTheDocument()

    // Trigger card
    expect(screen.getByRole('heading', { level: 2, name: 'What is wrong?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hold to send alert' })).toBeInTheDocument()
    expect(screen.getByText('Hold for two seconds. Let go to cancel.')).toBeInTheDocument()

    // Alerts list
    expect(screen.getByRole('heading', { level: 2, name: 'Alerts' })).toBeInTheDocument()
    expect(screen.getByText('No alerts yet.')).toBeInTheDocument()

    // Demonstration line
    expect(
      screen.getByText(
        'Demonstration. No real alert is sent to anyone. In a real emergency, call your local emergency number.',
      ),
    ).toBeInTheDocument()
  })

  it('allows selecting different emergency issue categories', async () => {
    const user = userEvent.setup()
    renderScreen()

    const injuryChip = screen.getByRole('radio', { name: /Injury/i })
    expect(injuryChip).toBeInTheDocument()
    await user.click(injuryChip)
    expect(injuryChip).toHaveAttribute('aria-checked', 'true')
  })

  it('cancels hold if released before 2 seconds', () => {
    vi.useFakeTimers()
    renderScreen()

    const holdButton = screen.getByRole('button', { name: 'Hold to send alert' })

    // Press down
    fireEvent.pointerDown(holdButton, { button: 0 })

    // Advance 1 second (less than 2s)
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Release early
    fireEvent.pointerUp(holdButton)

    // Advance more time
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // No alert should be open
    expect(screen.queryByRole('heading', { level: 2, name: 'Alert sent' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'What is wrong?' })).toBeInTheDocument()
    expect(screen.getByText('No alerts yet.')).toBeInTheDocument()
    expect(screen.getByTestId('alert-watcher')).toHaveTextContent('No open alert')
  })

  it('raises an alert when held for 2 seconds with pointer', () => {
    vi.useFakeTimers()
    renderScreen()

    const holdButton = screen.getByRole('button', { name: 'Hold to send alert' })

    fireEvent.pointerDown(holdButton, { button: 0 })

    act(() => {
      vi.advanceTimersByTime(2100)
    })

    // Should switch to "Alert sent" card
    expect(screen.getByRole('heading', { level: 2, name: 'Alert sent' })).toBeInTheDocument()
    expect(screen.getByText('Help has been asked for. Do these now:')).toBeInTheDocument()

    // Check four numbered steps
    expect(screen.getByText('Tell the nearest crewmate out loud.')).toBeInTheDocument()
    expect(screen.getByText('Stay with the person. Do not leave them alone.')).toBeInTheDocument()
    expect(screen.getByText('Get the medical kit and follow its checklist.')).toBeInTheDocument()
    expect(
      screen.getByText('Note the time and what happened, for the flight surgeon.'),
    ).toBeInTheDocument()

    // Header summary pill should now be ALERT OPEN
    const summaryList = screen.getByRole('list', { name: 'Summary' })
    expect(within(summaryList).getByText('ALERT OPEN')).toBeInTheDocument()

    // Alerts list should display the open alert
    const alertsList = screen.getByRole('list', { name: 'Alerts list' })
    expect(within(alertsList).getByText('Medical emergency')).toBeInTheDocument()
    expect(within(alertsList).getByText('This console')).toBeInTheDocument()
    expect(within(alertsList).getByText('OPEN')).toBeInTheDocument()

    // Store has open alert
    expect(screen.getByTestId('alert-watcher')).toHaveTextContent('Open alert: Medical emergency')
  })

  it('raises an alert with the selected category when held with keyboard (Space or Enter)', () => {
    vi.useFakeTimers()
    renderScreen()

    // Select Injury
    const injuryChip = screen.getByRole('radio', { name: /Injury/i })
    fireEvent.click(injuryChip)

    const holdButton = screen.getByRole('button', { name: 'Hold to send alert' })

    // Keydown Space
    fireEvent.keyDown(holdButton, { key: ' ' })

    act(() => {
      vi.advanceTimersByTime(2100)
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Alert sent' })).toBeInTheDocument()
    const alertsList = screen.getByRole('list', { name: 'Alerts list' })
    expect(within(alertsList).getByText('Injury emergency')).toBeInTheDocument()
    expect(screen.getByTestId('alert-watcher')).toHaveTextContent('Open alert: Injury emergency')
  })

  it('allows cancelling an alert within 10 seconds of raising it', () => {
    vi.useFakeTimers()
    renderScreen()

    const holdButton = screen.getByRole('button', { name: 'Hold to send alert' })
    fireEvent.pointerDown(holdButton, { button: 0 })
    act(() => {
      vi.advanceTimersByTime(2100)
    })

    const alertSentCard = screen
      .getByRole('heading', { level: 2, name: 'Alert sent' })
      .closest('section')!
    expect(alertSentCard).toBeInTheDocument()

    // Cancel button should be present
    const cancelButton = within(alertSentCard).getByRole('button', { name: /cancel/i })
    expect(cancelButton).toBeInTheDocument()

    // Click cancel
    fireEvent.click(cancelButton)

    // Alert should be cancelled, screen reverts to trigger card
    expect(screen.getByRole('heading', { level: 2, name: 'What is wrong?' })).toBeInTheDocument()
    const summaryList = screen.getByRole('list', { name: 'Summary' })
    expect(within(summaryList).getByText('NO OPEN ALERT')).toBeInTheDocument()

    // Alerts list shows CANCELLED
    const alertsList = screen.getByRole('list', { name: 'Alerts list' })
    expect(within(alertsList).getByText('CANCELLED')).toBeInTheDocument()
    expect(screen.getByTestId('alert-watcher')).toHaveTextContent('No open alert')
  })

  it('hides the cancel button on the alert card after 10 seconds have elapsed', () => {
    vi.useFakeTimers()
    renderScreen()

    const holdButton = screen.getByRole('button', { name: 'Hold to send alert' })
    fireEvent.pointerDown(holdButton, { button: 0 })
    act(() => {
      vi.advanceTimersByTime(2100)
    })

    const alertSentCard = screen
      .getByRole('heading', { level: 2, name: 'Alert sent' })
      .closest('section')!
    expect(within(alertSentCard).getByRole('button', { name: /cancel/i })).toBeInTheDocument()

    // Advance 11 seconds
    act(() => {
      vi.advanceTimersByTime(11_000)
    })

    // Cancel button on the alert sent card should no longer be rendered
    expect(within(alertSentCard).queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
  })

  it('allows acknowledging an open alert from the alerts list', () => {
    renderScreen()

    // Raise an alert directly via data store
    act(() => {
      raiseAlert('emergency', 'watch', 'Cabin problem emergency', 'emergency')
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Alert sent' })).toBeInTheDocument()
    const alertsList = screen.getByRole('list', { name: 'Alerts list' })
    expect(within(alertsList).getByText('Cabin problem emergency')).toBeInTheDocument()
    expect(within(alertsList).getByText('Watch')).toBeInTheDocument()

    const ackButton = screen.getByRole('button', { name: 'Acknowledge' })
    expect(ackButton).toBeInTheDocument()

    act(() => {
      fireEvent.click(ackButton)
    })

    // Open alert is acknowledged -> returns to trigger card
    expect(screen.getByRole('heading', { level: 2, name: 'What is wrong?' })).toBeInTheDocument()
    expect(within(alertsList).getByText('ACKNOWLEDGED')).toBeInTheDocument()
    expect(screen.getByTestId('alert-watcher')).toHaveTextContent('No open alert')
  })

  it('calls askMedbot("emergency") when "Talk to the Med bot" is clicked', () => {
    renderScreen()

    act(() => {
      raiseAlert('emergency', 'console', 'Medical emergency', 'emergency')
    })

    const medbotButton = screen.getByRole('button', { name: 'Talk to the Med bot' })
    fireEvent.click(medbotButton)

    expect(askMedbot).toHaveBeenCalledWith('emergency')
  })

  it('updates the store alert state: raised alert creates open alert, acknowledge clears open state', () => {
    const { unmount } = renderScreen('/overview')

    // Initially no alert
    expect(screen.getByTestId('alert-watcher')).toHaveTextContent('No open alert')

    // Raise alert
    let alertId = ''
    act(() => {
      alertId = raiseAlert('emergency', 'console', 'Medical emergency', 'emergency')
    })

    // Store watcher reflects open alert
    expect(screen.getByTestId('alert-watcher')).toHaveTextContent('Open alert: Medical emergency')

    // Acknowledge the alert
    act(() => {
      acknowledgeAlert(alertId)
    })

    // Store watcher reflects cleared open state
    expect(screen.getByTestId('alert-watcher')).toHaveTextContent('No open alert')

    unmount()
  })
})

describe('Emergency screen, automatic alerts', () => {
  beforeEach(() => {
    setActiveProfile('demo')
    resetDemoProfile()
    leaveRoom()
    setVitalsWatch(true)
  })

  afterEach(() => {
    cancelAutoAlert()
    leaveRoom()
    setActiveProfile('demo')
    resetDemoProfile()
    vi.useRealTimers()
  })

  it('says when the device is not linked, and links to the Watch screen', () => {
    renderScreen()
    expect(
      screen.getByText('This device is not linked. Alerts stay on this device.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Link a device' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/watch')
  })

  it('names the crew room when linked', () => {
    joinRoom('ABC234')
    renderScreen()
    expect(screen.getByText('ABC234')).toBeInTheDocument()
    expect(screen.getByText(/Alerts reach every device in this room\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Link a device' })).not.toBeInTheDocument()
  })

  it('shows the two switches and the demonstration buttons', () => {
    renderScreen()
    const card = screen.getByRole('heading', { level: 2, name: 'Automatic alerts' }).closest('section')!
    const vitals = within(card).getByRole('switch', { name: 'Watch my vital signs' })
    expect(vitals).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(vitals)
    expect(vitals).toHaveAttribute('aria-checked', 'false')
    // This test browser has no motion sensor, so fall detection explains and stays off.
    const fall = within(card).getByRole('switch', { name: 'Fall detection on this device' })
    expect(fall).toBeDisabled()
    expect(within(card).getByText(/no motion sensor/)).toBeInTheDocument()
    expect(
      within(card).getByText(
        'Starts the same 10 second countdown as a real detection. Nothing real is sent.',
      ),
    ).toBeInTheDocument()
  })

  it('a simulated fall that nobody answers is sent automatically', () => {
    vi.useFakeTimers()
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Simulate a fall' }))
    expect(screen.getByRole('button', { name: 'Simulate a fall' })).toBeDisabled()
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Alert sent' })).toBeInTheDocument()
    expect(
      screen.getByText('Sent automatically: Fall detected, no response · Flight engineer (test)'),
    ).toBeInTheDocument()
  })

  it('a simulated heart-rate spike answered in time sends nothing', () => {
    vi.useFakeTimers()
    renderScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Simulate a heart-rate spike' }))
    act(() => {
      vi.advanceTimersByTime(4000)
      cancelAutoAlert()
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.getByText('No alerts yet.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'What is wrong?' })).toBeInTheDocument()
  })

  it('shows what is out of balance while an alert is open', () => {
    renderScreen()
    act(() => {
      raiseAlert('emergency', 'console', 'Medical emergency', 'emergency')
    })
    const card = screen
      .getByRole('heading', { level: 2, name: 'What is out of balance' })
      .closest('section')!
    expect(within(card).getByText('Important')).toBeInTheDocument()
    expect(within(card).getByText('Heart rate')).toBeInTheDocument()
    expect(within(card).getByText('Blood oxygen')).toBeInTheDocument()
    expect(within(card).getByText('Also off target today')).toBeInTheDocument()
    expect(
      within(card).getByText('Limits shown here are for demonstration, not clinical limits.'),
    ).toBeInTheDocument()
    expect(within(card).getByText(/Source:/)).toHaveTextContent('Source: to be confirmed')
    expect(within(card).getByText(/tell the flight surgeon/)).toBeInTheDocument()
  })

  it('shows a missing reading as No data, never as a number', () => {
    const id = createProfile({ displayName: 'Test member' })
    setActiveProfile(id)
    renderScreen()
    act(() => {
      raiseAlert('emergency', 'console', 'Medical emergency', 'emergency')
    })
    const card = screen
      .getByRole('heading', { level: 2, name: 'What is out of balance' })
      .closest('section')!
    expect(within(card).getAllByText('No data').length).toBeGreaterThanOrEqual(2)
    setActiveProfile('demo')
    deleteProfileData(id)
  })
})
