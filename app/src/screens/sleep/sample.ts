// FICTIONAL SAMPLE DATA. Nothing in this file is a real person's night. The overnight readings,
// the personal factors and the plan are invented for the demonstration, shown on the demo profile
// only, and carry no name. There are no medicine or supplement amounts here: this app does not
// prescribe.

export type ChannelId = 'heartRate' | 'hrv' | 'cabinTemp' | 'cabinHumidity'

export type Channel = {
  id: ChannelId
  label: string
  unit: string
  /** One reading for each hour in `NIGHT_HOURS`. */
  values: readonly number[]
  /** One plain sentence about what this night's readings show. */
  note: string
}

/** The hours of the sample night, from lights out to waking. */
export const NIGHT_HOURS: readonly string[] = [
  '22:00',
  '23:00',
  '00:00',
  '01:00',
  '02:00',
  '03:00',
  '04:00',
  '05:00',
  '06:00',
]

export const channels: readonly Channel[] = [
  {
    id: 'heartRate',
    label: 'Heart rate',
    unit: 'bpm',
    values: [62, 58, 55, 52, 50, 49, 51, 54, 57],
    note: 'Your heart slowed by 13 beats a minute through the night and was lowest at 03:00. A clear dip like this goes with restful sleep.',
  },
  {
    id: 'hrv',
    label: 'Heart rate variability',
    unit: 'ms',
    values: [48, 54, 60, 64, 66, 68, 65, 60, 55],
    note: 'The small changes between heartbeats grew through the night and peaked at 03:00, when the body was most at rest.',
  },
  {
    id: 'cabinTemp',
    label: 'Cabin temperature',
    unit: '°C',
    values: [22.6, 22.4, 22.1, 21.9, 21.8, 21.8, 21.9, 22.0, 22.2],
    note: 'The sleep station cooled a little overnight and stayed steady.',
  },
  {
    id: 'cabinHumidity',
    label: 'Cabin humidity',
    unit: '%',
    values: [39, 38, 37, 36, 35, 35, 36, 37, 38],
    note: 'The air was on the dry side all night. Dry air can dry the nose and break up the first hours of sleep.',
  },
]

export type Factor = {
  id: string
  sentence: string
  technical: string
  tag: 'HIGHER' | 'WATCH'
}

export const factors: readonly Factor[] = [
  {
    id: 'need',
    sentence: 'You need more sleep than the schedule allows for.',
    technical: 'Habitual sleep need 7.5 h. The crew schedule assumes 6.5 h',
    tag: 'HIGHER',
  },
  {
    id: 'dry-air',
    sentence: 'The air in your sleep station has been dry.',
    technical: 'Cabin humidity 35 to 39% overnight. See Environment',
    tag: 'WATCH',
  },
  {
    id: 'caffeine',
    sentence: 'Coffee in the afternoon keeps you awake longer than most people.',
    technical: 'Noted before the flight',
    tag: 'WATCH',
  },
]

export type StepLink = 'environment' | 'medbot'

export type Step = { id: string; text: string; tag: string; link?: StepLink }

export const steps: readonly Step[] = [
  {
    id: 'window',
    text: 'Keep the same sleep period every day, and dim the lights and put screens away before it.',
    tag: 'DAILY',
  },
  {
    id: 'light',
    text: 'Get bright light soon after waking. It tells the body clock that the day has started.',
    tag: 'DAILY',
  },
  {
    id: 'cabin',
    text: 'Check the air and noise in your sleep station before you blame yourself for a bad night.',
    tag: 'TONIGHT',
    link: 'environment',
  },
  {
    id: 'caffeine',
    text: 'Have your last coffee early in the afternoon.',
    tag: 'DAILY',
  },
  {
    id: 'tell',
    text: 'Short of sleep for several nights in a row: tell the flight surgeon at your next contact. Do not take anything to sleep without asking.',
    tag: 'WHEN IT HAPPENS',
    link: 'medbot',
  },
]

export type Reading = { title: string; href?: string; linkText?: string }

/** The two papers were looked up on 15 November 2026 (docs/REFERENCES.md). The third names a body of work. */
export const reading: readonly Reading[] = [
  {
    title:
      'Barger LK et al., Prevalence of sleep deficiency and use of hypnotic drugs in astronauts before, during, and after spaceflight, Lancet Neurology, 2014',
    href: 'https://pubmed.ncbi.nlm.nih.gov/25127232/',
    linkText: 'PubMed 25127232',
  },
  {
    title:
      'Flynn-Evans EE et al., Circadian misalignment affects sleep and medication use before and during spaceflight, npj Microgravity, 2016',
    href: 'https://pubmed.ncbi.nlm.nih.gov/28725719/',
    linkText: 'PubMed 28725719',
  },
  { title: 'Sleep and circadian risk evidence base, NASA Human Research Program' },
]
