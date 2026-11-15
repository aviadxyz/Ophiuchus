import type { MetricId } from '@/data'

export type SystemKind = 'organ' | 'whole-body'

export type SystemReading = 'heartRate' | 'spo2' | 'skinTempC' | 'bodyMassKg'

export type BodySystemDef = {
  id: string
  label: string
  bodySystem: string
  kind: SystemKind
  metricIds: MetricId[]
  readings: SystemReading[]
  routes: string[]
  whatItDoes: string
  inSpace: string
  howChecked: string
  sourceText: string
  sourceUrl: string
}

export const systems: readonly BodySystemDef[] = [
  {
    id: 'brain',
    label: 'Brain and mind',
    bodySystem: 'Nervous',
    kind: 'organ',
    metricIds: ['sleepHours', 'moodScore'],
    readings: [],
    routes: ['/sleep', '/mood'],
    whatItDoes: 'Your brain runs your sleep, your mood, your attention and every movement you make.',
    inSpace:
      'Isolation, a shifted day and night, a heavy workload and radiation all press on sleep, mood and thinking speed.',
    howChecked: 'Sleep logs, mood check-ins, and short tests of reaction time and thinking.',
    sourceText: 'NASA HRP, Risk of Behavioral Conditions and Psychiatric Disorders, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/',
  },
  {
    id: 'eyes',
    label: 'Eyes and vision',
    bodySystem: 'Nervous, senses',
    kind: 'organ',
    metricIds: [],
    readings: [],
    routes: ['/risks'],
    whatItDoes: 'Your eyes turn light into the picture you see.',
    inSpace:
      'Body fluid moves toward the head in weightlessness. In many crew members on long missions the back of the eye changes shape, which can blur vision.',
    howChecked: 'Regular vision tests and images of the back of the eye.',
    sourceText: 'NASA HRP, Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS), 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/',
  },
  {
    id: 'ears',
    label: 'Balance and hearing',
    bodySystem: 'Nervous, senses',
    kind: 'organ',
    metricIds: [],
    readings: [],
    routes: ['/risks'],
    whatItDoes: 'The inner ear tells your brain which way is up and keeps you steady. The ear also hears.',
    inSpace:
      'With no up or down, the balance organs send confusing signals. That causes motion sickness in the first days and unsteadiness after landing. Constant machine noise can wear on hearing.',
    howChecked:
      'Balance and coordination tests, hearing tests, and noise measurements in the cabin.',
    sourceText: 'NASA HRP, Risk of Altered Sensorimotor and Vestibular Function, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-altered-sensorimotor-and-vestibular-function/',
  },
  {
    id: 'face',
    label: 'Nose, sinuses and taste',
    bodySystem: 'Respiratory, upper',
    kind: 'organ',
    metricIds: [],
    readings: [],
    routes: ['/nutrition'],
    whatItDoes: 'Your nose and sinuses clean the air you breathe and give food most of its flavor.',
    inSpace:
      'Fluid moving toward the head makes the face puffy and the nose stuffy, like a mild cold. Food tastes dull and appetite can drop.',
    howChecked: 'Asking how you feel, and watching how much you eat.',
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
  },
  {
    id: 'heart',
    label: 'Heart and blood vessels',
    bodySystem: 'Cardiovascular',
    kind: 'organ',
    metricIds: ['exerciseMinutes'],
    readings: ['heartRate'],
    routes: ['/physical-activity'],
    whatItDoes: 'Your heart pumps blood through vessels that reach every part of you.',
    inSpace:
      'Without gravity the heart has less work to do and blood shifts toward the head. Fitness drops unless you train, and standing up after landing can make you faint.',
    howChecked: 'Heart rate, blood pressure, heart tracings and ultrasound scans.',
    sourceText: 'NASA HRP, Risk of Cardiovascular Adaptations, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/',
  },
  {
    id: 'lungs',
    label: 'Lungs and breathing',
    bodySystem: 'Respiratory',
    kind: 'organ',
    metricIds: [],
    readings: ['spo2'],
    routes: ['/physical-activity'],
    whatItDoes: 'Your lungs take in oxygen and remove carbon dioxide.',
    inSpace:
      'The lungs cope well, but a closed cabin can build up carbon dioxide, and dust floats instead of settling. The air you breathe matters more.',
    howChecked:
      'Blood oxygen from a finger or wrist sensor, breathing tests, and cabin air monitors.',
    sourceText: 'NASA HRP, 5 Hazards of Human Spaceflight: Hostile/Closed Environments, 2023',
    sourceUrl: 'https://www.nasa.gov/hrp/hazards/',
  },
  {
    id: 'digestive',
    label: 'Stomach, liver and gut',
    bodySystem: 'Digestive',
    kind: 'organ',
    metricIds: ['energyKcal'],
    readings: [],
    routes: ['/nutrition'],
    whatItDoes:
      'Your stomach, liver and gut turn food into fuel and building material, with help from the bacteria that live there.',
    inSpace:
      'Crews often eat less than they need, and the mix of gut bacteria shifts in flight.',
    howChecked: 'Food logs and body mass.',
    sourceText: 'NASA HRP, Risk of Host-Microorganism Interactions, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-host-microorganism-interactions/',
  },
  {
    id: 'kidneys',
    label: 'Kidneys and bladder',
    bodySystem: 'Urinary',
    kind: 'organ',
    metricIds: ['waterMl', 'sodiumMg'],
    readings: [],
    routes: ['/nutrition'],
    whatItDoes: 'Your kidneys filter your blood, balance water and salt, and make urine.',
    inSpace:
      'Bones release calcium in weightlessness and crews tend to drink too little. Together these raise the chance of kidney stones.',
    howChecked: 'Tracking water and salt intake, and urine tests.',
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
  },
  {
    id: 'spine',
    label: 'Spine and back',
    bodySystem: 'Skeletal',
    kind: 'organ',
    metricIds: [],
    readings: [],
    routes: ['/physical-activity'],
    whatItDoes:
      'Your spine holds you upright and protects the nerves that run to the rest of your body.',
    inSpace:
      'Without weight pressing down, the spine lengthens and the back muscles weaken. Back pain is common in flight, and the discs are more easily hurt after return.',
    howChecked: 'Height and back-pain reports, and scans before and after flight.',
    sourceText: 'NASA HRP, Risk of Spaceflight-Induced Bone Changes, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/',
  },
  {
    id: 'bones',
    label: 'Bones',
    bodySystem: 'Skeletal',
    kind: 'organ',
    metricIds: ['calciumMg', 'vitaminDIu'],
    readings: [],
    routes: ['/nutrition', '/physical-activity'],
    whatItDoes: 'Bones carry your weight, protect your organs and store your calcium.',
    inSpace:
      'Unloaded bones lose mineral month after month, most of all in the hips, thigh bones and spine. Without sunlight the body makes no vitamin D.',
    howChecked:
      'Bone scans before and after flight, blood and urine markers during it, and calcium and vitamin D intake.',
    sourceText: 'NASA HRP, Risk of Spaceflight-Induced Bone Changes, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/',
  },
  {
    id: 'muscles',
    label: 'Muscles',
    bodySystem: 'Muscular',
    kind: 'organ',
    metricIds: ['proteinG', 'exerciseMinutes'],
    readings: [],
    routes: ['/physical-activity', '/nutrition'],
    whatItDoes: 'Muscles move you and hold your posture.',
    inSpace:
      'With no weight to carry, muscles shrink and weaken quickly, most of all in the legs and back.',
    howChecked: 'Strength tests, exercise logs and body mass.',
    sourceText: 'NASA HRP, Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/',
  },
  {
    id: 'reproductive',
    label: 'Reproductive system',
    bodySystem: 'Reproductive',
    kind: 'organ',
    metricIds: [],
    readings: [],
    routes: ['/risks'],
    whatItDoes:
      'The reproductive organs make sex hormones and the cells needed to have children.',
    inSpace:
      'Radiation is the main concern for these organs. Less is known here than for most systems, because few people have flown long missions.',
    howChecked:
      'Hormone levels in blood samples, and health checks before and after flight.',
    sourceText: 'Mishra & Luderer, Reproductive hazards of space travel, Nat Rev Endocrinol, 2019',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7371565/',
  },
  {
    id: 'blood',
    label: 'Blood',
    bodySystem: 'Cardiovascular, blood',
    kind: 'whole-body',
    metricIds: ['ironMg'],
    readings: [],
    routes: ['/nutrition'],
    whatItDoes: 'Blood carries oxygen, nutrients and immune cells.',
    inSpace:
      'The body holds less blood fluid in space and breaks down red blood cells faster than on Earth. Iron stores tend to rise, so too much iron matters more than too little.',
    howChecked: 'Blood samples.',
    sourceText: 'NASA HRP, Evidence Report: Risk Factor of Inadequate Nutrition, 2015',
    sourceUrl: 'https://ntrs.nasa.gov/citations/20150000512',
  },
  {
    id: 'immune',
    label: 'Immune system',
    bodySystem: 'Lymphatic and immune',
    kind: 'whole-body',
    metricIds: ['sleepHours'],
    readings: [],
    routes: ['/sleep', '/risks'],
    whatItDoes:
      'Your immune system finds and fights infections, through vessels and nodes spread across the whole body.',
    inSpace:
      'Stress, poor sleep and radiation change how immune cells behave. Viruses that normally lie dormant can wake up, and rashes and allergies are more common.',
    howChecked:
      'Blood and saliva samples, and a record of any illness or rash.',
    sourceText: 'NASA HRP, Risk of Altered Immune System Responses, 2024',
    sourceUrl: 'https://www.nasa.gov/reference/risk-of-altered-immune-system-responses/',
  },
  {
    id: 'skin',
    label: 'Skin',
    bodySystem: 'Skin',
    kind: 'whole-body',
    metricIds: [],
    readings: ['skinTempC'],
    routes: ['/medical-status'],
    whatItDoes:
      'Skin is your barrier against the outside and helps control your temperature.',
    inSpace:
      'Skin gets drier and more easily irritated, small wounds heal more slowly, and the soles of the feet soften because they are no longer walked on.',
    howChecked:
      'Skin checks and a record of rashes or wounds. Some watches read skin temperature.',
    sourceText: 'Farkas & Farkas, Effects of Spaceflight on Human Skin, Skin Pharmacol Physiol, 2021',
    sourceUrl: 'https://doi.org/10.1159/000515963',
  },
  {
    id: 'hormones',
    label: 'Hormones and metabolism',
    bodySystem: 'Endocrine',
    kind: 'whole-body',
    metricIds: [],
    readings: ['bodyMassKg'],
    routes: ['/nutrition'],
    whatItDoes:
      'Glands release hormones that set your energy use, stress response, body clock and blood sugar.',
    inSpace:
      'Stress hormones run higher, the body clock drifts without a normal day and night, and the body may handle sugar less well.',
    howChecked:
      'Blood, urine and saliva samples, plus sleep timing and body mass.',
    sourceText: 'Canadian Space Agency, Why do we conduct science experiments in space?, 2025',
    sourceUrl: 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp',
  },
]
