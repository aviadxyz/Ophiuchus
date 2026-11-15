# 18 · Emergency that triggers itself and reaches the crew

**Runs alone in its files. Can run beside 10 part B, 15, 19 and 08 part B.**

The Emergency screen exists and works by hand: hold a button, an alert is raised, the shell shows a banner, the watch view shows it. This prompt adds what Elia sketched and what Rami asked for: the app raises an emergency by itself when something is clearly wrong (a fall, a vital sign far out of range), every linked device sees it at once, and the screen shows what is out of balance.

| | |
|---|---|
| Branch | `lane/18-emergency-auto` |
| You own | `app/src/screens/emergency/`; new files `app/src/data/autoAlert.ts` and `app/src/data/autoAlert.test.ts`; one marked block of export lines at the end of `app/src/data/index.ts` and one section in `app/src/data/README.md`; new file `app/src/shell/AutoAlertBanner.tsx` and the one line in `app/src/shell/AppShell.tsx` that renders it; `app/src/watch/pages/EmergencyPage.tsx` |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 7 to 10, docs/REAL_DATA.md, docs/intake/emergency.md, `app/src/data/README.md`, `app/src/data/sources/relay.ts`, `app/src/data/simulator.ts`, the current files in `app/src/screens/emergency/`, `app/src/shell/AlertBanner.tsx` |
| Needs | 07 (Emergency) and 08 part A merged. They are |
| Use | The strongest model. This is the one screen that must never fail in front of a judge |

## Prompt

Read AGENTS.md, docs/CONTRACTS.md and the files listed under "Read first" before doing anything. Touch only the files listed under "You own". Add no dependency and no color.

Ophiuchus is an astronaut health console. Its Emergency screen works when a person holds a button. You are making three additions. Judges will try them hands-on, on a laptop and on a phone, with nobody explaining.

### What the designer asked for

Elia, a teammate who knows the subject and does not write code, sketched two things for this screen:

1. When an important reading goes out of its normal range, the system makes an emergency by itself. The person sees a warning with something to press. Pressing it shows which readings are out of balance, and then what to do.
2. Less important readings that are off are also listed, below the important ones.

His sketch ends with "go to a doctor or take a medication". This app never tells anyone to take a medicine. Use "tell the flight surgeon" and the Med bot instead.

Rami added: a fall should trigger an emergency by itself, and it must show live on the other crew members' watches and on the console.

### Part 1. Automatic triggers, in `data/autoAlert.ts`

Build one small module that watches for trouble and is started from `data/index.ts` the same way the simulator is. It exposes these names, which are already in CONTRACTS section 9:

| Name | Does |
|---|---|
| `useAutoAlert()` | Gives `pending` (none, or `cause` and `secondsLeft`), `fallDetection` (on/off), `vitalsWatch` (on/off) and `motionAvailable` (yes/no) |
| `setFallDetection(on)` | Switches fall detection on this device. Turning it on asks the browser for motion access where the browser requires that |
| `setVitalsWatch(on)` | Switches the vital-sign watch. On at the start |
| `cancelAutoAlert()` | The person says "I'm OK" during the countdown. Nothing is raised |
| `simulateAutoAlert(cause)` | Starts the same countdown as a real trigger, for demonstration. `cause` is `fall` or `heart-rate` |

Causes: `fall`, `heart-rate`, `oxygen`.

- **Fall.** Use the browser's device-motion readings. A fall is a short stretch of near weightlessness, then a hard impact, then stillness. Keep the detection as a pure function over a list of samples so it can be tested, and keep the thresholds in one place with a comment that they are illustrative. Where the device has no motion sensor, `motionAvailable` is no and the switch explains that.
- **Vital signs.** Watch the latest vitals, whatever their source. Trigger when heart rate stays at or above 170 or at or below 35 for 20 seconds, or blood oxygen stays at or below 88% for 20 seconds. One trigger per episode: do not fire again until the value has been back in range for a minute. These limits are illustrative, and the screen must say so.
- **Countdown.** A trigger does not raise an alert at once. It starts a 10 second countdown. `cancelAutoAlert()` stops it. If it runs out, call `raiseAlert('emergency', origin, message, 'emergency')`, where `origin` is `watch` when the page is the watch view (`/w`) and `console` otherwise.
- **Message.** Describe what was measured, never a conclusion. Use exactly these forms, followed by the active profile's role when it has one: "Fall detected, no response", "Heart rate 182 bpm for 20 seconds, no response", "Blood oxygen 86% for 20 seconds, no response". For example "Fall detected, no response · Flight engineer". Never include the display name. A simulated trigger ends with " (test)".
- **Demo profile.** The simulator must never trigger a real countdown by accident. Automatic vital-sign triggers on the demo profile happen only through `simulateAutoAlert`.
- The two switches are remembered on this device through the data folder's own persistence helper, under the `ophiuchus:v1:` prefix. Do not use browser storage directly.
- Tests: the fall function on synthetic samples (a fall, a jump, a phone put down on a table, walking); the 20 second rule and the one-per-episode rule; the countdown raising and cancelling; the exact message text with and without a role; no trigger for simulated readings.

### Part 2. The countdown and the crew, outside the Emergency screen

- **`shell/AutoAlertBanner.tsx`**, rendered once in `AppShell` above `AlertBanner`: while `pending` is set, show a full-width card on every screen: what was detected in plain words, the seconds left as a number and as a `ProgressRing`, and one large button, "I'm OK, cancel". It takes keyboard focus when it appears. Where the browser can vibrate, vibrate once per second.
- **Watch view** (`watch/pages/EmergencyPage.tsx`): the same countdown, filling the watch face, with "I'm OK" as the only control. When an emergency alert is open, from this device or any linked one, the watch view shows it full-face: the message, the time, and "Acknowledge". Keep the existing hold-to-send as it is.
- **Reaching the others.** Alerts already travel between devices that share a room (`data/sources/relay.ts`), and every device already shows a banner for an open emergency alert. Do not build a second channel. Verify it instead: open the console in one window and `/w?room=CODE` in another, raise an alert in each direction, and confirm the other shows it within about three seconds, and that acknowledging in one clears the other. If that fails, find out why and fix it inside the files you own, or tell me exactly what in `relay.ts` needs changing.

### Part 3. The Emergency screen, in `screens/emergency/`

Keep everything that works now: the choice of what is wrong, the two-second hold, the "Alert sent" card with its four steps, the alert list, the delay line, the demonstration line. Add, in this order from the top:

1. **"Linked devices"** line under the header, from `useRoom()`: with a room, "Linked to crew room ABC123. Alerts reach every device in this room." Without one: "This device is not linked. Alerts stay on this device." and a quiet button "Link a device" that goes to `/watch`.
2. **"What is out of balance"** card, shown while an emergency alert is open and also whenever any reading below is off:
   - **Important**, first: heart rate and blood oxygen from `useLatestVitals()`. Each row shows the value with its unit and source badge, the limit it is compared with, and a status pill. No reading shows as "No data", never as a number.
   - **Also off target today**, below: every metric in `useToday()` at level `watch` or `act`, with its value, target and status pill, and a link to the screen it belongs to (Nutrition, Physical activity, Mood). With none: "Nothing else is off target today."
   - Under the card: "Limits shown here are for demonstration, not clinical limits." and a source line.
3. **"Automatic alerts"** card: two `Switch`es, "Fall detection on this device" (hint: "Uses this device's motion sensor. An alert is sent if you do not answer within 10 seconds.") and "Watch my vital signs". Then a quiet section, "Try it": two buttons, "Simulate a fall" and "Simulate a heart-rate spike", each calling `simulateAutoAlert`. Text beside them: "Starts the same 10 second countdown as a real detection. Nothing real is sent."
4. In the "Alert sent" card, when the alert was raised automatically, the first line reads "Sent automatically:" followed by the message.

Update `guide.ts` so Ophi's four fields mention that the alert can send itself after a fall or a dangerous reading, and that "I'm OK" cancels it. Ophi is never funny on this screen.

### Do not build

Any diagnosis, any medicine name or amount, calls or messages to real people or services, a second relay, accounts, a map, sound files, or any change outside the files you own.

### Checks you must run and pass before reporting

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` in `app`, all clean.
- "Simulate a fall" on any screen other than Emergency: the countdown appears there, "I'm OK" cancels it and nothing is raised. Let it run out: the alert is raised, the banner shows on every screen, the Emergency screen shows "Sent automatically".
- The two-window test in Part 2, both directions.
- On a real phone or a phone-sized window at 360 px: nothing clipped, the "I'm OK" button is at least 56 px tall, no sideways scrolling.
- The manual hold-to-send still works with mouse, touch and keyboard.
- No user-facing sentence diagnoses, prescribes or names a medicine.

**Report:** what you built, the result of each check, the thresholds you chose and why, what you could not test (a real fall on a real device, most likely), and anything in `relay.ts` or the store that should change.

When all checks pass, commit, push this branch, and report. Do not merge.
