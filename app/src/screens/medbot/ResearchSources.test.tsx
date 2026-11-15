import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { resetDemoProfile } from '@/data'
import MedbotScreen from './index'
import { ResearchSources } from './ResearchSources'
import { readSources, type ChatSource } from './sources'

// The screen talks to a chat endpoint in these tests; the fetch below stands in for it.
vi.mock('@/config', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/config')>()
  return { config: { ...original.config, chatUrl: 'https://chat.example.test' } }
})

const SOURCES: ChatSource[] = [
  {
    title: 'Risk of Spaceflight-Induced Bone Changes - NASA',
    url: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/',
    quote: 'Astronauts undergo routine bone scans before and after spaceflight.',
  },
  {
    title: 'Ongoing HRP Research - NASA',
    url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/',
    quote: 'Scrutinizing scans of astronauts’ spines to inform strategies that counter bone and muscle loss in space',
  },
  {
    title: 'Risks of Human Spaceflight - NASA',
    url: 'https://www.nasa.gov/hrp/risks/',
    quote: 'All astronauts perform exercise during their mission to counteract losses in bone density.',
  },
]

const CLINICIAN_LINE =
  'Taken automatically from NASA and Canadian Space Agency pages. Not reviewed by a clinician.'

function replyWith(body: Record<string, unknown>) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
}

async function askOnScreen(question: string) {
  render(
    <MemoryRouter initialEntries={['/medbot']}>
      <Routes>
        <Route path="/medbot" element={<MedbotScreen />} />
      </Routes>
    </MemoryRouter>,
  )
  await userEvent.type(screen.getByPlaceholderText('Ask a health question'), question)
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))
}

describe('readSources', () => {
  it('treats a missing or malformed field as an empty list', () => {
    expect(readSources(undefined)).toEqual([])
    expect(readSources('nope')).toEqual([])
    expect(readSources([{ title: 'x' }, { title: 'T', url: 'http://plain.example', quote: 'q' }])).toEqual([])
    expect(readSources(SOURCES)).toEqual(SOURCES)
  })
})

describe('ResearchSources', () => {
  it('shows each quote with a link to its page and the clinician line', async () => {
    render(<ResearchSources sources={SOURCES} />)
    expect(screen.getByRole('heading', { name: "From the team's research" })).toBeInTheDocument()
    expect(screen.getByText(`“${SOURCES[0]!.quote}”`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: SOURCES[0]!.title })).toHaveAttribute('href', SOURCES[0]!.url)
    expect(screen.getByRole('link', { name: SOURCES[1]!.title })).toHaveAttribute('target', '_blank')
    expect(screen.getByText(CLINICIAN_LINE)).toBeInTheDocument()

    // More than two: two shown, the rest behind "Show all".
    expect(screen.queryByText(`“${SOURCES[2]!.quote}”`)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(screen.getByText(`“${SOURCES[2]!.quote}”`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: SOURCES[2]!.title })).toHaveAttribute('href', SOURCES[2]!.url)
    expect(screen.queryByRole('button', { name: 'Show all' })).not.toBeInTheDocument()
  })

  it('renders nothing without sources', () => {
    const { container } = render(<ResearchSources sources={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Med bot screen with research sources', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDemoProfile()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    resetDemoProfile()
  })

  it('shows the sources under a reply that has them', async () => {
    replyWith({ reply: 'Bone thins without load.', urgent: false, forward: false, sources: SOURCES.slice(0, 2) })
    await askOnScreen('why do I lose bone in space')
    const heading = await screen.findByRole('heading', { name: "From the team's research" })
    const card = heading.closest('section')!
    expect(within(card).getByText(`“${SOURCES[1]!.quote}”`)).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: SOURCES[1]!.title })).toHaveAttribute('href', SOURCES[1]!.url)
    expect(within(card).queryByRole('button', { name: 'Show all' })).not.toBeInTheDocument()
  })

  it('shows no section for a reply with an empty list', async () => {
    replyWith({ reply: 'Loop, swoop and pull.', urgent: false, forward: false, sources: [] })
    await askOnScreen('how do I tie my shoes')
    await screen.findByText('Loop, swoop and pull.')
    expect(screen.queryByText("From the team's research")).not.toBeInTheDocument()
  })

  it('keeps working when the response has no sources field', async () => {
    replyWith({ reply: 'You are doing fine today.', urgent: false, forward: false })
    await askOnScreen('How am I doing today?')
    await screen.findByText('You are doing fine today.')
    expect(screen.getByText('ONLINE')).toBeInTheDocument()
    expect(screen.queryByText("From the team's research")).not.toBeInTheDocument()
  })

  it('shows no sources next to an urgent reply', async () => {
    replyWith({ reply: 'Open the Emergency screen now.', urgent: true, forward: false, sources: SOURCES })
    await askOnScreen('I have trouble breathing')
    await waitFor(() => expect(screen.getByText('Medical emergency')).toBeInTheDocument())
    expect(screen.queryByText("From the team's research")).not.toBeInTheDocument()
  })
})
