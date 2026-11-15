import type { Guide } from '@/registry'

export const guide: Guide = {
  shows:
    'This is where you call for help. Hold the button for two seconds and the alert is sent. It can also send itself after a fall or a dangerous reading, unless you answer "I\'m OK" within ten seconds.',
  whyItMatters:
    'Help from Earth can be minutes away by signal alone, so the crew acts first. A person who has fallen may not be able to ask, so the app asks for them and every linked device sees it.',
  howToRead: [
    'The big button sends the alert.',
    'After sending, follow the numbered steps one at a time.',
    '"What is out of balance" lists the readings outside their limits, important ones first.',
    'The list shows every alert and whether someone has answered.',
  ],
  whenToAct:
    'Use it whenever you or a crewmate needs help now. If the countdown starts and you are fine, press "I\'m OK" to cancel it. Sent by mistake? Cancel it within ten seconds.',
}
