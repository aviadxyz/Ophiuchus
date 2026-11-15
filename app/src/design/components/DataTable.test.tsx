import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable } from '@/design'

function mockPhone(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

const onOpen = vi.fn()
const rows = [
  {
    id: 'a',
    barTone: 'danger' as const,
    cells: ['Bone loss', 'Gravity'],
    pill: { tone: 'danger' as const, label: 'High' },
    onOpen,
  },
  { id: 'b', barTone: 'ok' as const, cells: ['Sleep', 'Isolation'] },
]

afterEach(() => {
  vi.unstubAllGlobals()
  onOpen.mockClear()
})

describe('DataTable', () => {
  it('shows a table with rows on PC', () => {
    mockPhone(false)
    render(<DataTable columns={['Risk', 'Hazard']} rows={rows} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Risk' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Bone loss' })).toBeInTheDocument()
  })

  it('switches to stacked cards under 640 px', async () => {
    mockPhone(true)
    render(<DataTable columns={['Risk', 'Hazard']} rows={rows} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const cards = screen.getAllByRole('listitem')
    expect(cards).toHaveLength(2)
    const first = within(cards[0]!)
    expect(first.getByText('Bone loss')).toBeInTheDocument()
    expect(first.getByText('Hazard')).toBeInTheDocument()
    expect(first.getByText('Gravity')).toBeInTheDocument()
    expect(first.getByText('High')).toBeInTheDocument()
    await userEvent.click(first.getByRole('button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(within(cards[1]!).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows the empty text when there are no rows', () => {
    mockPhone(false)
    render(<DataTable columns={['Risk']} rows={[]} emptyText="Nothing yet." />)
    expect(screen.getByText('Nothing yet.')).toBeInTheDocument()
  })
})
