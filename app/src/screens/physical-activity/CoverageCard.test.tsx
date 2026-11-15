import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CoverageCard, GOAL_MET_TEXT } from './CoverageCard'

describe('CoverageCard', () => {
  it('says the goal is met instead of giving advice for a row at or above its goal', () => {
    render(
      <CoverageCard
        scores={{
          boneLoading: { score: 1, tone: 'ok', actualMinutes: 240 },
          muscle: { score: 0.5, tone: 'danger', actualMinutes: 120 },
          cardiovascular: { score: 1, tone: 'ok', actualMinutes: 320 },
        }}
      />,
    )
    expect(screen.getAllByText(GOAL_MET_TEXT)).toHaveLength(2)
    expect(screen.getByText(/full-load resistive sets/)).toBeInTheDocument()
    expect(screen.queryByText(/stimulate bone remodeling/)).not.toBeInTheDocument()
    expect(screen.queryByText(/raise aerobic endurance/)).not.toBeInTheDocument()
  })
})
