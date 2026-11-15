// What the Med bot is told about a profile's medical record.
//
// The demo profile has the sample record shown on the Medical status screen; this is the same
// record in a few plain lines (a screen may not import from another screen's folder). A team
// member's profile has no record until that person enters one, so nothing is invented for a
// real person.

const DEMO_RECORD =
  'sample record for demonstration: inflammatory bowel disease, diagnosed before the mission, ' +
  'four areas of the bowel active; gut inflammation marker 312 ug/g against a limit of 250 (act), ' +
  'blood inflammation marker 1.1 mg/L against 1.0 (watch), haemoglobin 13.4 g/dL against 13.5 to 17.5 (watch); ' +
  'plan agreed with the flight surgeon: a daily medicine as prescribed, a stool sample every 14 days, next in 8 days; ' +
  'fibre intake about half of the plan'

export function medicalRecordFor(profile: { kind: 'demo' | 'member' }): string | null {
  return profile.kind === 'demo' ? DEMO_RECORD : null
}
