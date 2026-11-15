import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { completeDeviceSetup, resetDeviceSetup } from '@/data'
import { clearMemoryStorage } from '@/data/persistence'
import { installRelay, joinRoom } from '@/data/sources/relay'
import {
  createProfile,
  getActiveProfile,
  raiseAlert,
  resetStoreForTests,
  setActiveProfile,
  useDataStore,
} from '@/data/store'
import { AlertBanner } from './AlertBanner'
import { AppShell } from './AppShell'

function renderShell(path = '/overview') {
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [
          { path: '/overview', element: <p>Overview content</p> },
          { path: '/nutrition', element: <p>Nutrition content</p> },
          { path: '*', element: <p>Other content</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  localStorage.clear()
  clearMemoryStorage()
  resetStoreForTests()
  act(() => resetDeviceSetup())
})

describe('first-open card', () => {
  it('shows instead of the console until a choice is made', () => {
    renderShell()
    expect(screen.getByRole('heading', { name: 'Who is using this device?' })).toBeInTheDocument()
    expect(screen.queryByText('Overview content')).not.toBeInTheDocument()
    expect(screen.getByText('Stays on this device. It is never sent anywhere.')).toBeInTheDocument()
    expect(screen.getByText('Demonstration. Not a medical device.')).toBeInTheDocument()
  })

  it('one tap on the demo path keeps the demo profile and opens the console on the same route', async () => {
    const router = renderShell('/nutrition')
    await userEvent.click(
      screen.getByRole('button', { name: 'Look around with the demo crew member' }),
    )
    expect(await screen.findByText('Nutrition content')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/nutrition')
    expect(getActiveProfile().kind).toBe('demo')
    expect(screen.queryByText('Who is using this device?')).not.toBeInTheDocument()
  })

  it('the crew path creates a member with the chosen role and makes it active', async () => {
    renderShell()
    const start = screen.getByRole('button', { name: 'Start' })
    expect(start).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Display name'), 'Test member')
    await userEvent.click(screen.getByRole('radio', { name: 'Pilot' }))
    expect(start).toBeEnabled()
    await userEvent.click(start)
    expect(await screen.findByText('Overview content')).toBeInTheDocument()
    const active = getActiveProfile()
    expect(active).toMatchObject({ kind: 'member', displayName: 'Test member', role: 'Pilot' })
  })

  it('"Set up this device again" in the profile switcher shows the card again', async () => {
    act(() => completeDeviceSetup())
    renderShell()
    expect(screen.getByText('Overview content')).toBeInTheDocument()
    const switchers = screen.getAllByRole('button', { name: /Change profile/ })
    await userEvent.click(switchers[0]!)
    await userEvent.click(screen.getByRole('button', { name: 'Set up this device again' }))
    expect(screen.getByRole('heading', { name: 'Who is using this device?' })).toBeInTheDocument()
  })
})

describe('phone app', () => {
  beforeEach(() => act(() => completeDeviceSetup()))

  it('has a PHONE tag, a CONSOLE tag and a bottom bar with five items', () => {
    renderShell()
    expect(screen.getByText('PHONE')).toBeInTheDocument()
    expect(screen.getAllByText('CONSOLE').length).toBeGreaterThan(0)
    const bar = within(screen.getByRole('navigation', { name: 'Phone' }))
    expect(bar.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
    expect(bar.getByRole('button', { name: 'Log' })).toBeInTheDocument()
    expect(bar.getByRole('link', { name: 'Med bot' })).toHaveAttribute('href', '/medbot')
    expect(bar.getByRole('link', { name: 'Alerts' })).toHaveAttribute('href', '/emergency')
    expect(bar.getByRole('button', { name: 'More' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument()
  })

  it('Log adds 250 ml of water and says "Added" in place', async () => {
    renderShell()
    const before = useDataStore.getState().data.demo?.water.length ?? 0
    await userEvent.click(screen.getByRole('button', { name: 'Log' }))
    const sheet = within(screen.getByRole('dialog', { name: 'Quick log' }))
    await userEvent.click(sheet.getByRole('button', { name: 'Water +250 ml' }))
    expect(sheet.getByRole('button', { name: 'Added' })).toBeInTheDocument()
    expect(useDataStore.getState().data.demo?.water.length).toBe(before + 1)
  })

  it('Log reaches the food screen', async () => {
    const router = renderShell()
    await userEvent.click(screen.getByRole('button', { name: 'Log' }))
    await userEvent.click(screen.getByRole('button', { name: 'Add food' }))
    expect(router.state.location.pathname).toBe('/nutrition')
    expect(screen.queryByRole('dialog', { name: 'Quick log' })).not.toBeInTheDocument()
  })

  it('setting up again from the More drawer leaves the drawer closed afterwards', async () => {
    renderShell()
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    const drawer = within(screen.getByRole('dialog', { name: 'Menu' }))
    await userEvent.click(drawer.getByRole('button', { name: /Change profile/ }))
    await userEvent.click(drawer.getByRole('button', { name: 'Set up this device again' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Look around with the demo crew member' }),
    )
    expect(await screen.findByText('Overview content')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument()
  })

  it('Alerts shows the count of open emergency alerts', () => {
    raiseAlert('emergency', 'console', 'Test emergency')
    raiseAlert('emergency', 'console', 'Test emergency two')
    renderShell()
    expect(screen.getByRole('link', { name: 'Alerts, 2 open' })).toBeInTheDocument()
  })
})

describe('alerts that say who they came from', () => {
  let stop: () => void
  let channel: BroadcastChannel
  const received: Record<string, unknown>[] = []

  beforeEach(() => {
    received.length = 0
    stop = installRelay()
    channel = new BroadcastChannel('ophiuchus:v1:relay')
    channel.onmessage = (event: MessageEvent) => received.push(event.data)
    joinRoom('ABC234')
  })
  afterEach(() => {
    stop()
    channel.close()
  })

  const wait = () => new Promise((resolve) => setTimeout(resolve, 30))
  const incoming = (alertId: string, payload: Record<string, unknown>) => ({
    id: `msg-${alertId}`,
    room: 'ABC234',
    type: 'emergency.raised',
    at: new Date().toISOString(),
    origin: 'console',
    payload: { alertId, message: 'Test emergency', ...payload },
  })
  const alertById = (id: string) => useDataStore.getState().alerts.find((a) => a.id === id)

  it('stores an incoming alert with the sender role in from', async () => {
    channel.postMessage(incoming('a-role', { role: 'Commander' }))
    await wait()
    expect(alertById('a-role')).toMatchObject({ status: 'open', from: 'Commander' })
  })

  it('stores an incoming alert without a role as from "Another device"', async () => {
    channel.postMessage(incoming('a-none', {}))
    await wait()
    expect(alertById('a-none')?.from).toBe('Another device')
  })

  it('gives an alert raised here no from, and sends the role but never the display name', async () => {
    const id = createProfile({ displayName: 'Test member', role: 'Pilot' })
    setActiveProfile(id)
    const alertId = raiseAlert('emergency', 'console', 'Test emergency')
    await wait()
    expect(alertById(alertId)).not.toHaveProperty('from')
    const sent = received.filter((m) => m.type === 'emergency.raised')
    expect(sent).toHaveLength(1)
    expect(sent[0]?.payload).toMatchObject({ alertId, role: 'Pilot' })
    for (const message of received) expect(JSON.stringify(message)).not.toContain('Test member')
  })

  it('the banner reads "Emergency from [role]" for an incoming alert', async () => {
    channel.postMessage(incoming('a-banner', { role: 'Flight surgeon' }))
    await wait()
    const router = createMemoryRouter([{ path: '/overview', element: <AlertBanner /> }], {
      initialEntries: ['/overview'],
    })
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Emergency from Flight surgeon')
  })

  it('the banner reads "Emergency alert open" for an alert raised here', () => {
    raiseAlert('emergency', 'console', 'Test emergency')
    const router = createMemoryRouter([{ path: '/overview', element: <AlertBanner /> }], {
      initialEntries: ['/overview'],
    })
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Emergency alert open')
  })
})
