import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createProfile,
  deleteProfileData,
  leaveSocial,
  resetDemoProfile,
  setActiveProfile,
  type SharedMood,
  type SocialPerson,
} from '@/data'
import { PersonControl } from './FindCrew'
import SocialScreen from './index'
import { crewMoodLine, moodDisplay, timeAgo } from './moodDisplay'

const NOW = new Date('2026-11-15T12:00:00Z')

const mood = (score: number, tags: string[] = [], hoursAgo = 2): SharedMood => ({
  score,
  tags,
  at: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
  source: 'simulated',
})

const person = (relation: SocialPerson['relation'], score?: number): SocialPerson => ({
  socialId: `p-${relation}-${score ?? 'none'}-${Math.random()}`,
  handle: 'made_up',
  relation,
  mood: score === undefined ? null : mood(score),
  unread: 0,
  source: 'simulated',
})

describe('moodDisplay', () => {
  it.each([
    [1, 'VERY LOW', 'warn'],
    [2, 'LOW', 'warn'],
    [3, 'OKAY', 'neutral'],
    [4, 'GOOD', 'ok'],
    [5, 'VERY GOOD', 'ok'],
  ] as const)('score %i reads %s with tone %s and a face', (score, word, tone) => {
    const look = moodDisplay(mood(score, ['Tired', 'Homesick']), NOW)
    expect(look.word).toBe(word)
    expect(look.tone).toBe(tone)
    expect(look.Icon).toBeTruthy()
    expect(look.tagsText).toBe('Tired · Homesick')
    expect(look.agoText).toBe('2 h ago')
  })

  it('reads NOT SHARED for none', () => {
    const look = moodDisplay(null, NOW)
    expect(look).toMatchObject({ word: 'NOT SHARED', tone: 'neutral', tagsText: '', agoText: '' })
    expect(look.Icon).toBeTruthy()
  })

  it('says how long ago in plain words', () => {
    expect(timeAgo(new Date(NOW.getTime() - 20_000).toISOString(), NOW)).toBe('just now')
    expect(timeAgo(new Date(NOW.getTime() - 12 * 60_000).toISOString(), NOW)).toBe('12 min ago')
    expect(timeAgo(new Date(NOW.getTime() - 50 * 3_600_000).toISOString(), NOW)).toBe('2 d ago')
  })
})

describe('crewMoodLine', () => {
  it('counts a mixed group and leaves out empty groups', () => {
    const friends = [
      person('friend', 4),
      person('friend', 5),
      person('friend', 4),
      person('friend', 2),
      person('friend'),
    ]
    expect(crewMoodLine(friends)).toBe('Crew mood: 3 good or better, 1 low, 1 not shared')
  })
  it('handles an all-good group', () => {
    expect(crewMoodLine([person('friend', 4), person('friend', 5)])).toBe(
      'Crew mood: 2 good or better',
    )
  })
  it('handles nobody sharing', () => {
    expect(crewMoodLine([person('friend'), person('friend')])).toBe('Crew mood: 2 not shared')
  })
  it('gives nothing without friends', () => {
    expect(crewMoodLine([])).toBeNull()
  })
})

describe('the control for each relation', () => {
  it('shows Add friend, Requested · cancel, Accept and FRIEND', () => {
    const { rerender } = render(<PersonControl person={person('none')} disabled={false} />)
    expect(screen.getByRole('button', { name: 'Add friend' })).toBeEnabled()
    rerender(<PersonControl person={person('outgoing')} disabled={false} />)
    expect(screen.getByRole('button', { name: 'Requested · cancel' })).toBeInTheDocument()
    rerender(<PersonControl person={person('incoming')} disabled={false} />)
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
    rerender(<PersonControl person={person('friend')} disabled={false} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('FRIEND')).toBeInTheDocument()
  })
})

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/social']}>
      <SocialScreen />
    </MemoryRouter>,
  )
}

describe('Social screen on the demo profile', () => {
  beforeEach(async () => {
    localStorage.clear()
    resetDemoProfile()
    setActiveProfile('demo')
    await leaveSocial()
  })
  afterEach(async () => {
    vi.useRealTimers()
    await leaveSocial()
  })

  it('joins, shows simulated friends with moods, and chats with a reply', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(screen.getByLabelText('Your handle'), 'demo_star')
    await user.click(screen.getByRole('button', { name: 'Join the crew network' }))

    expect(await screen.findByText('What your friends see')).toBeInTheDocument()
    expect(screen.getByText('2 FRIENDS')).toBeInTheDocument()
    expect(screen.getByText('1 REQUEST')).toBeInTheDocument()
    expect(screen.getByText('MOOD PRIVATE')).toBeInTheDocument()
    expect(screen.getByText('No mood shared today')).toBeInTheDocument()

    const friends = screen.getByRole('list', { name: 'Friends' })
    expect(within(friends).getAllByRole('listitem')).toHaveLength(2)
    expect(within(friends).getAllByText('SIMULATED').length).toBeGreaterThan(0)
    expect(screen.getByText(/Crew mood: 1 good or better, 1 low/)).toBeInTheDocument()
    expect(screen.getByText('A short message can help.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Chat with kestrel_9' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('For anything urgent, use Emergency.')).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox'), 'Thinking of you{Enter}')
    expect(within(dialog).getByText('Thinking of you')).toBeInTheDocument()
    expect(
      await within(dialog).findByText('Good to hear from you. Talk at dinner?', undefined, {
        timeout: 4000,
      }),
    ).toBeInTheDocument()
  })

  it('removes a friend behind a confirmation and leaves the network', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(screen.getByLabelText('Your handle'), 'demo_star')
    await user.click(screen.getByRole('button', { name: 'Join the crew network' }))
    await screen.findByText('What your friends see')

    await user.click(screen.getByRole('button', { name: 'Chat with lunar_lark' }))
    await user.click(await screen.findByRole('button', { name: 'Remove friend' }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: 'Remove friend' }))
    expect(await screen.findByText('1 FRIEND')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Leave the crew network' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Leave' }),
    )
    expect(await screen.findByRole('button', { name: 'Join the crew network' })).toBeInTheDocument()
  })

  it('explains a taken handle in plain words', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(screen.getByLabelText('Your handle'), 'orbit_owl')
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Join the crew network' }))
    })
    expect(screen.getByText('That handle is already taken. Try another one.')).toBeInTheDocument()
  })
})

describe('Social screen on a member profile without the network', () => {
  let memberId = ''
  beforeEach(() => {
    localStorage.clear()
    resetDemoProfile()
    memberId = createProfile({ displayName: 'Test member', role: 'Flight engineer' })
    setActiveProfile(memberId)
  })
  afterEach(() => {
    setActiveProfile('demo')
    deleteProfileData(memberId)
  })

  it('says in one sentence that the network is not connected, with no controls', () => {
    renderScreen()
    expect(
      screen.getByText('The crew network is not connected in this demonstration.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
