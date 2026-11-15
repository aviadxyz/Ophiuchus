// The ten body systems of the Risks screen, built from the team's research.
//
// What is hand-written here: which research items belong to which system, and the plain
// sentence that says what a body system does (marked `writtenBy: 'team'`). Everything else is
// looked up in `research.generated.ts`, so a name, a sentence, a countermeasure or a quote that
// is not in the research makes this file throw when it loads (and the tests fail).
//
// The research marks no item with a body system and gives no severity, so the grouping below is
// the team's judgement, and no system is ranked.

import {
  researchItems,
  researchLinks,
  type ResearchEvidence,
  type ResearchItem,
  type ResearchKind,
} from './research.generated'

export type SystemId =
  | 'cardiovascular'
  | 'pulmonary'
  | 'skeletal'
  | 'renal'
  | 'nervous'
  | 'sleep-psychological'
  | 'digestive'
  | 'immune'
  | 'metabolic'
  | 'radiation'

/** The readings this app can show for a system. See readings.ts. */
export type ReadingId =
  | 'exerciseMinutes'
  | 'heartRate'
  | 'resistiveSessions'
  | 'calciumMg'
  | 'vitaminDIu'
  | 'waterMl'
  | 'sodiumMg'
  | 'sleepHours'
  | 'moodScore'
  | 'energyKcal'
  | 'proteinG'
  | 'bodyMassKg'

type Ref = {
  kind: ResearchKind
  name: string
  /** Start of a stored quote to use as this risk's sentence. Without it, the item's description. */
  quote?: string
}

type SystemDraft = {
  id: SystemId
  label: string
  whatItDoes: string
  readings: ReadingId[]
  /** Risk factors and conditions, most important first. The first four are the "major risks". */
  risks: Ref[]
  countermeasures: Ref[]
  /** Starts of stored quotes, at most three, taken from the items above. */
  evidence: string[]
  /** Shown when the research gives no countermeasure this screen can list. */
  countermeasuresNote?: string
}

const condition = (name: string, quote?: string): Ref => ({ kind: 'condition', name, quote })
const riskFactor = (name: string, quote?: string): Ref => ({ kind: 'riskFactor', name, quote })
const countermeasure = (name: string): Ref => ({ kind: 'countermeasure', name })

const NO_COUNTERMEASURE = 'The research gathered so far names no countermeasure for this system.'
const NO_RESEARCH = 'The research gathered so far has nothing on this system.'

const drafts: readonly SystemDraft[] = [
  {
    id: 'cardiovascular',
    label: 'Cardiovascular',
    whatItDoes:
      'Your heart and blood vessels move blood around the body, carrying oxygen and nutrients to every organ.',
    readings: ['exerciseMinutes', 'heartRate'],
    risks: [
      condition('Cardiovascular Adaptations'),
      condition('Venous Haemostasis'),
      condition('Reduced Cardiorespiratory and Musculoskeletal Fitness'),
    ],
    countermeasures: [countermeasure('Exercise during mission')],
    evidence: [
      'Weightlessness alters blood circulation',
      'All astronauts perform exercise during their mission',
      'Examining physical differences in astronauts that may contribute to blood flow',
    ],
  },
  {
    id: 'pulmonary',
    label: 'Pulmonary',
    whatItDoes:
      'Your lungs take oxygen in from the air you breathe and send carbon dioxide back out.',
    readings: [],
    risks: [
      condition('hypoxia', 'a condition that occurs when oxygen levels'),
      condition('mild hypoxia'),
      condition('altitude sickness'),
      condition('decompression sickness'),
      riskFactor('Low oxygen and high carbon dioxide levels'),
    ],
    countermeasures: [
      countermeasure('pressure increases in spacesuits'),
      countermeasure('variable pressure space suits'),
      countermeasure('earth-based training in high- and low-pressure environments'),
      countermeasure('high oxygen breathing'),
    ],
    evidence: [
      'Mild hypoxia, if untreated',
      'Most likely, hypoxia experienced on a mission would be similar',
      'Transitioning from a pressurized spacecraft to a lower-pressure spacesuit',
    ],
  },
  {
    id: 'skeletal',
    label: 'Skeletal',
    whatItDoes:
      'Your bones and muscles hold you up and let you move. Bone is living tissue that is renewed throughout life.',
    readings: ['calciumMg', 'vitaminDIu', 'resistiveSessions'],
    risks: [
      condition('bone density loss'),
      condition('bone and muscle loss'),
      condition('reduced musculoskeletal fitness'),
      condition('Spinal Health'),
      condition('Reduced Cardiorespiratory and Musculoskeletal Fitness'),
    ],
    countermeasures: [
      countermeasure('resistive exercise'),
      countermeasure('resistance training and aerobic exercises'),
      countermeasure('Exercise during mission'),
      countermeasure('strategies that counter bone and muscle loss'),
    ],
    evidence: [
      'Astronauts undergo routine bone scans',
      'astronauts on the International Space Station perform resistance training',
      'All astronauts perform exercise during their mission',
    ],
  },
  {
    id: 'renal',
    label: 'Renal',
    whatItDoes:
      'Your kidneys filter the blood, remove waste and keep the right balance of water and salts in the body.',
    readings: ['waterMl', 'sodiumMg'],
    risks: [],
    countermeasures: [],
    evidence: [],
  },
  {
    id: 'nervous',
    label: 'Nervous system',
    whatItDoes:
      'Your brain, nerves and senses control movement, balance, vision, and the way you think.',
    readings: [],
    risks: [
      condition('Altered Sensorimotor and Vestibular Function'),
      condition('spaceflight associated neuro-ocular syndrome'),
      condition('eye and brain changes'),
      condition('vision changes'),
    ],
    countermeasures: [
      countermeasure('recovery interventions'),
      countermeasure('strategies to counter vision changes'),
    ],
    evidence: [
      'Astronauts can experience motion sickness',
      'Approximately 70 percent of astronauts',
      'Examining the relationship between fluid pressure inside the skull',
    ],
  },
  {
    id: 'sleep-psychological',
    label: 'Sleep and psychological',
    whatItDoes:
      'Sleep lets the brain and body recover. Mood and stress shape how well you think, cope and work with others.',
    readings: ['sleepHours', 'moodScore'],
    risks: [
      riskFactor('sleep loss'),
      riskFactor('circadian desynchronization'),
      riskFactor('Isolation and Confinement', 'Behavioral responses occur among groups'),
      condition('anxiety'),
      condition('inadequate teamwork'),
      condition('sleep-wake cycle disruption'),
      condition('Inadequate Sleep and Irregular Schedule Risks'),
      condition('Behavioral and Psychiatric Risks'),
    ],
    countermeasures: [
      countermeasure('LED light simulation'),
      countermeasure('keeping a regular journal'),
      countermeasure('team-building exercises'),
    ],
    evidence: [
      'Risk of performance decrements and adverse health outcomes resulting from sleep loss',
      'Space crews experience multiple hazards simultaneously',
      'Isolation, radiation, distance from Earth, and other intense space stressors',
    ],
  },
  {
    id: 'digestive',
    label: 'Digestive',
    whatItDoes: 'Your digestive system breaks food down so the body can take in what it needs.',
    readings: ['energyKcal', 'proteinG'],
    risks: [
      condition('Host-Microorganism Interactions'),
      condition('Food Acceptability'),
      riskFactor('menu fatigue'),
    ],
    countermeasures: [],
    countermeasuresNote: NO_COUNTERMEASURE,
    evidence: [
      'Skin and gut microbiomes can change in space',
      'Assessing how long-term spaceflight affects food appeal',
      'Designing meals for a lengthy mission',
    ],
  },
  {
    id: 'immune',
    label: 'Immune',
    whatItDoes: 'Your immune system defends the body against germs and helps it heal.',
    readings: [],
    risks: [
      condition('Altered Immune System Response'),
      condition('Altered Immunity'),
      condition('Host-Microorganism Interactions'),
      condition('increased microbial virulence in spaceflight'),
    ],
    countermeasures: [],
    countermeasuresNote:
      'The research only mentions medicines under assessment here. This screen does not list medicines.',
    evidence: [
      'The stresses of spaceflight can awaken inactive viruses',
      'Some microbes have been found to be more virulent',
      'Analyzing blood, saliva, and urine samples to investigate how spaceflight alters the immune system',
    ],
  },
  {
    id: 'metabolic',
    label: 'Metabolic',
    whatItDoes:
      'Metabolism turns the food you eat into the energy your body runs on, and builds and repairs tissue.',
    readings: ['bodyMassKg', 'energyKcal', 'proteinG'],
    risks: [
      riskFactor('inadequate food and nutrition'),
      condition('inadequate nutrition'),
      condition('Food Physiology'),
      condition('spaceflight-related health changes'),
    ],
    countermeasures: [countermeasure('enhanced spaceflight diet')],
    evidence: [
      'Risk of performance decrement and crew illness due to inadequate food and nutrition',
      'Determining whether an enhanced spaceflight diet',
      'This diet is generally more diverse in foods rich in bioactive compounds',
    ],
  },
  {
    id: 'radiation',
    label: 'Radiation',
    whatItDoes:
      'Radiation is energy that travels through space and through the body. Unlike the other rows, it is a hazard to the body rather than a body system.',
    readings: [],
    risks: [
      condition('Radiation-Induced Cancers'),
      condition('neutron radiation'),
      condition('health complications from space radiation exposure'),
      condition('radiation carcinogenesis'),
    ],
    countermeasures: [
      countermeasure('radiation shielding'),
      countermeasure('medicines to counter the effects of radiation exposures'),
    ],
    evidence: [
      'Crews exposed to radiation from space may be more likely to develop cancer',
      'Neutron radiation, which contributes to about 30% of total radiation on the ISS',
      'NASA scientists and engineers are currently building robust radiation shielding',
    ],
  },
]

export type SystemRisk = {
  name: string
  /** A sentence from the research, or null when the research gives only the name. */
  text: string | null
  researchId: string
}

export type SystemCountermeasure = {
  name: string
  researchId: string
  /** `countermeasure` when the research calls it one, `studied` when it only says it is being investigated. */
  status: 'countermeasure' | 'studied'
}

export type RiskSystem = {
  id: SystemId
  label: string
  /** Plain-language explanation of the system. Written by the team, not taken from the research. */
  whatItDoes: string
  whatItDoesBy: 'team'
  readings: ReadingId[]
  risks: SystemRisk[]
  /** The first four risk names, for the table. */
  majorRisks: string[]
  countermeasures: SystemCountermeasure[]
  countermeasuresNote: string | null
  evidence: ResearchEvidence[]
  /** Set when the research has nothing for this system. */
  emptyNote: string | null
}

const sentenceCase = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

function findItem({ kind, name }: Ref): ResearchItem {
  const item = researchItems.find((entry) => entry.kind === kind && entry.name === name)
  if (!item) throw new Error(`Risks: "${name}" (${kind}) is not in the research file`)
  return item
}

function findQuote(item: ResearchItem, start: string): ResearchEvidence {
  const found = item.evidence.find((entry) => entry.text.startsWith(start))
  if (!found) throw new Error(`Risks: no stored quote of "${item.name}" starts with "${start}"`)
  return found
}

function resolveRisk(ref: Ref): SystemRisk {
  const item = findItem(ref)
  const text = ref.quote ? findQuote(item, ref.quote).text : item.description
  return { name: sentenceCase(item.name), text, researchId: item.id }
}

function resolveCountermeasure(ref: Ref, riskIds: ReadonlySet<string>): SystemCountermeasure {
  const item = findItem(ref)
  const types = researchLinks
    .filter((link) => link.to === item.id && riskIds.has(link.from))
    .map((link) => link.type)
  if (types.length === 0) {
    throw new Error(`Risks: the research does not link "${item.name}" to a risk of this system`)
  }
  const status = types.includes('countermeasure_for') ? 'countermeasure' : 'studied'
  return { name: sentenceCase(item.name), researchId: item.id, status }
}

function resolveEvidence(starts: string[], items: ResearchItem[]): ResearchEvidence[] {
  const picked = new Map<string, ResearchEvidence>()
  for (const start of starts) {
    const found = items.flatMap((item) => item.evidence).find((e) => e.text.startsWith(start))
    if (!found) throw new Error(`Risks: no quote of this system's items starts with "${start}"`)
    picked.set(found.text, found)
  }
  return [...picked.values()].slice(0, 3)
}

function resolve(draft: SystemDraft): RiskSystem {
  const riskItems = draft.risks.map(findItem)
  const riskIds = new Set(riskItems.map((item) => item.id))
  const countermeasures = draft.countermeasures.map((ref) => resolveCountermeasure(ref, riskIds))
  const items = [...riskItems, ...draft.countermeasures.map(findItem)]
  const risks = draft.risks.map(resolveRisk)
  const empty = risks.length === 0
  return {
    id: draft.id,
    label: draft.label,
    whatItDoes: draft.whatItDoes,
    whatItDoesBy: 'team',
    readings: draft.readings,
    risks,
    majorRisks: risks.slice(0, 4).map((risk) => risk.name),
    countermeasures,
    countermeasuresNote:
      draft.countermeasuresNote ?? (countermeasures.length === 0 ? NO_COUNTERMEASURE : null),
    evidence: resolveEvidence(draft.evidence, items),
    emptyNote: empty ? NO_RESEARCH : null,
  }
}

export const riskSystems: readonly RiskSystem[] = drafts.map(resolve)
