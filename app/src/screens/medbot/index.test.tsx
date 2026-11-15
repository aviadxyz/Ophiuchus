import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { resetDemoProfile } from '@/data'
import MedbotScreen from './index'
import { getOpeningLine, getScriptedReply } from './scriptedReplies'
import { buildChatContext } from './context'
import { isForwardingText, isUrgentText } from './words'

function renderMedbot(route = '/medbot') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/medbot" element={<MedbotScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Med bot screen', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDemoProfile()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    resetDemoProfile()
  })

  describe('Opening lines (Section 3)', () => {
    it('returns the correct opening line for known and unknown from query params', () => {
      // Known screens
      expect(getOpeningLine('nutrition')).toBe(
        "You came from Nutrition. Want me to go through what you've eaten today, or look at one nutrient?",
      )
      expect(getOpeningLine('physical-activity')).toBe(
        "You came from Physical activity. I can explain today's sessions or what this week is missing.",
      )
      expect(getOpeningLine('sleep')).toBe(
        'You came from Sleep. Shall we look at the last few nights together?',
      )
      expect(getOpeningLine('mood')).toBe(
        'Hi. No rush. Tell me how today has been, in whatever words you like.',
      )
      expect(getOpeningLine('risks')).toBe(
        "You came from Risks. Pick a body system and I'll explain what spaceflight does to it.",
      )
      expect(getOpeningLine('medical-status')).toBe(
        'You came from Medical status. What would you like to understand better?',
      )
      expect(getOpeningLine('emergency')).toBe(
        "I'm here. Tell me what's happening in a few words.",
      )
      expect(getOpeningLine('social')).toBe(
        'You came from Social. Worried about a crewmate, or about yourself?',
      )
      // Other registered screen
      expect(getOpeningLine('overview')).toBe(
        'You came from Overview. What would you like to know about it?',
      )

      // Unknown or direct
      expect(getOpeningLine('nonexistent-screen')).toBe(
        "Hi, I'm the Med bot. Ask me about your health data, or just tell me how you're doing.",
      )
      expect(getOpeningLine('')).toBe(
        "Hi, I'm the Med bot. Ask me about your health data, or just tell me how you're doing.",
      )
      expect(getOpeningLine(null)).toBe(
        "Hi, I'm the Med bot. Ask me about your health data, or just tell me how you're doing.",
      )
    })

    it('renders the opening line and dismissible context chip when arriving from Nutrition', async () => {
      renderMedbot('/medbot?from=nutrition')

      expect(
        screen.getByText(
          "You came from Nutrition. Want me to go through what you've eaten today, or look at one nutrient?",
        ),
      ).toBeInTheDocument()

      const chip = screen.getByText('Talking about: Nutrition')
      expect(chip).toBeInTheDocument()

      // Dismiss chip
      const dismissBtn = screen.getByRole('button', { name: 'Dismiss context' })
      await userEvent.click(dismissBtn)
      expect(screen.queryByText('Talking about: Nutrition')).not.toBeInTheDocument()
    })

    it('renders the direct opening line without chip when opened directly or from unknown screen', () => {
      renderMedbot('/medbot?from=unknown_screen')
      expect(
        screen.getByText(
          "Hi, I'm the Med bot. Ask me about your health data, or just tell me how you're doing.",
        ),
      ).toBeInTheDocument()
      expect(screen.queryByText(/Talking about:/)).not.toBeInTheDocument()
    })
  })

  describe('Offline and scripted fallback (Section 4)', () => {
    it('shows OFFLINE pill when no chat endpoint is configured', () => {
      renderMedbot('/medbot')
      expect(screen.getByText('OFFLINE')).toBeInTheDocument()
    })

    it('answers quick questions with scripted replies marked with offline note', async () => {
      renderMedbot('/medbot')

      const input = screen.getByPlaceholderText('Ask a health question')
      const sendButton = screen.getByRole('button', { name: 'Send' })

      // Ask: "How am I doing today?"
      await userEvent.type(input, 'How am I doing today?')
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText('offline')).toBeInTheDocument()
      })
      // Should give a scripted summary response
      expect(
        screen.getByText(
          /You're in good shape today|Mostly good|A tougher day/,
        ),
      ).toBeInTheDocument()
    })

    it('handles "I don\'t feel well." offline with advice to sit down and hold emergency', async () => {
      renderMedbot('/medbot')

      const input = screen.getByPlaceholderText('Ask a health question')
      const sendButton = screen.getByRole('button', { name: 'Send' })

      await userEvent.type(input, "I don't feel well.")
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(
          screen.getByText(
            /Sorry to hear that\. If it's serious, hold the Emergency button now\./,
          ),
        ).toBeInTheDocument()
      })
    })

    it('answers arbitrary offline questions with the basic brain offline response', () => {
      const reply = getScriptedReply('Who was the first person in space?', {
        summary: {
          sleep: { level: 'ok', text: '8h', source: 'simulated' },
          food: { level: 'ok', text: '2500 kcal', source: 'simulated' },
          water: { level: 'ok', text: '2 L', source: 'simulated' },
          exercise: { level: 'ok', text: '60 min', source: 'simulated' },
          mood: { level: 'ok', text: 'Good', source: 'simulated' },
          openAlerts: 0,
          ophiLine: 'On track',
          updatedAt: '2026-11-15T00:00:00Z',
        },
        today: {
          date: '2026-11-15',
          sleepHours: { value: 8, targetId: 'sleepHours', level: 'ok', source: 'simulated' },
          energyKcal: { value: 2500, targetId: 'energyKcal', level: 'ok', source: 'simulated' },
          waterMl: { value: 2000, targetId: 'waterMl', level: 'ok', source: 'simulated' },
          exerciseMinutes: { value: 60, targetId: 'exerciseMinutes', level: 'ok', source: 'simulated' },
          moodScore: { value: 4, targetId: 'moodScore', level: 'ok', source: 'simulated' },
          proteinG: { value: 90, targetId: 'proteinG', level: 'ok', source: 'simulated' },
          sodiumMg: { value: 2000, targetId: 'sodiumMg', level: 'ok', source: 'simulated' },
          calciumMg: { value: 1000, targetId: 'calciumMg', level: 'ok', source: 'simulated' },
          ironMg: { value: 10, targetId: 'ironMg', level: 'ok', source: 'simulated' },
          vitaminDIu: { value: 800, targetId: 'vitaminDIu', level: 'ok', source: 'simulated' },
          omega3G: { value: 1.5, targetId: 'omega3G', level: 'ok', source: 'simulated' },
          potassiumMg: { value: 3000, targetId: 'potassiumMg', level: 'ok', source: 'simulated' },
          bodyMassKg: { value: 75, targetId: 'bodyMassKg', level: 'ok', source: 'simulated' },
          heartRate: { value: 65, targetId: 'heartRate', level: 'none', source: 'simulated' },
        },
        targets: {} as never,
      })
      expect(reply).toBe(
        "I can't reach my full brain right now, so I can only answer the basics. Try one of the quick questions, and use Emergency if it's urgent.",
      )
    })
  })

  describe('Urgent handling and Flight Surgeon Forwarding', () => {
    it('shows Emergency card at once and NO forwarding card for urgent messages like chest pain', async () => {
      renderMedbot('/medbot')

      const input = screen.getByPlaceholderText('Ask a health question')
      const sendButton = screen.getByRole('button', { name: 'Send' })

      await userEvent.type(input, 'I have chest pain and my arm feels numb')
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText('Medical emergency')).toBeInTheDocument()
        expect(
          screen.getByRole('button', { name: 'Open Emergency' }),
        ).toBeInTheDocument()
      })

      // Forwarding card must NOT be present
      expect(
        screen.queryByText('This is one for the flight surgeon'),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('Send this to the flight surgeon'),
      ).not.toBeInTheDocument()
    })

    it('shows the forwarding card for medication questions, prefilled with summary', async () => {
      renderMedbot('/medbot')

      const input = screen.getByPlaceholderText('Ask a health question')
      const sendButton = screen.getByRole('button', { name: 'Send' })

      await userEvent.type(input, 'What dose of medicine should I take for headache?')
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText('This is one for the flight surgeon')).toBeInTheDocument()
      })

      // Emergency card must NOT be shown
      expect(screen.queryByText('Medical emergency')).not.toBeInTheDocument()

      const summaryField = screen.getByRole('textbox', { name: 'Summary' })
      expect(summaryField).toHaveValue('What dose of medicine should I take for headache?')

      // Primary send button is present
      const sendSurgeonBtn = screen.getByRole('button', { name: 'Send to flight surgeon' })
      expect(sendSurgeonBtn).toBeInTheDocument()
    })

    it('sending to flight surgeon raises health alert and updates sent list and header pill', async () => {
      renderMedbot('/medbot')

      const input = screen.getByPlaceholderText('Ask a health question')
      const sendButton = screen.getByRole('button', { name: 'Send' })

      await userEvent.type(input, 'What dose of medicine should I take for headache?')
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText('This is one for the flight surgeon')).toBeInTheDocument()
      })

      const sendSurgeonBtn = screen.getByRole('button', { name: 'Send to flight surgeon' })
      await userEvent.click(sendSurgeonBtn)

      // Alert should now be in Sent to flight surgeon card
      await waitFor(() => {
        expect(screen.getByText('WAITING FOR REPLY')).toBeInTheDocument()
        expect(screen.getByText('1 SENT TO SURGEON')).toBeInTheDocument()
      })

      // Withdraw button is present
      const withdrawBtn = screen.getByRole('button', { name: 'Withdraw' })
      expect(withdrawBtn).toBeInTheDocument()

      // Clicking withdraw cancels the alert
      await userEvent.click(withdrawBtn)

      await waitFor(() => {
        expect(screen.getByText('WITHDRAWN')).toBeInTheDocument()
        expect(screen.queryByText('1 SENT TO SURGEON')).not.toBeInTheDocument()
      })
    })

    it('provides quiet button "Send this to the flight surgeon" for non-forwarded assistant replies', async () => {
      renderMedbot('/medbot')

      const input = screen.getByPlaceholderText('Ask a health question')
      const sendButton = screen.getByRole('button', { name: 'Send' })

      await userEvent.type(input, 'How is the weather today?')
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Send this to the flight surgeon' })).toBeInTheDocument()
      })

      // Clicking quiet button opens the forwarding card
      await userEvent.click(screen.getByRole('button', { name: 'Send this to the flight surgeon' }))
      expect(screen.getByText('This is one for the flight surgeon')).toBeInTheDocument()
    })

    it('"Clear conversation" resets messages without touching sent alerts', async () => {
      renderMedbot('/medbot')

      const input = screen.getByPlaceholderText('Ask a health question')
      const sendButton = screen.getByRole('button', { name: 'Send' })

      await userEvent.type(input, 'What dose of medicine should I take for headache?')
      await userEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText('This is one for the flight surgeon')).toBeInTheDocument()
      })
      await userEvent.click(screen.getByRole('button', { name: 'Send to flight surgeon' }))

      await waitFor(() => {
        expect(screen.getByText('WAITING FOR REPLY')).toBeInTheDocument()
      })

      // Clear conversation
      const clearBtn = screen.getByRole('button', { name: 'Clear conversation' })
      await userEvent.click(clearBtn)

      // Sent alerts list is preserved
      expect(screen.getByText('WAITING FOR REPLY')).toBeInTheDocument()
      // Conversation is reset to opening line
      const log = screen.getByRole('log')
      expect(within(log).queryByText('What dose of medicine should I take for headache?')).not.toBeInTheDocument()
      expect(within(log).getByText("Hi, I'm the Med bot. Ask me about your health data, or just tell me how you're doing.")).toBeInTheDocument()
    })
  })

  describe('Context Builder and Word Detection', () => {
    it('correctly detects urgent wording and forwarding words', () => {
      expect(isUrgentText('I feel chest pain')).toBe(true)
      expect(isUrgentText('trouble breathing tonight')).toBe(true)
      expect(isUrgentText('normal question about food')).toBe(false)

      expect(isForwardingText('what dose of pill')).toBe(true)
      expect(isForwardingText('symptom got worse over 4 days')).toBe(true)
      expect(isForwardingText('how is my sleep')).toBe(false)
    })

    it('buildChatContext excludes private data when consent is off', () => {
      const context = buildChatContext({
        screenLabel: 'Med bot',
        mission: {
          name: 'Ophiuchus-1',
          day: 14,
          lengthDays: 180,
          location: 'mars-transit',
          commDelaySeconds: 240,
        },
        profile: {
          kind: 'member',
          consent: { assistant: false },
        },
        today: {} as never,
        targets: {} as never,
      })

      expect(context).toContain('screen: Med bot')
      expect(context).toContain('mission: Ophiuchus-1, day 14 of 180, mars-transit, one-way delay to Earth 4 minutes')
      expect(context).toContain('reply mode: standard')
      expect(context).not.toContain('sleep:')
      expect(context).not.toContain('food:')
      expect(context).not.toContain('mood:')
    })
  })
})
