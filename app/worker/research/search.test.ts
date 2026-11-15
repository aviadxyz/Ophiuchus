import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { researchPassages } from './research.generated.ts'
import { findPassages, MAX_PASSAGES, MAX_PER_SOURCE, MAX_QUOTE_CHARS } from './search.ts'
import { renderResearchFile } from '../tools/export-research.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const draftDir = resolve(here, '../../../DB layer/DB/draft')
const generatedFile = resolve(here, 'research.generated.ts')
const hasResearch = existsSync(draftDir)

// Raw CSV text, read straight from "DB layer" so the check does not trust the export script.
// A quote holding a double quote is stored with it doubled.
const evidenceCsv = hasResearch ? readFileSync(resolve(draftDir, 'evidence/evidence.csv'), 'utf8') : ''
const inEvidenceCsv = (quote: string) =>
  evidenceCsv.includes(quote) || evidenceCsv.includes(quote.replaceAll('"', '""'))

const QUESTIONS = [
  'why do I lose bone in space',
  'what does radiation do to me',
  'what exercise should I do today?',
  'how does my immune system change',
  'my eyes are blurry',
  'I keep getting short nights of sleep',
  'is the food on board enough',
]

describe('findPassages', () => {
  it('finds passages about bone for a bone question', () => {
    const passages = findPassages('why do I lose bone in space', 'Med bot')
    expect(passages.length).toBeGreaterThan(0)
    for (const passage of passages) {
      expect(`${passage.quote} ${passage.terms.join(' ')}`.toLowerCase()).toMatch(/bone/)
    }
  })

  it('finds passages about radiation for a radiation question', () => {
    const passages = findPassages('what does radiation do to me', 'Med bot')
    expect(passages.length).toBeGreaterThan(0)
    for (const passage of passages) {
      expect(`${passage.quote} ${passage.terms.join(' ')}`.toLowerCase()).toMatch(/radiation/)
    }
  })

  it('returns nothing for a question the research does not cover', () => {
    expect(findPassages('how do I tie my shoes', 'Med bot')).toEqual([])
    expect(findPassages('what is the weather like in Paris', 'Overview')).toEqual([])
    expect(findPassages('How much ibuprofen should I take?', 'Med bot')).toEqual([])
  })

  it('returns nothing for an empty or one-word nonsense question', () => {
    expect(findPassages('', 'Sleep')).toEqual([])
    expect(findPassages('   ', 'Sleep')).toEqual([])
    expect(findPassages('blorf', 'Sleep')).toEqual([])
    expect(findPassages('space', 'Med bot')).toEqual([])
  })

  it('never makes a passage match on the screen label alone', () => {
    expect(findPassages('tell me a joke', 'Sleep')).toEqual([])
  })

  it('leans toward passages of the screen the question is asked from', () => {
    const fromSleep = findPassages('how does stress affect me', 'Sleep')
    const fromMed = findPassages('how does stress affect me', 'Med bot')
    const sleepShare = (list: typeof fromSleep) =>
      list.filter((p) => /sleep/i.test(`${p.quote} ${p.terms.join(' ')}`)).length
    expect(sleepShare(fromSleep)).toBeGreaterThanOrEqual(sleepShare(fromMed))
  })

  it('keeps at most four passages, two per source and 1,400 characters of quotes', () => {
    for (const question of QUESTIONS) {
      const passages = findPassages(question, 'Med bot')
      expect(passages.length).toBeLessThanOrEqual(MAX_PASSAGES)
      const perSource = new Map<string, number>()
      for (const passage of passages) {
        perSource.set(passage.sourceUrl, (perSource.get(passage.sourceUrl) ?? 0) + 1)
      }
      for (const count of perSource.values()) expect(count).toBeLessThanOrEqual(MAX_PER_SOURCE)
      const characters = passages.reduce((sum, passage) => sum + passage.quote.length, 0)
      expect(characters).toBeLessThanOrEqual(MAX_QUOTE_CHARS)
    }
  })

  it('runs in a few milliseconds', () => {
    const started = performance.now()
    for (const question of QUESTIONS) findPassages(question, 'Med bot')
    expect((performance.now() - started) / QUESTIONS.length).toBeLessThan(5)
  })
})

describe.skipIf(!hasResearch)('research.generated.ts', () => {
  it('holds only quotes found word for word in evidence.csv', () => {
    for (const passage of researchPassages) expect(inEvidenceCsv(passage.quote)).toBe(true)
    for (const question of QUESTIONS) {
      for (const passage of findPassages(question, 'Med bot')) {
        expect(inEvidenceCsv(passage.quote)).toBe(true)
      }
    }
  })

  it('has an https address and a title for every passage, and each quote once per source', () => {
    const seen = new Set<string>()
    for (const passage of researchPassages) {
      expect(passage.sourceUrl.startsWith('https://')).toBe(true)
      expect(passage.sourceTitle.trim()).not.toBe('')
      const key = `${passage.sourceUrl} ${passage.quote}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it('carries nothing from protocols or inventory, and no dose', () => {
    const text = readFileSync(generatedFile, 'utf8')
    expect(text).not.toMatch(/protocol_|inventory_|candidate_protocols|approved_protocols/)
    expect(text).not.toMatch(/"(dosage|frequency|duration)"/)
    expect(text).not.toMatch(/\b\d+(\.\d+)?\s*(mg|mcg|µg|milligrams?|micrograms?|IU|tablets?|pills?)\b/i)
  })

  it('equals what the export script produces now', () => {
    expect(readFileSync(generatedFile, 'utf8')).toBe(renderResearchFile().text)
  })
})
