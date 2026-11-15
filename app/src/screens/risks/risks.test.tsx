/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import {
  addSleep,
  createProfile,
  deleteProfileData,
  resetDemoProfile,
  setActiveProfile,
  toDateString,
} from '@/data'
import RisksScreen from './index'
import { guide } from './guide'
import { meta } from './meta'
import { signsFor, type Reading, type ReadingMap } from './readings'
import { researchItems, researchLinks } from './research.generated'
import { riskSystems } from './systems'

// The research files are read as raw text straight from "DB layer", so the checks below do not
// trust the script that wrote the generated file. This test has its own small CSV reader too.
function readCsv(relativePath: string): Record<string, string>[] {
  const text = readFileSync(
    resolve(process.cwd(), '..', 'DB layer', 'DB', 'draft', relativePath),
    'utf8',
  )
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      if (row.length > 1) rows.push(row)
      row = []
    } else field += char
  }
  const [header, ...body] = rows
  return body.map((cells) =>
    Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ''])),
  )
}

const evidenceRows = readCsv('evidence/evidence.csv')
const exactQuotes = new Set(
  evidenceRows
    .filter((row) => row.verification_status === 'exact_match')
    .map((r) => r.evidence_text),
)
const csvDescriptions = new Set(
  [
    'risk_factors',
    'conditions',
    'treatments',
    'environments',
    'physical_findings',
    'cognitive_findings',
  ]
    .flatMap((table) => readCsv(`entities/${table}.csv`))
    .map((row) => row.description)
    .filter((text) => text !== ''),
)
const sourceUrls = new Set(readCsv('metadata/sources.csv').map((row) => row.source_url))

function reading(overrides: Partial<Reading>): Reading {
  return {
    id: 'calciumMg',
    label: 'Calcium',
    value: 100,
    unit: 'mg',
    level: 'ok',
    source: 'entered',
    hasStatus: true,
    targetText: 'at least 1000 mg',
    sourceText: '',
    sourceUrl: undefined,
    loggedAt: null,
    ...overrides,
  }
}

function readingsFor(ids: Record<string, Reading>): ReadingMap {
  return ids as ReadingMap
}

const skeletal = riskSystems.find((system) => system.id === 'skeletal')!
const cardio = riskSystems.find((system) => system.id === 'cardiovascular')!

describe('the research data', () => {
  it('holds only quotes that appear word for word in evidence.csv with an exact match', () => {
    for (const item of researchItems) {
      for (const quote of item.evidence) expect(exactQuotes, quote.text).toContain(quote.text)
    }
    for (const link of researchLinks) expect(exactQuotes).toContain(link.evidence.text)
  })

  it('carries a source title and an address that exist in sources.csv', () => {
    for (const item of researchItems) {
      for (const quote of item.evidence) {
        expect(quote.sourceTitle).not.toBe('')
        expect(sourceUrls).toContain(quote.sourceUrl)
      }
    }
  })
})

describe('the ten systems', () => {
  it('are in the fixed order', () => {
    expect(riskSystems.map((system) => system.label)).toEqual([
      'Cardiovascular',
      'Pulmonary',
      'Skeletal',
      'Renal',
      'Nervous system',
      'Sleep and psychological',
      'Digestive',
      'Immune',
      'Metabolic',
      'Radiation',
    ])
  })

  it('use only quotes and sentences that are in the research files', () => {
    for (const system of riskSystems) {
      expect(system.evidence.length).toBeLessThanOrEqual(3)
      for (const quote of system.evidence) expect(exactQuotes, quote.text).toContain(quote.text)
      for (const risk of system.risks) {
        if (risk.text)
          expect(csvDescriptions.has(risk.text) || exactQuotes.has(risk.text)).toBe(true)
      }
      const sentences = new Set(system.risks.map((risk) => risk.text))
      for (const quote of system.evidence) expect(sentences.has(quote.text)).toBe(false)
    }
  })

  it('say so in the data when the research has nothing', () => {
    const empty = riskSystems.filter((system) => system.risks.length === 0)
    expect(empty.map((system) => system.id)).toEqual(['renal'])
    expect(empty[0].emptyNote).toMatch(/nothing/i)
    expect(empty[0].evidence).toEqual([])
  })

  it('mark the plain explanations as written by the team', () => {
    for (const system of riskSystems) expect(system.whatItDoesBy).toBe('team')
  })

  it('rank nothing and name no medicine', () => {
    for (const system of riskSystems) {
      expect(Object.keys(system).filter((key) => /severity|rank|rating|score/i.test(key))).toEqual(
        [],
      )
    }
    const text = JSON.stringify(riskSystems.map((s) => [s.risks, s.countermeasures]))
    expect(text).not.toMatch(/antibiotic|vitamin|ibuprofen|aspirin|\bdose\b/i)
  })
})

describe('signsFor', () => {
  it('is NOT TRACKED when the system has no reading', () => {
    const immune = riskSystems.find((system) => system.id === 'immune')!
    expect(signsFor(immune, readingsFor({})).status).toBe('untracked')
  })

  it('never shows on target when a reading is missing', () => {
    const readings = readingsFor({
      calciumMg: reading({ level: 'ok' }),
      vitaminDIu: reading({ id: 'vitaminDIu', level: 'none', value: null, source: null }),
      resistiveSessions: reading({ id: 'resistiveSessions', level: 'ok' }),
    })
    expect(signsFor(skeletal, readings).status).toBe('none')
  })

  it('is on target only when every reading is on target', () => {
    const readings = readingsFor({
      calciumMg: reading({ level: 'ok' }),
      vitaminDIu: reading({ id: 'vitaminDIu', level: 'ok' }),
      resistiveSessions: reading({ id: 'resistiveSessions', level: 'ok' }),
    })
    expect(signsFor(skeletal, readings).status).toBe('ok')
  })

  it('takes the worst level and lists the readings that cause it', () => {
    const readings = readingsFor({
      calciumMg: reading({ level: 'watch' }),
      vitaminDIu: reading({ id: 'vitaminDIu', label: 'Vitamin D', level: 'act' }),
      resistiveSessions: reading({ id: 'resistiveSessions', level: 'none', value: null }),
    })
    const signs = signsFor(skeletal, readings)
    expect(signs.status).toBe('act')
    expect(signs.offTarget.map((r) => r.label)).toEqual(['Vitamin D', 'Calcium'])
  })

  it('lets heart rate show without ever deciding a status', () => {
    const readings = readingsFor({
      exerciseMinutes: reading({ id: 'exerciseMinutes', level: 'none', value: null }),
      heartRate: reading({ id: 'heartRate', level: 'none', hasStatus: false, value: 62 }),
    })
    expect(signsFor(cardio, readings).status).toBe('none')
    readings.exerciseMinutes = reading({ id: 'exerciseMinutes', level: 'ok' })
    expect(signsFor(cardio, readings).status).toBe('ok')
  })
})

describe('the Risks screen', () => {
  afterEach(() => setActiveProfile('demo'))

  it('is marked ready and has all four guide fields', () => {
    expect(meta.status).toBe('ready')
    expect(guide.shows && guide.whyItMatters && guide.whenToAct).toBeTruthy()
    expect(guide.howToRead.length).toBeGreaterThan(0)
  })

  it('shows the header, the note and one row per system on the demo profile', () => {
    resetDemoProfile()
    setActiveProfile('demo')
    render(
      <MemoryRouter>
        <RisksScreen />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Risks' })).toBeInTheDocument()
    expect(screen.getByText('DOMAIN · FLIGHT RISK MAP')).toBeInTheDocument()
    expect(screen.getByText('DRAFT RESEARCH')).toBeInTheDocument()
    expect(screen.getByText(/It has not been reviewed by a clinician\./)).toBeInTheDocument()
    expect(screen.getByText(/^\d+ TO WATCH$/)).toBeInTheDocument()
    for (const system of riskSystems) {
      expect(screen.getAllByText(system.label).length).toBeGreaterThan(0)
    }
    expect(screen.getAllByText('NOT TRACKED').length).toBeGreaterThan(0)
  })

  it('shows WATCH or ACT on the demo profile, and the drawer names the reading behind it', async () => {
    resetDemoProfile()
    setActiveProfile('demo')
    render(
      <MemoryRouter>
        <RisksScreen />
      </MemoryRouter>,
    )
    const flagged = screen.getAllByText(/^(WATCH|ACT)$/)
    expect(flagged.length).toBeGreaterThan(0)

    const row = flagged[0].closest('tr, li')!
    const rowText = row.textContent ?? ''
    const system = riskSystems.find((s) => rowText.includes(s.label))!
    await userEvent.click(within(row as HTMLElement).getAllByRole('button')[0])

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { level: 2, name: system.label }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('What this system does')).toBeInTheDocument()
    expect(within(dialog).getByText('What spaceflight does to it')).toBeInTheDocument()
    expect(within(dialog).getByText('Your signs today')).toBeInTheDocument()
    expect(within(dialog).getByText('What is done about it')).toBeInTheDocument()
    expect(within(dialog).getByText('Evidence')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Ask the Med bot about this' }),
    ).toBeInTheDocument()

    // The flagged reading is named in the row text and in the drawer with its own pill.
    const pillsInDrawer = within(dialog).getAllByText(/^(WATCH|ACT)$/)
    expect(pillsInDrawer.length).toBeGreaterThan(0)
    const readingName = pillsInDrawer[0].closest('li')!.querySelector('span')!.textContent!
    expect(rowText).toContain(readingName)

    // Every quote on screen is word for word in evidence.csv.
    const quotes = within(dialog).getAllByText(/^“.*”$/)
    expect(quotes.length).toBeGreaterThan(0)
    for (const quote of quotes) {
      expect(exactQuotes).toContain((quote.textContent ?? '').slice(1, -1))
    }
    expect(within(dialog).getAllByText(/^Source:/).length).toBeGreaterThanOrEqual(quotes.length)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows no system as ON TARGET for a new member with no data', async () => {
    const id = createProfile({ displayName: 'Test member', role: 'Specialist' })
    setActiveProfile(id)
    render(
      <MemoryRouter>
        <RisksScreen />
      </MemoryRouter>,
    )
    expect(screen.queryByText('ON TARGET')).not.toBeInTheDocument()
    expect(screen.getByText('0 TO WATCH')).toBeInTheDocument()
    expect(screen.getAllByText('NO DATA').length).toBeGreaterThan(0)
    setActiveProfile('demo')
    deleteProfileData(id)
  })

  it('says on screen when the research has nothing for a system', async () => {
    render(
      <MemoryRouter>
        <RisksScreen />
      </MemoryRouter>,
    )
    expect(screen.getAllByText('Nothing in the research yet.').length).toBeGreaterThan(0)
    const renalRow = screen.getAllByText('Renal')[0].closest('tr, li')!
    await userEvent.click(within(renalRow as HTMLElement).getAllByRole('button')[0])
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/has nothing on this system/)).toBeInTheDocument()
  })

  it('shows the flight surgeon sentence when a reading is at ACT, and not otherwise', async () => {
    const id = createProfile({ displayName: 'Test member', role: 'Specialist' })
    setActiveProfile(id)
    addSleep(toDateString(new Date()), 3)
    const { unmount } = render(
      <MemoryRouter>
        <RisksScreen />
      </MemoryRouter>,
    )
    expect(screen.getByText('1 TO WATCH')).toBeInTheDocument()
    const row = screen.getAllByText('Sleep and psychological')[0].closest('tr, li') as HTMLElement
    expect(within(row).getByText('ACT')).toBeInTheDocument()
    await userEvent.click(within(row).getAllByRole('button')[0])
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('If this stays off target, raise it with the flight surgeon.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Sleep')).toBeInTheDocument()
    expect(within(dialog).getByText('3 h')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const immune = screen.getAllByText('Immune')[0].closest('tr, li') as HTMLElement
    await userEvent.click(within(immune).getAllByRole('button')[0])
    const second = await screen.findByRole('dialog')
    expect(
      within(second).getByText('This app does not track a reading for this system.'),
    ).toBeInTheDocument()
    expect(
      within(second).queryByText('If this stays off target, raise it with the flight surgeon.'),
    ).not.toBeInTheDocument()
    unmount()
    setActiveProfile('demo')
    deleteProfileData(id)
  })
})
