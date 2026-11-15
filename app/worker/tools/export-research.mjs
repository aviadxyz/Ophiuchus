// Turns the team's research database (`DB layer/DB/draft/`) into the passage file the Med bot
// searches on the server: `app/worker/research/research.generated.ts`.
//
// Run from the repo root or from `app/`, it gives the same file either way:
//   node app/worker/tools/export-research.mjs      (repo root)
//   node worker/tools/export-research.mjs          (app folder; also runs as `prebuild`)
//
// It reads CSV only and adds no dependency. A passage is one quote from evidence.csv whose
// `verification_status` is `exact_match`, with its source title and address, and the names of the
// items and relations that quote is evidence for (used as search words). Nothing is rewritten.
//
// Left out on purpose: the `protocols` and `inventory` folders, and every dosage, frequency and
// duration column. The draft protocols are unreviewed and the Med bot never gives a dose.
//
// When the `DB layer` folder is not there (a checkout that has only `app`), the script keeps the
// file already committed and exits with success. It never fails a build.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const draftDir = resolve(here, '../../../DB layer/DB/draft')
const outFile = resolve(here, '../research/research.generated.ts')

/** Parses CSV text. Fields may be quoted and may hold commas, doubled quotes and line breaks. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 1
        } else quoted = false
      } else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += char
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Columns never copied, whatever table they turn up in. */
const FORBIDDEN_COLUMNS = new Set(['dosage', 'frequency', 'duration'])

function readTable(relativePath) {
  const [header, ...body] = parseCsv(readFileSync(resolve(draftDir, relativePath), 'utf8'))
  if (!header) return { idColumn: '', rows: [] }
  const keep = header.map((name) => !FORBIDDEN_COLUMNS.has(name))
  const rows = body.map((cells) =>
    Object.fromEntries(
      header.flatMap((name, index) => (keep[index] ? [[name, cells[index] ?? '']] : [])),
    ),
  )
  return { idColumn: header[0] ?? '', rows }
}

function csvFilesIn(folder) {
  const dir = resolve(draftDir, folder)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.csv'))
    .sort()
    .map((name) => `${folder}/${name}`)
}

const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

function buildPassages() {
  // Item names: every entity table (risk factors, conditions, countermeasures, environments,
  // findings, biomarkers, genes, microbiome), plus their aliases.
  const namesById = new Map()
  const addName = (id, name) => {
    const clean = name.trim().toLowerCase()
    if (!id || !clean) return
    const set = namesById.get(id) ?? new Set()
    set.add(clean)
    namesById.set(id, set)
  }
  for (const file of csvFilesIn('entities')) {
    const { idColumn, rows } = readTable(file)
    for (const row of rows) addName(row[idColumn], row.canonical_name ?? '')
  }
  for (const row of readTable('aliases/aliases.csv').rows) addName(row.entity_id, row.alias)

  const sources = new Map(readTable('metadata/sources.csv').rows.map((row) => [row.source_id, row]))

  // Search words per evidence id: the items each claim names, and both ends of each relation.
  const termsByEvidence = new Map()
  const addTerms = (evidenceId, entityId) => {
    const names = namesById.get(entityId)
    if (!evidenceId || !names) return
    const set = termsByEvidence.get(evidenceId) ?? new Set()
    for (const name of names) set.add(name)
    termsByEvidence.set(evidenceId, set)
  }
  const claims = readTable('evidence/knowledge_claims.csv').rows
  const evidenceByClaim = new Map()
  for (const claim of claims) {
    evidenceByClaim.set(claim.claim_id, claim.evidence_id)
    addTerms(claim.evidence_id, claim.subject_entity_id)
    addTerms(claim.evidence_id, claim.object_entity_id)
  }
  for (const file of csvFilesIn('relations')) {
    for (const row of readTable(file).rows) {
      const evidenceId = evidenceByClaim.get(row.claim_id)
      addTerms(evidenceId, row.source_entity_id)
      addTerms(evidenceId, row.target_entity_id)
    }
  }

  // One passage per quote per source, search words merged.
  const passages = new Map()
  let skipped = 0
  for (const row of readTable('evidence/evidence.csv').rows) {
    if (row.verification_status !== 'exact_match') continue
    const source = sources.get(row.source_id)
    const sourceUrl = (source?.source_url || row.source_url || '').trim()
    const sourceTitle = (source?.title ?? '').trim()
    const quote = row.evidence_text
    if (!sourceUrl.startsWith('https://') || !sourceTitle || !quote.trim()) {
      skipped += 1
      continue
    }
    const key = `${sourceUrl}\u0000${quote}`
    const passage = passages.get(key) ?? {
      ids: [],
      quote,
      sourceTitle,
      sourceUrl,
      terms: new Set(),
    }
    passage.ids.push(row.evidence_id)
    for (const term of termsByEvidence.get(row.evidence_id) ?? []) passage.terms.add(term)
    passages.set(key, passage)
  }

  // A quote that is the same sentence as another from the same page, give or take a final period,
  // spacing or a few words at the start, is merged into the longer one. The longer one is kept
  // word for word.
  const normalize = (text) =>
    text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[.;:,\s]+$/, '')
  const merged = []
  const candidates = [...passages.values()].sort(
    (a, b) => b.quote.length - a.quote.length || byText(a.sourceUrl + a.quote, b.sourceUrl + b.quote),
  )
  for (const candidate of candidates) {
    const text = normalize(candidate.quote)
    const into = merged.find(
      (kept) => kept.sourceUrl === candidate.sourceUrl && normalize(kept.quote).includes(text),
    )
    if (!into) {
      merged.push(candidate)
      continue
    }
    into.ids.push(...candidate.ids)
    for (const term of candidate.terms) into.terms.add(term)
  }

  const list = merged
    .map((passage) => ({
      id: [...passage.ids].sort(byText)[0],
      quote: passage.quote,
      sourceTitle: passage.sourceTitle,
      sourceUrl: passage.sourceUrl,
      terms: [...passage.terms].sort(byText),
    }))
    .sort((a, b) => byText(a.id, b.id))
  return { list, skipped }
}

const header = `// GENERATED by app/worker/tools/export-research.mjs from "DB layer/DB/draft". Do not edit by hand.
// Re-run:  node worker/tools/export-research.mjs   (from the app folder; it also runs before every build)
//
// One passage is one quote from evidence.csv marked exact_match: word for word from the source page,
// with that page's title and address. \`terms\` are the names and aliases of the items and relations
// the quote is evidence for. Every row in the research is still "pending": it was extracted
// automatically from NASA and Canadian Space Agency pages and no clinician has reviewed it.
// The protocols and inventory folders, and every dosage, frequency and duration column, are left out.

export type ResearchPassage = {
  id: string
  /** Word for word as stored in evidence.csv. */
  quote: string
  sourceTitle: string
  sourceUrl: string
  /** Lower-case item names and aliases this quote is evidence for. */
  terms: readonly string[]
}
`

/** The full text of research.generated.ts for the research as it is now. Used by the tests. */
export function renderResearchFile() {
  const { list, skipped } = buildPassages()
  const body = `\nexport const researchPassages: readonly ResearchPassage[] = ${JSON.stringify(list, null, 2)}\n`
  const sourceCount = new Set(list.map((passage) => passage.sourceUrl)).size
  return { text: `${header}${body}`, passages: list.length, sources: sourceCount, skipped }
}

export const researchFolderFound = () => existsSync(draftDir)

function main() {
  if (!researchFolderFound()) {
    console.log('export-research: "DB layer/DB/draft" not found, kept the existing research.generated.ts')
    return
  }
  try {
    const { text, passages, sources, skipped } = renderResearchFile()
    writeFileSync(outFile, text)
    console.log(
      `export-research: wrote ${passages} passages from ${sources} sources (${skipped} left out without an https address or title)`,
    )
  } catch (error) {
    // Never fail a build: keep the committed file and say why.
    const reason = error instanceof Error ? error.message : String(error)
    console.log(`export-research: could not read the research (${reason}), kept the existing research.generated.ts`)
  }
}

// Runs only when called as a script, not when a test imports it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
