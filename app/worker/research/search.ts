import { researchPassages, type ResearchPassage } from './research.generated.ts'

/** At most this many passages per question, best first. */
export const MAX_PASSAGES = 4
/** At most this many passages from the same source page. */
export const MAX_PER_SOURCE = 2
/** At most this many characters of quotes in total, so the model's instructions keep their room. */
export const MAX_QUOTE_CHARS = 1400

/**
 * Common English words, and words that are in almost every passage of this research ("space",
 * "astronaut", "mission"), so they never count as a match on their own.
 */
const STOP_WORDS = new Set(
  (
    'the and for are but not you your yours with what when where which who whom why how does did ' +
    'doing done have has had having this that these those there here then than them they their ' +
    'from into onto over under about after before again also any all can could should would will ' +
    'shall may might must one two its it’s was were been being very just more most much many some ' +
    'such only own same other our ours out off too now get got gets make makes made let lets ' +
    'tell know want need feel feeling felt think thing things way ways like really today day days ' +
    'week mine myself yourself she her him his hers please thanks thank okay yes because while ' +
    'space spaceflight spaceflights astronaut astronauts mission missions crew crews nasa human ' +
    'humans people person research study studies risk risks health healthy body earth station ' +
    'long short time help keep stay well good bad lot lots happen happens take takes taking ' +
    'cant dont wont isnt arent didnt doesnt ive ill youre whats lately'
  ).split(/\s+/),
)

/** Treats simple plurals alike: "stones" and "stone", "injuries" and "injury". */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 4 && word.endsWith('sses')) return word.slice(0, -2)
  if (
    word.length > 3 &&
    word.endsWith('s') &&
    !word.endsWith('ss') &&
    !word.endsWith('us') &&
    !word.endsWith('is')
  ) {
    return word.slice(0, -1)
  }
  return word
}

/** Lower-case words of three letters or more, common words dropped, plurals folded. */
export function searchWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word))
    .map(stem)
}

type IndexedPassage = {
  passage: ResearchPassage
  termWords: Set<string>
  quoteWords: Set<string>
  /** Item names of two words or more, as word lists, for the whole-name bonus. */
  phrases: string[][]
}

// The index is built once, when the module loads.
const indexed: IndexedPassage[] = researchPassages.map((passage) => {
  const phrases = passage.terms.map(searchWords).filter((words) => words.length >= 2)
  return {
    passage,
    termWords: new Set(passage.terms.flatMap(searchWords)),
    quoteWords: new Set(searchWords(passage.quote)),
    phrases,
  }
})

// Rarer words weigh more: "kidney" says more about a passage than "loss".
const documentCount = new Map<string, number>()
for (const entry of indexed) {
  for (const word of new Set([...entry.termWords, ...entry.quoteWords])) {
    documentCount.set(word, (documentCount.get(word) ?? 0) + 1)
  }
}
function weight(word: string): number {
  const count = documentCount.get(word) ?? 0
  return count === 0 ? 0 : Math.log(1 + indexed.length / count)
}

const TERM_WEIGHT = 3
const QUOTE_WEIGHT = 1
const PHRASE_BONUS = 6
const SCREEN_WEIGHT = 0.5
/** A passage needs at least this much from the question itself to be returned. */
export const MIN_SCORE = 4
/** And at least this share of the best passage's score, so weak tag-alongs are dropped. */
const RELATIVE_FLOOR = 0.5

function containsRun(words: readonly string[], run: readonly string[]): boolean {
  outer: for (let start = 0; start + run.length <= words.length; start += 1) {
    for (let offset = 0; offset < run.length; offset += 1) {
      if (words[start + offset] !== run[offset]) continue outer
    }
    return true
  }
  return false
}

function questionScore(entry: IndexedPassage, words: readonly string[], unique: Set<string>): number {
  let score = 0
  for (const word of unique) {
    const w = weight(word)
    if (entry.termWords.has(word)) score += TERM_WEIGHT * w
    if (entry.quoteWords.has(word)) score += QUOTE_WEIGHT * w
  }
  for (const phrase of entry.phrases) {
    if (containsRun(words, phrase)) score += PHRASE_BONUS * phrase.length
  }
  return score
}

function screenScore(entry: IndexedPassage, screenWords: Set<string>): number {
  let score = 0
  for (const word of screenWords) {
    if (entry.termWords.has(word) || entry.quoteWords.has(word)) score += SCREEN_WEIGHT * weight(word)
  }
  return score
}

/**
 * The passages of the team's research that match a question, best first: at most four, at most two
 * from one source, at most 1,400 characters of quotes. Empty when nothing really matches, because
 * an unrelated quote is worse than none. The screen label only tips the order between passages that
 * already match the question; it never makes a passage match on its own.
 */
export function findPassages(question: string, screenLabel = ''): ResearchPassage[] {
  const words = searchWords(question)
  if (words.length === 0) return []
  const unique = new Set(words)
  const screenWords = new Set(searchWords(screenLabel))

  const scored: { entry: IndexedPassage; base: number; total: number }[] = []
  for (const entry of indexed) {
    const base = questionScore(entry, words, unique)
    if (base < MIN_SCORE) continue
    scored.push({ entry, base, total: base + screenScore(entry, screenWords) })
  }
  if (scored.length === 0) return []
  scored.sort((a, b) => b.total - a.total || (a.entry.passage.id < b.entry.passage.id ? -1 : 1))
  const best = scored[0]!.base

  const chosen: ResearchPassage[] = []
  const perSource = new Map<string, number>()
  let characters = 0
  for (const { entry, base } of scored) {
    if (chosen.length >= MAX_PASSAGES) break
    if (base < best * RELATIVE_FLOOR) continue
    const { passage } = entry
    const fromSource = perSource.get(passage.sourceUrl) ?? 0
    if (fromSource >= MAX_PER_SOURCE) continue
    if (characters + passage.quote.length > MAX_QUOTE_CHARS) continue
    chosen.push(passage)
    perSource.set(passage.sourceUrl, fromSource + 1)
    characters += passage.quote.length
  }
  return chosen
}
