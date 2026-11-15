// The five people on the team that built Ophiuchus, as crew profiles that exist on every device.
// Only a first name and a mission role are here. No reading and nothing personal is ever seeded:
// a team profile starts empty and fills only with what that person's own device records, so its
// values are live or entered, never simulated. Both consent switches start off; the person turns
// them on when they pick their profile on the first-open card.

export type TeamMember = { id: string; displayName: string; role: string }

export const TEAM_ID_PREFIX = 'crew-'

export const TEAM: readonly TeamMember[] = [
  { id: 'crew-rami', displayName: 'Rami', role: 'Flight engineer' },
  { id: 'crew-aviad', displayName: 'Aviad', role: 'Commander' },
  { id: 'crew-shoval', displayName: 'Shoval', role: 'Pilot' },
  { id: 'crew-elia', displayName: 'Elia', role: 'Mission specialist' },
  { id: 'crew-tal', displayName: 'Tal', role: 'Flight surgeon' },
]
