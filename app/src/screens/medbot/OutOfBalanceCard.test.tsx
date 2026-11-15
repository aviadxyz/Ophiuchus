import { beforeEach, describe, expect, it } from 'vitest'
import { render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { metricIds, resetDemoProfile, setActiveProfile, useTargets } from '@/data'
import type { DaySummary, MetricValue } from '@/data'
import MedbotScreen from './index'
import { offTargetMetrics } from './offTarget'
import { UNWELL_QUESTION } from './scriptedReplies'

function onTargetDay(): DaySummary {
  const day = { date: '2026-11-15' } as DaySummary
  for (const id of metricIds) {
    const value: MetricValue = { value: 1, targetId: id, level: 'ok', source: 'simulated' }
    day[id] = value
  }
  return day
}

describe('Out of balance today', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDemoProfile()
    setActiveProfile('demo')
  })

  it('lists an off-target metric and leaves out one on target', () => {
    const { result } = renderHook(() => useTargets())
    const day = onTargetDay()
    day.waterMl = { value: 800, targetId: 'waterMl', level: 'act', source: 'simulated' }
    day.sodiumMg = { value: 3900, targetId: 'sodiumMg', level: 'watch', source: 'simulated' }

    const items = offTargetMetrics(day, result.current)

    expect(items.map((i) => i.id)).toEqual(['waterMl', 'sodiumMg'])
    expect(items[0]).toMatchObject({ name: 'Water', valueText: '800 ml', screenId: 'nutrition' })
    expect(items.some((i) => i.id === 'energyKcal')).toBe(false)
  })

  it('lists nothing when every metric is on target', () => {
    const { result } = renderHook(() => useTargets())
    expect(offTargetMetrics(onTargetDay(), result.current)).toEqual([])
  })

  it('answers the new suggested question offline by pointing to the card, the flight surgeon and Emergency', async () => {
    render(
      <MemoryRouter initialEntries={['/medbot?from=overview']}>
        <Routes>
          <Route path="/medbot" element={<MedbotScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Out of balance today' })).toBeInTheDocument()

    const chips = screen.getByLabelText('Suggested questions')
    await userEvent.click(within(chips).getByRole('button', { name: UNWELL_QUESTION }))

    await waitFor(() => {
      expect(screen.getByText(/Start with the Out of balance today card above/)).toBeInTheDocument()
    })
    const reply = screen.getByText(/Start with the Out of balance today card above/)
    expect(reply.textContent).toMatch(/flight surgeon/)
    expect(reply.textContent).toMatch(/Emergency/)
  })
})
