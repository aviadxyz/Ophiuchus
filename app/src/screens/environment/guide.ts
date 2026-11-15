import type { Guide } from '@/registry'

export const guide: Guide = {
  shows:
    'This screen shows the station around you: air, temperature, noise, gravity and radiation. The values are simulated, because the app has no cabin sensor.',
  whyItMatters:
    'In a closed station the air, the noise and the radiation are part of your health, and you cannot step outside to change them. Weightlessness weakens bones and muscles, and cabin radiation adds up over the mission.',
  howToRead: [
    'Each tile has a value, a target and a word: on target, watch or act.',
    'Tap a tile to see the last 24 hours and what the value does to the body.',
    'Everyone on the station shares these values.',
  ],
  whenToAct:
    'If a value stays on WATCH or ACT, or you feel a headache, poor sleep or tired hearing that lasts, tell the flight surgeon or the station commander. For anything sudden, use Emergency.',
}
