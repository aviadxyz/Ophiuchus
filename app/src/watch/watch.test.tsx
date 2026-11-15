import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { acknowledgeAlert, resetDemoProfile } from '@/data'
import { WatchApp } from './WatchApp'
import { EmergencyPage } from './pages/EmergencyPage'
import { MedbotPage } from './pages/MedbotPage'
import { HealthOverviewPage } from './pages/HealthOverviewPage'
import { getWatchScriptedReply } from './scriptedReplies'

describe('Watch App & Components', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDemoProfile()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    resetDemoProfile()
    vi.useRealTimers()
  })

  describe('Emergency page (Requirement 4 & 9)', () => {
    it('hold-to-send completes only after two seconds', () => {
      vi.useFakeTimers()
      render(<EmergencyPage />)

      const btn = screen.getByTestId('emergency-btn')
      expect(screen.queryByText(/Alert sent/i)).not.toBeInTheDocument()

      // Press down
      fireEvent.pointerDown(btn)
      expect(screen.getByText(/Holding\.\.\./i)).toBeInTheDocument()

      // Advance by 1500 ms: should still be holding, alert not sent
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(screen.queryByText(/Alert sent/i)).not.toBeInTheDocument()

      // Advance by remaining 500 ms (total 2000 ms)
      act(() => {
        vi.advanceTimersByTime(500)
      })

      // Alert should now be sent
      expect(screen.getByText(/Alert sent/i)).toBeInTheDocument()
      expect(screen.getByText(/Cancel/i)).toBeInTheDocument()
      expect(screen.getByTestId('sent-container')).toBeInTheDocument()
    })

    it('early release sends nothing', () => {
      vi.useFakeTimers()
      render(<EmergencyPage />)

      const btn = screen.getByTestId('emergency-btn')

      // Press down
      fireEvent.pointerDown(btn)
      expect(screen.getByText(/Holding\.\.\./i)).toBeInTheDocument()

      // Advance 1000 ms (less than 2000 ms)
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Release early
      fireEvent.pointerUp(btn)

      // Advance past the 2000 ms mark
      act(() => {
        vi.advanceTimersByTime(1500)
      })

      // Nothing sent, resets to idle
      expect(screen.queryByText(/Alert sent/i)).not.toBeInTheDocument()
      expect(screen.getByText('SOS')).toBeInTheDocument()
    })

    it('cancel within ten seconds cancels', () => {
      vi.useFakeTimers()
      render(<EmergencyPage />)

      const btn = screen.getByTestId('emergency-btn')
      fireEvent.pointerDown(btn)
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      // Alert is sent
      expect(screen.getByText(/Alert sent/i)).toBeInTheDocument()
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      expect(cancelButton).toBeInTheDocument()

      // Click Cancel within 10s
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      fireEvent.click(cancelButton)

      // Should cancel alert and reset to idle
      expect(screen.queryByText(/Alert sent/i)).not.toBeInTheDocument()
      expect(screen.getByText('SOS')).toBeInTheDocument()
    })

    it('acknowledged status changes the page', () => {
      vi.useFakeTimers()
      render(<EmergencyPage />)

      const btn = screen.getByTestId('emergency-btn')
      fireEvent.pointerDown(btn)
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      const sentContainer = screen.getByTestId('sent-container')
      const alertId = sentContainer.getAttribute('data-alert-id')
      expect(alertId).toBeTruthy()

      // Simulate console acknowledging the alert
      act(() => {
        acknowledgeAlert(alertId!)
      })

      // Watch view updates to "Help is on the way"
      expect(screen.getByText('Help is on the way')).toBeInTheDocument()
      expect(screen.getByText('Console acknowledged')).toBeInTheDocument()
    })
  })

  describe('Talk to the Med bot page (Requirement 3 & 9)', () => {
    it('the offline path answers the three preset questions', async () => {
      render(<MedbotPage />)

      // Button 1: "How am I doing today?"
      const btn1 = screen.getByRole('button', { name: 'How am I doing today?' })
      fireEvent.click(btn1)

      await waitFor(() => {
        expect(screen.getByTestId('offline-badge')).toBeInTheDocument()
      })
      // Reset view by tapping reply
      fireEvent.click(screen.getByTestId('offline-badge'))

      // Button 2: "What should I do next?"
      const btn2 = screen.getByRole('button', { name: 'What should I do next?' })
      fireEvent.click(btn2)

      await waitFor(() => {
        expect(screen.getByTestId('offline-badge')).toBeInTheDocument()
      })
      fireEvent.click(screen.getByTestId('offline-badge'))

      // Button 3: "I don't feel well."
      const btn3 = screen.getByRole('button', { name: "I don't feel well." })
      fireEvent.click(btn3)

      await waitFor(() => {
        expect(screen.getByTestId('offline-badge')).toBeInTheDocument()
        expect(
          screen.getByText(/Sorry to hear that\. If it's serious, hold the Emergency button now\./i),
        ).toBeInTheDocument()
      })
    })

    it('scripted reply helper produces Section 4 responses', () => {
      const dummyCtx = {
        summary: {
          sleep: { level: 'ok' as const, text: 'Slept 7.5h', source: 'simulated' as const },
          food: { level: 'ok' as const, text: '2400 kcal', source: 'simulated' as const },
          water: { level: 'ok' as const, text: '2.5L', source: 'simulated' as const },
          exercise: { level: 'ok' as const, text: '60 min', source: 'simulated' as const },
          mood: { level: 'ok' as const, text: 'Good', source: 'simulated' as const },
          openAlerts: 0,
          ophiLine: 'All looks stable.',
          updatedAt: new Date().toISOString(),
        },
        today: {
          date: '2026-11-15',
          sleepHours: { value: 7.5, level: 'ok' as const, source: 'simulated' as const, targetId: 'sleepHours' as const },
          energyKcal: { value: 2400, level: 'ok' as const, source: 'simulated' as const, targetId: 'energyKcal' as const },
          waterMl: { value: 2500, level: 'ok' as const, source: 'simulated' as const, targetId: 'waterMl' as const },
          proteinG: { value: 90, level: 'ok' as const, source: 'simulated' as const, targetId: 'proteinG' as const },
          sodiumMg: { value: 2000, level: 'ok' as const, source: 'simulated' as const, targetId: 'sodiumMg' as const },
          calciumMg: { value: 1000, level: 'ok' as const, source: 'simulated' as const, targetId: 'calciumMg' as const },
          ironMg: { value: 15, level: 'ok' as const, source: 'simulated' as const, targetId: 'ironMg' as const },
          vitaminDIu: { value: 800, level: 'ok' as const, source: 'simulated' as const, targetId: 'vitaminDIu' as const },
          omega3G: { value: 1.5, level: 'ok' as const, source: 'simulated' as const, targetId: 'omega3G' as const },
          potassiumMg: { value: 3500, level: 'ok' as const, source: 'simulated' as const, targetId: 'potassiumMg' as const },
          exerciseMinutes: { value: 60, level: 'ok' as const, source: 'simulated' as const, targetId: 'exerciseMinutes' as const },
          moodScore: { value: 4, level: 'ok' as const, source: 'simulated' as const, targetId: 'moodScore' as const },
          bodyMassKg: { value: 72, level: 'none' as const, source: 'simulated' as const, targetId: 'bodyMassKg' as const },
          heartRate: { value: 70, level: 'none' as const, source: 'simulated' as const, targetId: 'heartRate' as const },
        },
        targets: {
          sleepHours: { id: 'sleepHours' as const, label: 'Sleep', kind: 'min' as const, value: 7, unit: 'h', sourceText: '', sourceUrl: '', verified: true },
          energyKcal: { id: 'energyKcal' as const, label: 'Energy', kind: 'min' as const, value: 2500, unit: 'kcal', sourceText: '', sourceUrl: '', verified: true },
          waterMl: { id: 'waterMl' as const, label: 'Water', kind: 'min' as const, value: 2500, unit: 'ml', sourceText: '', sourceUrl: '', verified: true },
          proteinG: { id: 'proteinG' as const, label: 'Protein', kind: 'min' as const, value: 80, unit: 'g', sourceText: '', sourceUrl: '', verified: true },
          sodiumMg: { id: 'sodiumMg' as const, label: 'Sodium', kind: 'max' as const, value: 3000, unit: 'mg', sourceText: '', sourceUrl: '', verified: true },
          calciumMg: { id: 'calciumMg' as const, label: 'Calcium', kind: 'min' as const, value: 1000, unit: 'mg', sourceText: '', sourceUrl: '', verified: true },
          ironMg: { id: 'ironMg' as const, label: 'Iron', kind: 'range' as const, value: 10, upper: 20, unit: 'mg', sourceText: '', sourceUrl: '', verified: true },
          vitaminDIu: { id: 'vitaminDIu' as const, label: 'Vitamin D', kind: 'min' as const, value: 800, unit: 'IU', sourceText: '', sourceUrl: '', verified: true },
          omega3G: { id: 'omega3G' as const, label: 'Omega 3', kind: 'min' as const, value: 1.5, unit: 'g', sourceText: '', sourceUrl: '', verified: true },
          potassiumMg: { id: 'potassiumMg' as const, label: 'Potassium', kind: 'min' as const, value: 3500, unit: 'mg', sourceText: '', sourceUrl: '', verified: true },
          exerciseMinutes: { id: 'exerciseMinutes' as const, label: 'Exercise', kind: 'min' as const, value: 60, unit: 'min', sourceText: '', sourceUrl: '', verified: true },
          moodScore: { id: 'moodScore' as const, label: 'Mood', kind: 'min' as const, value: 3, unit: 'score', sourceText: '', sourceUrl: '', verified: true },
          bodyMassKg: { id: 'bodyMassKg' as const, label: 'Body mass', kind: 'range' as const, value: 65, upper: 80, unit: 'kg', sourceText: '', sourceUrl: '', verified: true },
          heartRate: { id: 'heartRate' as const, label: 'Heart rate', kind: 'range' as const, value: 50, upper: 100, unit: 'bpm', sourceText: '', sourceUrl: '', verified: true },
          resistiveSessionsPerWeek: { id: 'resistiveSessionsPerWeek' as const, label: 'Resistive', kind: 'min' as const, value: 6, unit: 'sessions', sourceText: '', sourceUrl: '', verified: true },
          aerobicSessionsPerWeek: { id: 'aerobicSessionsPerWeek' as const, label: 'Aerobic', kind: 'min' as const, value: 6, unit: 'sessions', sourceText: '', sourceUrl: '', verified: true },
        },
      }

      const q1 = getWatchScriptedReply('How am I doing today?', dummyCtx)
      expect(q1).toContain('good shape today')

      const q3 = getWatchScriptedReply("I don't feel well", dummyCtx)
      expect(q3).toContain("Sorry to hear that. If it's serious, hold the Emergency button now.")
    })
  })

  describe('Health overview page (Requirement 2)', () => {
    it('tapping a ring replaces the ophiLine with that area text for 5 seconds', () => {
      vi.useFakeTimers()
      render(<HealthOverviewPage />)

      const sleepRing = screen.getByRole('button', { name: /Sleep:/i })
      expect(sleepRing).toBeInTheDocument()

      // Tap sleep ring
      fireEvent.click(sleepRing)

      // Advance 2 seconds
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      // Advance past 5000 ms -> reverts
      act(() => {
        vi.advanceTimersByTime(3500)
      })
    })
  })

  describe('WatchApp navigation and pagination (Requirement 1)', () => {
    it('navigates through all four pages using pagination dots and arrows', () => {
      render(<WatchApp round={true} />)

      const watch = screen.getByTestId('watch-app')
      expect(watch).toHaveAttribute('data-page', '0')

      // Click dot for page 3 (Emergency)
      const emergencyDot = screen.getByRole('tab', { name: 'Page 3' })
      fireEvent.click(emergencyDot)
      expect(watch).toHaveAttribute('data-page', '2')

      // Arrow left should go to page 1
      fireEvent.keyDown(window, { key: 'ArrowLeft' })
      expect(watch).toHaveAttribute('data-page', '1')

      // Arrow right should go back to page 2
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expect(watch).toHaveAttribute('data-page', '2')
    })
  })
})
