// FICTIONAL SAMPLE DATA. Nothing in this file is a real person's result. The tests, the values,
// the personal factors and the plan are invented for the demonstration, shown on the demo profile
// only, and carry no name.
//
// There are no medicine amounts, exercise loads or food amounts here: this app does not prescribe.
// Test days are worked out from today (see TEST_DAYS_AGO), so the record never goes stale and no
// calendar date is written here.

import type { Level } from '@/design'

export type DomainId = 'cognitive' | 'physical'

export type Marker = {
  id: string
  plainName: string
  technicalName: string
  /** Shown in the "Now" column and in the drawer. */
  nowText: string
  /** Shown in the "Target" column and in the drawer. */
  targetText: string
  /** Fixed here on purpose. They follow the level rules of CONTRACTS section 7 (see `rule`). */
  level: Level
  /** One or two sentences in plain words, shown in the drawer. */
  what: string
  /** The last three weekly tests, oldest first. */
  trend: [number, number, number]
  unit: string
  /** The numbers behind `targetText`, so a test can check `level` against the level rules. */
  rule: { kind: 'max' | 'min'; value: number }
}

export type Factor = {
  id: string
  sentence: string
  technical: string
  tag: 'HIGHER' | 'WATCH' | 'BASELINE'
}

export type StepButton = 'physical-activity' | 'nutrition' | 'sleep' | 'medbot'

export type Step = {
  id: string
  text: string
  tag: string
  button?: StepButton
}

export type Reading = { title: string; href?: string; linkText?: string }

export type Domain = {
  id: DomainId
  label: string
  /** Two short paragraphs: what is measured and why it matters in flight. */
  brief: [string, string]
  /** Which part of the brief has a checked source, and which has none yet. */
  briefSource: { text: string; href: string }
  /** The four markers shown as tiles, by id. */
  tileIds: [string, string, string, string]
  markers: readonly Marker[]
  factors: readonly Factor[]
  steps: readonly Step[]
  reading: readonly Reading[]
}

/** When the last three weekly tests were taken, as days before today, oldest first. */
export const TEST_DAYS_AGO: readonly [number, number, number] = [15, 8, 1]
/** The time of day every test in this record was taken. */
export const TEST_TIME = '09:00'
export const NEXT_TEST_IN_DAYS = 6

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "14 Nov" for a day that many days before today. */
export function testDay(daysAgo: number, now: Date = new Date()): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo)
  return `${day.getDate()} ${MONTHS[day.getMonth()]}`
}

/** "14 Nov, 09:00". */
export function testDateTime(daysAgo: number, now: Date = new Date()): string {
  return `${testDay(daysAgo, now)}, ${TEST_TIME}`
}

const cognitive: Domain = {
  id: 'cognitive',
  label: 'Cognitive',
  brief: [
    'Thinking speed, attention and short-term memory decide whether a procedure goes right. In flight they are strained by lost sleep, the air in the cabin and a heavy workload. The change is usually small: slower reactions and more lapses, not obvious mistakes.',
    'Each week you take a short set of tests at the same time of day. Your results are compared with your own results from before the flight, not with the rest of the crew.',
  ],
  briefSource: {
    text: 'The test set: Basner M et al., Aerospace Medicine and Human Performance, 2015. The effects of sleep, cabin air and workload: to be confirmed',
    href: 'https://pubmed.ncbi.nlm.nih.gov/26564759/',
  },
  tileIds: ['lapses', 'reaction', 'speed', 'memory'],
  markers: [
    {
      id: 'lapses',
      plainName: 'Attention lapses',
      technicalName: 'PVT lapses, 3-minute test',
      nowText: '2 lapses',
      targetText: '2 or fewer',
      level: 'ok',
      what: 'How many times you were slow to answer a light on the screen during a three-minute test. More lapses is one of the first signs of lost sleep.',
      trend: [1, 2, 2],
      unit: 'lapses',
      rule: { kind: 'max', value: 2 },
    },
    {
      id: 'reaction',
      plainName: 'Reaction time',
      technicalName: 'Median reaction time',
      nowText: '248 ms',
      targetText: 'under 260',
      level: 'ok',
      what: 'The usual time between the light appearing and your answer, in thousandths of a second.',
      trend: [241, 245, 248],
      unit: 'ms',
      rule: { kind: 'max', value: 260 },
    },
    {
      id: 'speed',
      plainName: 'Hand and eye speed',
      technicalName: 'Psychomotor speed against baseline',
      nowText: '6% slower',
      targetText: 'under 5% slower',
      level: 'watch',
      what: 'How quickly you copy a pattern by hand, compared with your own speed before the flight. It has slowed a little three weeks in a row.',
      trend: [3, 4, 6],
      unit: '% slower',
      rule: { kind: 'max', value: 5 },
    },
    {
      id: 'memory',
      plainName: 'Short-term memory',
      technicalName: 'Working-memory accuracy',
      nowText: '92%',
      targetText: 'at least 90',
      level: 'ok',
      what: 'How often you were right when holding a few items in mind and answering questions about them.',
      trend: [94, 93, 92],
      unit: '%',
      rule: { kind: 'min', value: 90 },
    },
    {
      id: 'distraction',
      plainName: 'Cost of a distraction',
      technicalName: 'Stroop interference',
      nowText: '41 ms',
      targetText: 'under 45',
      level: 'ok',
      what: 'How much slower you answer when the screen shows something misleading. A smaller number means you shut out distractions well.',
      trend: [38, 40, 41],
      unit: 'ms',
      rule: { kind: 'max', value: 45 },
    },
  ],
  factors: [
    {
      id: 'sleep-debt',
      sentence: 'You are a little over two hours short of sleep this week.',
      technical: 'Accumulated sleep debt 2 h 18 m',
      tag: 'WATCH',
    },
    {
      id: 'cabin-air',
      sentence: 'Carbon dioxide in the cabin has been on the high side.',
      technical: 'Weekly mean above the working level. See Environment',
      tag: 'HIGHER',
    },
    {
      id: 'sleep-sensitive',
      sentence: 'Your results before the flight dropped more than most after a short night.',
      technical: 'Pre-flight sleep restriction test',
      tag: 'HIGHER',
    },
  ],
  steps: [
    {
      id: 'test-first',
      text: 'Take the three-minute attention test before each critical task, such as a spacewalk or a docking.',
      tag: 'BEFORE CRITICAL TASKS',
    },
    {
      id: 'sleep-first',
      text: 'If your lapses are well above your usual, say so before the task. The commander and the flight surgeon decide whether it waits until after sleep.',
      tag: 'WHEN IT HAPPENS',
      button: 'medbot',
    },
    {
      id: 'protect-sleep',
      text: 'Protect your sleep period. It is the largest single thing that keeps these scores steady.',
      tag: 'DAILY',
      button: 'sleep',
    },
    {
      id: 'dual-task',
      text: 'Do the two-things-at-once practice three times a week.',
      tag: '3 TIMES A WEEK',
    },
  ],
  reading: [
    {
      title:
        'Basner M et al., Development and validation of the Cognition test battery for spaceflight, Aerospace Medicine and Human Performance, 2015',
      href: 'https://pubmed.ncbi.nlm.nih.gov/26564759/',
      linkText: 'PubMed 26564759',
    },
    {
      title:
        'Risk of performance errors from sleep loss and circadian desynchrony, NASA Human Research Program',
    },
  ],
}

const physical: Domain = {
  id: 'physical',
  label: 'Physical',
  brief: [
    'Without weight on them, bones lose mineral and muscles get smaller and weaker, and the heart and lungs lose fitness. Daily exercise slows all three but does not stop them, so they are measured every week.',
    'Each result is compared with your own measurement from before the flight. A loss that is caught early can be answered by changing the exercise plan while it still helps.',
  ],
  briefSource: {
    text: 'Bone and muscle loss: LeBlanc A et al., Journal of Musculoskeletal and Neuronal Interactions, 2000. Fitness and the effect of exercise: to be confirmed',
    href: 'https://pubmed.ncbi.nlm.nih.gov/15758512/',
  },
  tileIds: ['bone', 'muscle', 'fitness', 'grip'],
  markers: [
    {
      id: 'bone',
      plainName: 'Hip bone density lost',
      technicalName: 'Femoral neck bone mineral density, change from baseline',
      nowText: '0.6%',
      targetText: 'under 0.5%',
      level: 'watch',
      what: 'How much mineral the hip bone has lost since before the flight. Bones that carry no weight lose mineral month after month, most of all in the hips and spine.',
      trend: [0.2, 0.4, 0.6],
      unit: '%',
      rule: { kind: 'max', value: 0.5 },
    },
    {
      id: 'muscle',
      plainName: 'Muscle lost',
      technicalName: 'Lean mass, change from baseline',
      nowText: '0.8%',
      targetText: 'under 1.0%',
      level: 'ok',
      what: 'How much muscle you have lost since before the flight. The muscles that hold you upright on Earth, in the legs and back, shrink first.',
      trend: [0.3, 0.6, 0.8],
      unit: '%',
      rule: { kind: 'max', value: 1 },
    },
    {
      id: 'fitness',
      plainName: 'Heart and lung fitness',
      technicalName: 'VO₂peak',
      nowText: '35 ml/kg/min',
      targetText: 'at least 40',
      level: 'watch',
      what: 'The most oxygen your body can use during hard exercise, measured on the cycle. It shows how well the heart, lungs and muscles work together.',
      trend: [39, 37, 35],
      unit: 'ml/kg/min',
      rule: { kind: 'min', value: 40 },
    },
    {
      id: 'grip',
      plainName: 'Grip strength',
      technicalName: 'Hand dynamometer',
      nowText: '48 kg',
      targetText: 'at least 45',
      level: 'ok',
      what: 'How hard you can squeeze. It is a quick stand-in for strength in the rest of the body.',
      trend: [50, 49, 48],
      unit: 'kg',
      rule: { kind: 'min', value: 45 },
    },
    {
      id: 'jump',
      plainName: 'Jump power lost',
      technicalName: 'Jump power, change from baseline',
      nowText: '4%',
      targetText: 'under 5%',
      level: 'ok',
      what: 'How much less power your legs produce in a jump against the bungee harness, compared with before the flight.',
      trend: [1, 3, 4],
      unit: '%',
      rule: { kind: 'max', value: 5 },
    },
    {
      id: 'stand',
      plainName: 'Heart rate rise under load',
      technicalName: 'Orthostatic stand test, change in heart rate',
      nowText: '18 bpm',
      targetText: 'under 25',
      level: 'ok',
      what: 'How much the heart speeds up when the body is loaded as if standing. A big rise suggests the circulation has got used to weightlessness.',
      trend: [14, 16, 18],
      unit: 'bpm',
      rule: { kind: 'max', value: 25 },
    },
  ],
  factors: [
    {
      id: 'no-gravity',
      sentence: 'There is no weight on your bones and muscles here.',
      technical: 'Microgravity. See Environment',
      tag: 'HIGHER',
    },
    {
      id: 'back',
      sentence: 'An old finding in your lower back makes lifting technique matter more for you.',
      technical: 'Lumbar disc bulge, L4 to L5, found before the flight',
      tag: 'HIGHER',
    },
    {
      id: 'power',
      sentence: 'You started the mission with less fast power than endurance.',
      technical: 'Pre-flight jump power in the lower third of your reference group',
      tag: 'WATCH',
    },
    {
      id: 'endurance',
      sentence: 'Your endurance held up well in training before the flight.',
      technical: 'Pre-flight aerobic capacity above your reference group',
      tag: 'BASELINE',
    },
  ],
  steps: [
    {
      id: 'resistive',
      text: 'Do the resistive session on every planned day. Loading the bones is what protects them.',
      tag: '6 DAYS A WEEK',
      button: 'physical-activity',
    },
    {
      id: 'aerobic',
      text: 'Do the aerobic session on the cycle or treadmill on every planned day.',
      tag: '5 DAYS A WEEK',
    },
    {
      id: 'protein',
      text: 'Eat protein with every meal, as in your nutrition plan.',
      tag: 'DAILY',
      button: 'nutrition',
    },
    {
      id: 'spine',
      text: 'Keep your back straight under load, and stop a lift that hurts.',
      tag: 'EVERY SESSION',
    },
    {
      id: 'tell',
      text: 'Hip bone density and fitness are both past their targets. Raise it with the flight surgeon at your next contact.',
      tag: 'THIS WEEK',
      button: 'medbot',
    },
  ],
  reading: [
    {
      title:
        'LeBlanc A et al., Bone mineral and lean tissue loss after long duration space flight, Journal of Musculoskeletal and Neuronal Interactions, 2000',
      href: 'https://pubmed.ncbi.nlm.nih.gov/15758512/',
      linkText: 'PubMed 15758512',
    },
    {
      title: 'Risk of reduced physical performance capabilities, NASA Human Research Program',
    },
  ],
}

export const domains: Record<DomainId, Domain> = { cognitive, physical }
export const domainOrder: readonly DomainId[] = ['cognitive', 'physical']
