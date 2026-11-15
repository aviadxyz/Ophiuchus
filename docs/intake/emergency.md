# Intake sheet: Emergency

The design for the Emergency screen, as answers to the ten questions in [SCREENS.md](../SCREENS.md). Paste everything below the line into [prompt 07](../../prompts/07-screen-from-intake-sheet.md) where it says "paste the completed intake sheet here".

- Screen name: `Emergency`. Folder: `emergency`. Sketch: none.
- Designer: not yet reviewed by Elia. Rami drafted it from the plan's defaults so the screen could be built on time. Elia can change any answer afterwards.

---

## 1. Who opens this screen, and at what moment?

Any crew member, at the moment something is wrong with them or with a crewmate and they need help now. They may be frightened and using one hand.

## 2. What is the one question it answers?

"How do I call for help, and what do I do until it comes?"

## 3. Sketch: top, middle, bottom

One column, the same on PC and phone:

1. Header. Title "Emergency". Description: "Call for help and follow the first steps while it is on the way." Pill: `ALERT OPEN` (tone `danger`) while an emergency alert is open, otherwise `NO OPEN ALERT` (tone `neutral`).
2. One line about the delay to Earth, only when there is one (see 4).
3. The trigger card: "What is wrong?" with four choices, then the large hold-to-send button.
4. After sending, the trigger card becomes the "Alert sent" card with the first steps.
5. "Alerts" list.
6. The demonstration line.

## 4. What information is shown?

- **Delay line:** when `useMission().commDelaySeconds` is above zero: "A signal to Earth takes about [delay] each way from here. Start the first steps yourself." The delay is shown in seconds under one minute and in minutes above it.
- **"What is wrong?"** four choices in a `ChipGroup`, one selected at a time, "Medical" selected at the start: Medical, Injury, Mental health, Cabin problem.
- **Hold-to-send button:** large, with a `ProgressRing` that fills over two seconds. Text inside: "Hold to send alert". Under it: "Hold for two seconds. Let go to cancel."
- **"Alert sent" card:** "Alert sent at [time]" and "Help has been asked for. Do these now:", then the four first steps, numbered, in large text:
  1. Tell the nearest crewmate out loud.
  2. Stay with the person. Do not leave them alone.
  3. Get the medical kit and follow its checklist.
  4. Note the time and what happened, for the flight surgeon.
- **"Alerts" list:** every alert of kind `emergency`, newest first. Each shows the time, where it came from ("This console" or "Watch"), the message and a status pill: `OPEN` (`danger`), `CANCELLED` (`neutral`), `ACKNOWLEDGED` (`ok`). With none: "No alerts yet."
- **Demonstration line**, small but always visible: "Demonstration. No real alert is sent to anyone. In a real emergency, call your local emergency number."

The alert message that is stored is the chosen kind followed by "emergency", for example "Medical emergency" or "Cabin problem emergency".

## 5. What can the person do here?

| Action | What happens |
|---|---|
| Choose what is wrong | Changes the message that will be sent. Nothing is sent |
| Hold the button for two seconds | Calls `raiseAlert('emergency', 'console', message, 'emergency')`. The card changes to "Alert sent" |
| Let go early | Nothing is sent. The ring empties |
| "Cancel" on the "Alert sent" card, shown for ten seconds after sending | Calls `cancelAlert`. The card goes back to the trigger |
| "Acknowledge" on an open alert in the list | Calls `acknowledgeAlert`. This stands in for the flight surgeon answering |
| "Talk to the Med bot" (quiet button under the first steps) | Calls `askMedbot('emergency')` |

The hold works with a mouse, a finger, and the keyboard (hold Space or Enter).

## 6. What should stand out first?

The hold-to-send button. Nothing else on the screen is as large.

## 7. When everything is fine, and when something is wrong

- **Fine:** the trigger card is shown, the pill reads `NO OPEN ALERT`, and the list is empty or holds only closed alerts.
- **Wrong:** an alert is open. The "Alert sent" card with the first steps replaces the trigger, the pill reads `ALERT OPEN`, and the open alert is at the top of the list. This also happens when the alert came from the watch.

## 8. Which other screens does it connect to?

- The shell's banner, Ophi's alert look and the watch follow the stored alert by themselves. This screen does not wire them.
- Med bot, through the one button.
- It does not show health readings and nothing else links into it except the shell's Emergency controls.

## 9. What should Ophi say?

- **Shows:** "This is where you call for help. Choose what is wrong, hold the button for two seconds, and the alert is sent."
- **Why it matters in space:** "Help from Earth can be minutes away by signal alone, so the crew acts first. The steps on screen are what to do until someone answers."
- **How to read it:** "The big button sends the alert." / "After sending, follow the numbered steps one at a time." / "The list shows every alert and whether someone has answered."
- **When to act:** "Use it whenever you or a crewmate needs help now. Sending an alert by mistake is fine: cancel it within ten seconds."

Ophi is never funny on this screen.

## 10. What is definitely not on this screen?

- Any diagnosis, any medicine name or amount, or first-aid instructions beyond the four steps above.
- Any real alert, message or call to a real person or service.
- A confirm dialog before or after the hold. The hold is the confirmation.
- Loading states or anything that needs the network before the button works.
- Health readings, charts, or links to other screens apart from the Med bot button.
