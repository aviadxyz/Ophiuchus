import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { leaveRoom, resetDemoProfile } from '@/data'
import WatchScreen from './index'

describe('WatchScreen (app/src/screens/watch)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDemoProfile()
    leaveRoom()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    resetDemoProfile()
    leaveRoom()
  })

  it('renders Watch screen with header, drawn watch, and pairing card', () => {
    render(
      <MemoryRouter>
        <WatchScreen />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Watch' })).toBeInTheDocument()
    expect(screen.getByText('Pair a watch')).toBeInTheDocument()
    expect(screen.getByText('Wearable companion')).toBeInTheDocument()
    expect(screen.getByTestId('watch-app')).toBeInTheDocument()
  })

  it('toggles between round and square bezel', () => {
    render(
      <MemoryRouter>
        <WatchScreen />
      </MemoryRouter>,
    )

    const watch = screen.getByTestId('watch-app')
    expect(watch).toHaveClass('rounded-full')

    const squareRadio = screen.getByRole('radio', { name: 'Square Bezel' })
    fireEvent.click(squareRadio)

    expect(watch).toHaveClass('rounded-3xl')
  })

  it('allows pairing with a valid 6-character room code', () => {
    render(
      <MemoryRouter>
        <WatchScreen />
      </MemoryRouter>,
    )

    const input = screen.getByLabelText(/Pairing code/i)
    fireEvent.change(input, { target: { value: 'ABCDEF' } })

    const pairBtn = screen.getByRole('button', { name: 'Pair' })
    fireEvent.click(pairBtn)

    expect(screen.getByText('PAIRED')).toBeInTheDocument()
    expect(screen.getByText('ABCDEF')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unpair' })).toBeInTheDocument()
  })

  it('allows generating a code with Create code button', () => {
    render(
      <MemoryRouter>
        <WatchScreen />
      </MemoryRouter>,
    )

    const createBtn = screen.getByRole('button', { name: 'Create code' })
    fireEvent.click(createBtn)

    expect(screen.getByText('PAIRED')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unpair' })).toBeInTheDocument()
    expect(screen.getByText(/\/w\?room=/i)).toBeInTheDocument()
  })
})
