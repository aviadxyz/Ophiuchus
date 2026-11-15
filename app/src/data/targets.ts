// One target per id. Values come from the seed-fact tables in docs/SCREENS.md and are
// seed values from memory: every target is unverified until a human fills in its source.

import type { CrewProfile, Target, TargetId, TargetMap } from './types'
import { targetIds } from './types'

export const UNVERIFIED_SOURCE = 'to be confirmed'

/** Used when body mass is not known. */
export const DEFAULT_MASS_KG = 75
export const DEFAULT_ENERGY_KCAL = 3000

const KCAL_PER_KG_FALLBACK = 38
const ACTIVITY_FACTOR = 1.7
const PROTEIN_G_PER_KG = 1.2

type TargetFields = Omit<Target, 'id' | 'sourceText' | 'sourceUrl' | 'verified'>

const roundTo = (value: number, step: number) => Math.round(value / step) * step

/**
 * Daily energy target in kcal. With mass, height and birth year known, the Mifflin-St Jeor
 * equation times an activity factor. With only mass, a per-kilogram figure. With nothing,
 * a fixed default. Always kept inside a plausible range for crew.
 */
export function energyTargetKcal(
  profile: Pick<CrewProfile, 'massKg' | 'heightCm' | 'birthYear' | 'sex'>,
  now = new Date(),
): number {
  const { massKg, heightCm, birthYear, sex } = profile
  if (massKg === undefined) return DEFAULT_ENERGY_KCAL
  let kcal = massKg * KCAL_PER_KG_FALLBACK
  if (heightCm !== undefined && birthYear !== undefined) {
    const age = Math.max(18, now.getFullYear() - birthYear)
    const sexTerm = sex === 'male' ? 5 : sex === 'female' ? -161 : -78
    kcal = (10 * massKg + 6.25 * heightCm - 5 * age + sexTerm) * ACTIVITY_FACTOR
  }
  return Math.min(4200, Math.max(2200, roundTo(kcal, 50)))
}

/** Daily protein minimum in grams: 1.2 g per kg of body mass, or a default when mass is unknown. */
export function proteinTargetG(massKg: number | undefined): number {
  return Math.round((massKg ?? DEFAULT_MASS_KG) * PROTEIN_G_PER_KG)
}

function fieldsFor(
  profile: Pick<CrewProfile, 'massKg' | 'heightCm' | 'birthYear' | 'sex'>,
  now: Date,
): Record<TargetId, TargetFields> {
  const mass = profile.massKg
  return {
    sleepHours: { label: 'Sleep', kind: 'min', value: 7, unit: 'h' },
    energyKcal: {
      label: 'Energy',
      kind: 'min',
      value: energyTargetKcal(profile, now),
      unit: 'kcal',
    },
    waterMl: { label: 'Water', kind: 'min', value: 2000, unit: 'ml' },
    proteinG: { label: 'Protein', kind: 'min', value: proteinTargetG(mass), unit: 'g' },
    sodiumMg: { label: 'Sodium', kind: 'max', value: 3500, unit: 'mg' },
    calciumMg: { label: 'Calcium', kind: 'min', value: 1000, unit: 'mg' },
    ironMg: { label: 'Iron', kind: 'max', value: 10, unit: 'mg' },
    vitaminDIu: { label: 'Vitamin D', kind: 'min', value: 800, unit: 'IU' },
    omega3G: { label: 'Omega-3', kind: 'min', value: 1.1, unit: 'g' },
    potassiumMg: { label: 'Potassium', kind: 'min', value: 3400, unit: 'mg' },
    exerciseMinutes: { label: 'Exercise', kind: 'min', value: 120, unit: 'min' },
    moodScore: { label: 'Mood', kind: 'min', value: 3, unit: 'of 5' },
    bodyMassKg:
      mass === undefined
        ? { label: 'Body mass', kind: 'range', value: 55, upper: 95, unit: 'kg' }
        : {
            label: 'Body mass',
            kind: 'range',
            value: Math.round(mass * 0.95 * 10) / 10,
            upper: Math.round(mass * 1.05 * 10) / 10,
            unit: 'kg',
          },
    heartRate: { label: 'Heart rate', kind: 'range', value: 50, upper: 100, unit: 'bpm' },
    resistiveSessionsPerWeek: {
      label: 'Resistive sessions a week',
      kind: 'min',
      value: 6,
      unit: 'sessions',
    },
    aerobicSessionsPerWeek: {
      label: 'Aerobic sessions a week',
      kind: 'min',
      value: 6,
      unit: 'sessions',
    },
    // Station environment (prompt 25). Gravity has no target: the mission sets it.
    temperatureC: { label: 'Cabin temperature', kind: 'range', value: 18, upper: 27, unit: '°C' },
    humidityPct: { label: 'Humidity', kind: 'range', value: 25, upper: 75, unit: '%' },
    oxygenPct: { label: 'Oxygen', kind: 'range', value: 20, upper: 22, unit: '%' },
    co2MmHg: { label: 'Carbon dioxide', kind: 'max', value: 3, unit: 'mmHg' },
    noiseDb: { label: 'Noise', kind: 'max', value: 85, unit: 'dBA' },
    radiationUSvPerHour: { label: 'Radiation in the cabin', kind: 'max', value: 54, unit: 'µSv/h' },
    mosfetOutsideUGyPerHour: {
      label: 'Radiation outside the hull',
      kind: 'max',
      value: 60,
      unit: 'µGy/h',
    },
    mosfetInsideUGyPerHour: {
      label: 'Radiation at the inside dosimeter',
      kind: 'max',
      value: 20,
      unit: 'µGy/h',
    },
  }
}

type TargetSource = Pick<Target, 'sourceText' | 'sourceUrl' | 'verified'>

const TARGET_SOURCES: Record<TargetId, TargetSource> = {
  sleepHours: {
    sourceText: 'NASA HRP, Risk from Inadequate Sleep and Irregular Schedules, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/',
    verified: true,
  },
  energyKcal: {
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
    verified: true,
  },
  waterMl: {
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
    verified: true,
  },
  proteinG: {
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
    verified: true,
  },
  sodiumMg: {
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
    verified: true,
  },
  calciumMg: {
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
    verified: true,
  },
  ironMg: {
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
    verified: true,
  },
  vitaminDIu: {
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
    verified: true,
  },
  omega3G: {
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
    verified: true,
  },
  potassiumMg: {
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
    verified: true,
  },
  exerciseMinutes: {
    sourceText: 'NASA HRP, Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/',
    verified: true,
  },
  moodScore: {
    sourceText: UNVERIFIED_SOURCE,
    sourceUrl: '',
    verified: false,
  },
  bodyMassKg: {
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
    verified: true,
  },
  heartRate: {
    sourceText: 'NASA HRP, Risk of Cardiovascular Adaptations, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/',
    verified: true,
  },
  resistiveSessionsPerWeek: {
    sourceText: 'NASA HRP, Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/',
    verified: true,
  },
  aerobicSessionsPerWeek: {
    sourceText: 'NASA HRP, Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/',
    verified: true,
  },
  temperatureC: {
    sourceText: 'NASA-STD-3001 Technical Brief, ECLSS (OCHMO-TB-002 Rev B), crew health limit [V2 6012]',
    sourceUrl: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-002-eclss.pdf',
    verified: true,
  },
  humidityPct: {
    sourceText: 'NASA-STD-3001 Technical Brief, ECLSS (OCHMO-TB-002 Rev B), crew health limit [V2 6012]',
    sourceUrl: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-002-eclss.pdf',
    verified: true,
  },
  oxygenPct: { sourceText: UNVERIFIED_SOURCE, sourceUrl: '', verified: false },
  co2MmHg: {
    sourceText: 'NASA-STD-3001 Technical Brief, Carbon Dioxide (OCHMO-TB-004 Rev D), one-hour limit [V2 6004]',
    sourceUrl: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf',
    verified: true,
  },
  noiseDb: {
    sourceText: 'NASA-STD-3001 Technical Brief, Acoustics (OCHMO-TB-035 Rev B), hazardous noise limit [V2 6077]',
    sourceUrl: 'https://www.nasa.gov/wp-content/uploads/2023/07/acoustics-technical-brief-ochmo.pdf',
    verified: true,
  },
  radiationUSvPerHour: {
    sourceText: 'NASA-STD-3001 Technical Brief, Radiation Protection (OCHMO-TB-020 Rev G), design limit of 1.3 mSv a day in free space [V1 4033]',
    sourceUrl: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf',
    verified: true,
  },
  mosfetOutsideUGyPerHour: { sourceText: UNVERIFIED_SOURCE, sourceUrl: '', verified: false },
  mosfetInsideUGyPerHour: { sourceText: UNVERIFIED_SOURCE, sourceUrl: '', verified: false },
}

/** Every target for a profile. Verified targets carry their citation; unsourced targets remain unverified. */
export function targetsFor(
  profile: Pick<CrewProfile, 'massKg' | 'heightCm' | 'birthYear' | 'sex'>,
  now = new Date(),
): TargetMap {
  const fields = fieldsFor(profile, now)
  const entries = targetIds.map((id) => [
    id,
    { id, ...fields[id], ...TARGET_SOURCES[id] },
  ])
  return Object.fromEntries(entries) as TargetMap
}
