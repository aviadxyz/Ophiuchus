import type { Guide } from '@/registry'

export const guide: Guide = {
  shows:
    'Whether your record is shared with the medical team on Earth, and, for that team, the records of every crew member who chose to share.',
  whyItMatters:
    'Far from Earth, the flight surgeon cannot see you. A shared record lets the team spot a problem early, even though every report arrives late because of the signal delay.',
  howToRead: [
    'Nothing of yours is sent until you switch sharing on. Switching it off deletes your record from the server at once.',
    'Each crew row shows the worst of its five daily lines, the open alerts and when the report was sent.',
    'A report older than one hour says so. The person may simply not have opened the app since.',
  ],
  whenToAct:
    'If your own record shows ACT for several days, tell the flight surgeon yourself; do not wait for the ground team to notice. For anything urgent, use Emergency.',
}
