import type { EnvironmentMetricId } from '@/data'

export type EnvironmentGroup = 'Air' | 'Cabin' | 'Radiation'

export type RelatedLink = { label: string; to: string }

export type EnvironmentMetric = {
  id: EnvironmentMetricId
  /** The plain name shown on the tile and in the drawer title. */
  name: string
  group: EnvironmentGroup
  /** Digits after the decimal point. */
  digits: number
  what: string
  body: string
  todo: string[]
  links: RelatedLink[]
}

const TELL =
  'Tell the flight surgeon or the station commander if it stays off target or you feel unwell.'

/** The nine values in the order shown. Text describes the data and never diagnoses. */
export const environmentMetrics: EnvironmentMetric[] = [
  {
    id: 'temperatureC',
    name: 'Temperature',
    group: 'Air',
    digits: 1,
    what: 'How warm the cabin air is around you.',
    body: 'Heat and cold change comfort, skin, eyes and sleep. A warm cabin makes it harder to rest and to shed heat after exercise.',
    todo: ['Adjust your clothing or the local air flow if you can.', TELL],
    links: [{ label: 'Sleep', to: '/sleep' }],
  },
  {
    id: 'humidityPct',
    name: 'Humidity',
    group: 'Air',
    digits: 0,
    what: 'How much water vapour is in the cabin air.',
    body: 'Dry air irritates skin, eyes and the nose. Humid air feels warmer and can make sleep less comfortable.',
    todo: ['Drink regularly, and tell someone if your eyes or skin feel dry for days.', TELL],
    links: [{ label: 'Sleep', to: '/sleep' }],
  },
  {
    id: 'gravityG',
    name: 'Gravity',
    group: 'Cabin',
    digits: 2,
    what: 'How much weight your body feels. 1 g is the weight you feel on Earth. 0 g is weightlessness.',
    body: 'Without weight on them, bones and muscles get weaker over a mission. That is why loaded exercise is on the plan every day.',
    todo: [
      'Do your planned resistive and aerobic sessions every day.',
      'Tell the flight surgeon if you skip several sessions in a row.',
    ],
    links: [
      { label: 'Physical activity', to: '/physical-activity' },
      { label: 'Performance', to: '/performance' },
    ],
  },
  {
    id: 'oxygenPct',
    name: 'Oxygen',
    group: 'Air',
    digits: 1,
    what: 'The share of the cabin air that is oxygen. Air on Earth is about 21%.',
    body: 'Air with less oxygen can bring headaches, tiredness and slower thinking. Air with much more raises the risk of fire.',
    todo: ['Report any alarm or a feeling of breathlessness at once.', TELL],
    links: [{ label: 'Risks', to: '/risks' }],
  },
  {
    id: 'co2MmHg',
    name: 'Carbon dioxide',
    group: 'Air',
    digits: 2,
    what: 'The gas you breathe out. In a closed cabin it builds up unless the air is cleaned.',
    body: 'At higher levels it can bring headaches, poorer sleep and slower thinking. It is highest while the crew sleeps.',
    todo: ['Keep air vents clear and do not block the flow around where you sleep.', TELL],
    links: [{ label: 'Sleep', to: '/sleep' }],
  },
  {
    id: 'noiseDb',
    name: 'Noise',
    group: 'Cabin',
    digits: 0,
    what: 'How loud it is in the cabin. Fans and pumps run all the time.',
    body: 'Constant noise can bring poorer sleep and tired hearing, and it makes speech harder to follow.',
    todo: ['Use the quieter sleep area, and wear hearing protection near loud equipment.', TELL],
    links: [{ label: 'Sleep', to: '/sleep' }],
  },
  {
    id: 'radiationUSvPerHour',
    name: 'Radiation in the cabin',
    group: 'Radiation',
    digits: 1,
    what: 'How much radiation passes through the cabin air each hour, measured by an area monitor.',
    body: 'Radiation is a long-term exposure that adds up over the mission. You cannot feel it.',
    todo: ['Follow the crew plan for where to be during a radiation warning.', TELL],
    links: [{ label: 'Risks', to: '/risks' }],
  },
  {
    id: 'mosfetOutsideUGyPerHour',
    name: 'Radiation outside the hull',
    group: 'Radiation',
    digits: 1,
    what: 'The dose rate at a MOSFET dosimeter outside the hull. A MOSFET dosimeter is a small electronic chip that counts the radiation passing through it. Comparing the one outside with the one inside shows how much the hull stops.',
    body: 'Radiation is a long-term exposure that adds up over the mission. Outside the hull it is higher than inside.',
    todo: ['Keep spacewalk time to what the plan says.', TELL],
    links: [{ label: 'Risks', to: '/risks' }],
  },
  {
    id: 'mosfetInsideUGyPerHour',
    name: 'Radiation at the inside dosimeter',
    group: 'Radiation',
    digits: 1,
    what: 'The dose rate at a MOSFET dosimeter inside the cabin. A MOSFET dosimeter is a small electronic chip that counts the radiation passing through it. Comparing the one outside with the one inside shows how much the hull stops.',
    body: 'Radiation is a long-term exposure that adds up over the mission. Inside, the hull stops part of it.',
    todo: ['Follow the crew plan for where to be during a radiation warning.', TELL],
    links: [{ label: 'Risks', to: '/risks' }],
  },
]

export const groups: EnvironmentGroup[] = ['Air', 'Cabin', 'Radiation']
