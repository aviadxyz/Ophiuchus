import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BodyFigure, type BodyFigureProps } from './BodyFigure'

/** The sixteen systems of the Overview screen, with a mix of statuses. No real data. */
const systems: BodyFigureProps['systems'] = [
  { id: 'brain', label: 'Brain and mind', kind: 'organ', status: 'ok' },
  { id: 'eyes', label: 'Eyes and vision', kind: 'organ', status: 'untracked' },
  { id: 'ears', label: 'Balance and hearing', kind: 'organ', status: 'untracked' },
  { id: 'face', label: 'Nose, sinuses and taste', kind: 'organ', status: 'untracked' },
  { id: 'heart', label: 'Heart and blood vessels', kind: 'organ', status: 'ok' },
  { id: 'lungs', label: 'Lungs and breathing', kind: 'organ', status: 'untracked' },
  { id: 'digestive', label: 'Stomach, liver and gut', kind: 'organ', status: 'watch' },
  { id: 'kidneys', label: 'Kidneys and bladder', kind: 'organ', status: 'watch' },
  { id: 'spine', label: 'Spine and back', kind: 'organ', status: 'untracked' },
  { id: 'bones', label: 'Bones', kind: 'organ', status: 'act' },
  { id: 'muscles', label: 'Muscles', kind: 'organ', status: 'none' },
  { id: 'reproductive', label: 'Reproductive system', kind: 'organ', status: 'untracked' },
  { id: 'blood', label: 'Blood', kind: 'whole-body', status: 'ok' },
  { id: 'immune', label: 'Immune system', kind: 'whole-body', status: 'ok' },
  { id: 'skin', label: 'Skin', kind: 'whole-body', status: 'untracked' },
  { id: 'hormones', label: 'Hormones and metabolism', kind: 'whole-body', status: 'untracked' },
]

const words = {
  ok: 'ON TARGET',
  watch: 'WATCH',
  act: 'ACT',
  none: 'NO DATA',
  untracked: 'NOT TRACKED',
} as const

function control(sys: BodyFigureProps['systems'][number]) {
  return sys.kind === 'organ'
    ? screen.getByRole('button', { name: `${sys.label}, ${words[sys.status]}` })
    : screen.getByRole('radio', { name: `${sys.label} · ${words[sys.status]}` })
}

describe('BodyFigure', () => {
  it('has one control per system, named by label and status, and choosing it reports its id', async () => {
    const onSelect = vi.fn()
    render(<BodyFigure systems={systems} onSelect={onSelect} />)

    expect(systems).toHaveLength(16)
    for (const sys of systems) {
      onSelect.mockClear()
      await userEvent.click(control(sys))
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith(sys.id)
    }
  })

  it('opens every organ system from the keyboard with Enter and Space, in the order given', async () => {
    const onSelect = vi.fn()
    render(<BodyFigure systems={systems} onSelect={onSelect} />)
    const organs = systems.filter((s) => s.kind === 'organ')

    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(
      organs.map((s) => `${s.label}, ${words[s.status]}`),
    )
    for (const sys of organs) {
      const button = control(sys)
      expect(button).toHaveAttribute('tabindex', '0')
      onSelect.mockClear()
      button.focus()
      await userEvent.keyboard('{Enter}')
      await userEvent.keyboard(' ')
      expect(onSelect.mock.calls).toEqual([[sys.id], [sys.id]])
    }
  })

  it('also answers a click on the invisible pointer area of each organ', () => {
    const onSelect = vi.fn()
    const { container } = render(<BodyFigure systems={systems} onSelect={onSelect} />)
    for (const sys of systems.filter((s) => s.kind === 'organ')) {
      const area = container.querySelector(`.bf-hit[data-system="${sys.id}"]`)
      expect(area).not.toBeNull()
      onSelect.mockClear()
      fireEvent.click(area!)
      expect(onSelect).toHaveBeenCalledWith(sys.id)
    }
  })

  it('marks the chosen system without relying on color', () => {
    render(<BodyFigure systems={systems} selectedId="kidneys" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Kidneys and bladder, WATCH' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Bones, ACT' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('beats at the given heart rate and is still when none is given', () => {
    const { container, rerender } = render(
      <BodyFigure systems={systems} onSelect={() => {}} heartRate={75} />,
    )
    const heart = () => container.querySelector<SVGGElement>('[data-heart]')!
    expect(heart()).toHaveClass('bf-beat')
    expect(heart().style.animationDuration).toBe('0.8s')

    rerender(<BodyFigure systems={systems} onSelect={() => {}} heartRate={120} />)
    expect(heart().style.animationDuration).toBe('0.5s')

    rerender(<BodyFigure systems={systems} onSelect={() => {}} />)
    expect(heart()).not.toHaveClass('bf-beat')
    expect(heart().style.animationDuration).toBe('')
  })

  it('switches every animation off when reduced motion is asked for', () => {
    const { container } = render(<BodyFigure systems={systems} onSelect={() => {}} heartRate={60} />)
    const css = container.querySelector('style')!.textContent ?? ''
    const reduced = css.slice(css.indexOf('prefers-reduced-motion'))
    for (const cls of ['.bf-beat', '.bf-breathe', '.bf-flow', '.bf-pulse']) {
      expect(reduced).toContain(cls)
    }
    expect(reduced).toContain('animation: none')
  })

  it('returns focus to the figure control when a system opened there is closed', async () => {
    const onSelect = vi.fn()
    const { rerender } = render(<BodyFigure systems={systems} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: 'Heart and blood vessels, ON TARGET' }))
    rerender(<BodyFigure systems={systems} selectedId="heart" onSelect={onSelect} />)
    ;(document.activeElement as HTMLElement | null)?.blur()
    rerender(<BodyFigure systems={systems} onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: 'Heart and blood vessels, ON TARGET' })).toHaveFocus()
  })
})
