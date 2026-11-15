import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createProfile,
  deleteProfileData,
  joinSocial,
  leaveSocial,
  removeFriend,
  resetDemoProfile,
  setActiveProfile,
  setChallengeJoined,
  type ChallengeEntry,
} from '@/data'
import SocialScreen from './index'
import { confirmMessage, positions, scoreWords } from './challengeText'

const entry = (handle: string, score: number): ChallengeEntry => ({
  socialId: handle,
  handle,
  score,
  me: false,
  source: 'simulated',
})

describe('challenge words', () => {
  it('says the score in words', () => {
    expect(scoreWords('exercise', 68)).toBe('68% of the plan')
    expect(scoreWords('nutrition', 4)).toBe('4 of 7 days')
    expect(scoreWords('nutrition', 1)).toBe('1 of 7 days')
  })

  it('gives tied scores the same position', () => {
    expect(
      positions([entry('a', 80), entry('b', 80), entry('c', 50), entry('d', 50), entry('e', 10)]),
    ).toEqual([1, 1, 3, 3, 5])
  })

  it('says exactly what is shared', () => {
    expect(confirmMessage('nutrition')).toBe(
      'Your friends who also take part will see one number: how many days this week your energy, water and protein were all on target. They never see your meals, your minutes, your body mass or anything else. You can leave at any time and your number is removed at once.',
    )
  })
})

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/social']}>
      <SocialScreen />
    </MemoryRouter>,
  )
}

describe('Crew challenges on the Social screen', () => {
  let memberId: string | null = null

  beforeEach(async () => {
    localStorage.clear()
    resetDemoProfile()
    setActiveProfile('demo')
    await leaveSocial()
  })

  afterEach(async () => {
    setActiveProfile('demo')
    await leaveSocial()
    if (memberId) deleteProfileData(memberId)
    memberId = null
  })

  it('explains that the crew network comes first', () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: 'Crew challenges' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Join the crew network above to take part in crew challenges with your friends.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Take part' })).not.toBeInTheDocument()
  })

  it('asks first, then shows the simulated crew, and leaving empties the board', async () => {
    const user = userEvent.setup()
    await joinSocial('demo_star', false)
    renderScreen()

    expect(screen.getByText('Exercise this week')).toBeInTheDocument()
    expect(screen.getByText('Food and water this week')).toBeInTheDocument()
    const switches = screen.getAllByRole('switch', { name: 'Take part' })
    expect(switches).toHaveLength(2)
    for (const s of switches) expect(s).toHaveAttribute('aria-checked', 'false')

    // Turning it on asks first; cancelling changes nothing.
    await user.click(switches[0]!)
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(confirmMessage('exercise'))).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(switches[0]).toHaveAttribute('aria-checked', 'false')

    await user.click(switches[0]!)
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Take part' }),
    )
    const board = await screen.findByRole('list', { name: 'Exercise this week board' })
    expect(within(board).getByText('lunar_lark')).toBeInTheDocument()
    expect(within(board).getByText('kestrel_9')).toBeInTheDocument()
    expect(within(board).getByText('82% of the plan')).toBeInTheDocument()
    expect(within(board).getAllByText('SIMULATED').length).toBeGreaterThanOrEqual(2)
    expect(within(board).getByText('You')).toBeInTheDocument()
    expect(within(board).getAllByRole('progressbar').length).toBeGreaterThanOrEqual(2)

    // The other switch works the same way.
    await user.click(screen.getAllByRole('switch', { name: 'Take part' })[1]!)
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Take part' }),
    )
    const food = await screen.findByRole('list', { name: 'Food and water this week board' })
    expect(within(food).getByText('lunar_lark')).toBeInTheDocument()

    // Leaving needs no confirmation and the board goes at once.
    await user.click(screen.getAllByRole('switch', { name: 'Take part' })[0]!)
    expect(screen.queryByRole('list', { name: 'Exercise this week board' })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Food and water this week board' })).toBeInTheDocument()
  })

  it('links to where each score is earned', async () => {
    await joinSocial('demo_star', false)
    renderScreen()
    expect(screen.getByRole('link', { name: 'Physical activity' })).toHaveAttribute(
      'href',
      '/physical-activity',
    )
    expect(screen.getByRole('link', { name: 'Nutrition' })).toHaveAttribute('href', '/nutrition')
  })

  it('says when no friend takes part', async () => {
    await joinSocial('demo_star', false)
    // With both simulated friends removed, nobody else is on the board.
    await removeFriend('sim-lunar-lark')
    await removeFriend('sim-kestrel-9')
    await setChallengeJoined('exercise', true)
    renderScreen()
    expect(
      screen.getByText(
        'No friend is taking part yet. They choose for themselves in their own Social screen.',
      ),
    ).toBeInTheDocument()
  })

  it('explains that the network cannot be reached for a member profile', () => {
    memberId = createProfile({ displayName: 'Test member', role: 'Flight engineer' })
    setActiveProfile(memberId)
    renderScreen()
    expect(
      screen.getByText(
        'The crew network cannot be reached, so crew challenges are not available right now.',
      ),
    ).toBeInTheDocument()
  })
})
