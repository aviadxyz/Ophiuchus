// FICTIONAL SAMPLE DATA. Nothing in this file is a real person's medical record. The condition,
// the results, the medicines and the references are invented for the demonstration. The same
// record is shown for every profile (demo and team members) and it carries no name.
//
// There are no medicine amounts here and there must never be: this app does not give doses.
// "8 days" and "7 days ago" are fixed numbers, not dates.

import type { Level, Tone } from '@/design'

export type Marker = {
  id: string
  plainName: string
  technicalName: string
  /** Shown in the "Now" column and in the drawer. */
  nowText: string
  /** Shown in the "Target" column and in the drawer. */
  targetText: string
  /** Fixed here on purpose. They follow the level rules of CONTRACTS section 7. */
  level: Level
  /** One sentence in plain words, shown in the drawer. */
  what: string
  /** The last samples, oldest first. */
  trend?: number[]
  /** The numbers behind `targetText`, so a test can check `level` against the level rules. */
  rule?: { kind: 'max' | 'range'; value: number; upper?: number; now: number }
}

export const markers: readonly Marker[] = [
  {
    id: 'calprotectin',
    plainName: 'Gut inflammation marker',
    technicalName: 'Faecal calprotectin',
    nowText: '312 µg/g',
    targetText: 'under 250',
    level: 'act',
    what: 'A protein from white blood cells, measured in a stool sample. It rises when the gut lining is inflamed, often before any symptom.',
    trend: [150, 180, 312],
    rule: { kind: 'max', value: 250, now: 312 },
  },
  {
    id: 'crp',
    plainName: 'Inflammation in the blood',
    technicalName: 'hs-CRP',
    nowText: '1.1 mg/L',
    targetText: 'under 1.0',
    level: 'watch',
    what: 'A blood protein that rises when there is inflammation anywhere in the body.',
    trend: [0.8, 0.9, 1.1],
    rule: { kind: 'max', value: 1.0, now: 1.1 },
  },
  {
    id: 'esr',
    plainName: 'Blood settling rate',
    technicalName: 'ESR',
    nowText: '17 mm/h',
    targetText: 'under 15',
    level: 'watch',
    what: 'How fast red blood cells settle in a tube. They settle faster when there is inflammation.',
    rule: { kind: 'max', value: 15, now: 17 },
  },
  {
    id: 'haemoglobin',
    plainName: 'Haemoglobin',
    technicalName: 'Haemoglobin',
    nowText: '13.4 g/dL',
    targetText: '13.5 to 17.5',
    level: 'watch',
    what: 'The protein in red blood cells that carries oxygen. It can fall when an inflamed bowel loses small amounts of blood.',
    trend: [13.9, 13.6, 13.4],
    rule: { kind: 'range', value: 13.5, upper: 17.5, now: 13.4 },
  },
  {
    id: 'albumin',
    plainName: 'Blood protein',
    technicalName: 'Albumin',
    nowText: '4.1 g/dL',
    targetText: '3.5 to 5.0',
    level: 'ok',
    what: 'The main protein in blood. It can fall with poor nutrition or long-lasting inflammation.',
    rule: { kind: 'range', value: 3.5, upper: 5.0, now: 4.1 },
  },
  {
    id: 'il6',
    plainName: 'Immune signal',
    technicalName: 'IL-6',
    nowText: '5.8 pg/mL',
    targetText: 'under 5.0',
    level: 'watch',
    what: 'A signal the immune system releases during inflammation.',
    rule: { kind: 'max', value: 5.0, now: 5.8 },
  },
  {
    id: 'fob',
    plainName: 'Hidden blood in stool',
    technicalName: 'Faecal occult blood',
    nowText: 'Not found',
    targetText: 'Not found',
    level: 'ok',
    what: 'A stool test for blood too small to see.',
  },
]

/** The four tiles near the top. A tile either follows a marker or is the next-sample reminder. */
export type TileSpec = {
  label: string
  value: number | string
  unit: string
  targetLine: string
  /** The marker the tile follows. Its level and trend are used. Absent for the reminder. */
  markerId?: string
}

export const tiles: readonly TileSpec[] = [
  {
    label: 'Gut inflammation marker',
    value: 312,
    unit: 'µg/g',
    targetLine: 'Stay under 250',
    markerId: 'calprotectin',
  },
  {
    label: 'Inflammation in the blood',
    value: 1.1,
    unit: 'mg/L',
    targetLine: 'Stay under 1.0',
    markerId: 'crp',
  },
  {
    label: 'Haemoglobin',
    value: 13.4,
    unit: 'g/dL',
    targetLine: '13.5 to 17.5',
    markerId: 'haemoglobin',
  },
  { label: 'Next sample', value: 8, unit: 'days', targetLine: 'Every 14 days' },
]

export type Area = {
  id: string
  plainName: string
  technicalName: string
  pill: string
  tone: Extract<Tone, 'warn' | 'info'>
  finding: string
}

export const areas: readonly Area[] = [
  {
    id: 'jejunum',
    plainName: 'Upper small bowel',
    technicalName: 'Jejunum',
    pill: 'ACTIVE · MODERATE',
    tone: 'warn',
    finding: 'Patches of redness with two shallow ulcers. No narrowing.',
  },
  {
    id: 'caecal-pole',
    plainName: 'Near the appendix',
    technicalName: 'Caecal pole',
    pill: 'ACTIVE · MILD',
    tone: 'info',
    finding: 'A small area of inflammation. The appendix itself is not swollen.',
  },
  {
    id: 'sigmoid',
    plainName: 'Lower large bowel',
    technicalName: 'Sigmoid colon',
    pill: 'ACTIVE · MODERATE',
    tone: 'warn',
    finding: 'A continuous inflamed stretch that bleeds easily when touched.',
  },
  {
    id: 'rectum',
    plainName: 'Rectum',
    technicalName: 'Rectum',
    pill: 'ACTIVE · MILD',
    tone: 'info',
    finding: 'Mild inflammation at the very end of the bowel.',
  },
]

export const capsuleExam = { daysAgo: 7 }

export const condition = {
  title: 'Inflammatory bowel disease',
  note: 'Diagnosed before the mission. Four areas of the bowel are active.',
  paragraphs: [
    'Inflammatory bowel disease is a long-term condition in which parts of the gut lining become inflamed. It comes and goes: quiet for months, then a flare-up.',
    "Spaceflight may make a flare-up more likely. Studies of crews suggest the gut's bacteria change in flight, and the packaged diet is low in fibre. So the condition is watched with regular tests instead of waiting for symptoms.",
    'Nothing here is an emergency today. The aim is to keep it that way.',
  ],
}

export type RiskFactor = {
  id: string
  sentence: string
  tag: 'HIGHER' | 'WATCH'
  technical: string
}

export const riskFactors: readonly RiskFactor[] = [
  {
    id: 'inherited',
    sentence: 'Two inherited traits make your gut lining more sensitive to its own bacteria.',
    tag: 'HIGHER',
    technical: 'NOD2 and ATG16L1 variants',
  },
  {
    id: 'bacteria',
    sentence: 'A protective kind of gut bacteria is low in your last sample.',
    tag: 'HIGHER',
    technical: 'Faecalibacterium prausnitzii 4.1%, reference 10%',
  },
  {
    id: 'fibre',
    sentence: 'You are eating about half the fibre in your plan.',
    tag: 'WATCH',
    technical: '12 g a day against a plan of 25 g',
  },
]

export const plan: readonly { label: string; text: string }[] = [
  { label: 'Daily medicine', text: 'Mesalamine, as prescribed' },
  {
    label: 'Reserve medicine on board',
    text: "Budesonide. Only on the flight surgeon's instruction",
  },
  { label: 'Next review', text: 'In 8 days: stool sample and ultrasound' },
  {
    label: 'Limits on board',
    text: 'No surgery is possible in flight, so problems are caught early',
  },
]

/** What makes an action item show. */
export type ActionWhen = 'always' | 'anyAct' | 'symptoms'

export type ActionButton = 'nutrition' | 'medbot' | 'emergency'

export type ActionItem = {
  id: string
  number: number
  text: string
  tag: 'DAILY' | 'EVERY 14 DAYS' | 'THIS WEEK' | 'RIGHT AWAY'
  when: ActionWhen
  /** The button shown under the item. */
  button?: ActionButton
}

export const actions: readonly ActionItem[] = [
  {
    id: 'medicine',
    number: 1,
    text: 'Take your daily medicine as prescribed. Busy days are when doses get missed.',
    tag: 'DAILY',
    when: 'always',
  },
  {
    id: 'sample',
    number: 2,
    text: 'Give a stool sample every 14 days. The next one is due in 8 days.',
    tag: 'EVERY 14 DAYS',
    when: 'always',
  },
  {
    id: 'fibre',
    number: 3,
    text: 'Build fibre up slowly with the foods in your plan.',
    tag: 'DAILY',
    when: 'always',
    button: 'nutrition',
  },
  {
    id: 'tell',
    number: 4,
    text: 'Your gut inflammation marker is above its limit. Tell the flight surgeon at your next contact.',
    tag: 'THIS WEEK',
    when: 'anyAct',
    button: 'medbot',
  },
  {
    id: 'symptoms',
    number: 5,
    text: 'New belly pain after meals, a fever, or blood you can see: do not wait for the next sample.',
    tag: 'RIGHT AWAY',
    when: 'symptoms',
    button: 'emergency',
  },
]

/** True in this sample: the record is fixed in the "something is wrong" state on purpose. */
export const symptomsReported = true

export const reading: readonly string[] = [
  'Intestinal barrier function and microbiome change during spaceflight (review literature)',
  'Voorhies AA et al., Study of the impact of long-duration space missions at the International Space Station on the human gut microbiome, Scientific Reports, 2019',
  'Risk of altered nutrition and microbiome during spaceflight, NASA Human Research Program',
]
