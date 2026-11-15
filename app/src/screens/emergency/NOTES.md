# Emergency

## Plan for prompt 18 (automatic alerts)

1. `data/autoAlert.ts`: movement check that works without gravity (pure `createMotionWatch`: a sudden hard movement, or 2 minutes with no movement while awake), a "Sleeping now" switch, vital-sign watch (20 s rule, one per episode), 10 s countdown that calls `raiseAlert`, two saved switches. Started from the marked block at the end of `data/index.ts`.
2. `data/autoAlert.test.ts`: blows in orbit and on Earth, ordinary movement, stillness awake and asleep, the crew day; the 20 s and episode rules; countdown and cancel; exact messages; no trigger from simulated readings.
3. `shell/AutoAlertBanner.tsx`, rendered once in `AppShell`: the countdown on every screen with "I'm OK, cancel".
4. `watch/pages/EmergencyPage.tsx`: the countdown and any open emergency alert fill the watch face.
5. Here: `AutoAlertsCard.tsx` (linked-devices line, switches, "Try it"), `OutOfBalance.tsx` (important readings, then today's off-target metrics), `limits.ts`, the "Sent automatically:" line, `guide.ts`.

## Prompt 18: what is built

- **Order on the screen.** Header, linked-devices line, delay line. With no alert open: trigger card, then "What is out of balance", then "Automatic alerts", then the alert list. With an alert open: "What is out of balance", then "Alert sent" with the steps, as Elia sketched (readings first, then what to do). This keeps the hold button near the top when nothing is wrong (intake sheet question 6) instead of placing two new cards above it.
- **"What is out of balance"** shows while an alert is open or anything is off. Heart rate and blood oxygen show value, source badge, time, the alert limit and IN RANGE / OUT OF RANGE / NO DATA. The other rows are every metric at WATCH or ACT, with target and a link to its screen. A last box says to tell the flight surgeon and offers the Med bot. Limits line and "Source: to be confirmed" under it.
- **"Sent automatically:"** is recognised by the fixed message form (", no response"), so it works for alerts that came in from another device as well.
- **Movement, not falls (changed at Rami's request).** In orbit there is no gravity, so there is no fall to detect. The motion check (cause still named `fall`, as the contract says) starts the countdown after a sudden hard movement (3 g or more in one reading) or after 2 minutes with no movement at all. No movement counts only from 07:00 to 23:00 and while "Sleeping now" is off; that switch is on the Emergency screen and as a moon button beside SOS on the watch, and turns itself off at 07:00. The countdown card says "Unusual movement detected"; the alert message says which: "Sudden hard movement detected, no response" or "No movement for 2 minutes, no response". "Simulate no movement" shows the second, which takes two minutes to see for real.
- **Watch.** The countdown and any open emergency alert are drawn into the watch face (a React portal into the `watch-app` element), because the page sits in a sliding strip that clips it. The watch's own hold-to-send alert keeps its "Alert sent / Cancel" view for its ten seconds; after that it also shows full-face with "Acknowledge".

## Prompt 18: what is faked or not verified

- Movement thresholds are illustrative and have only been tried on synthetic samples and synthetic browser motion events. No real phone or watch, and nothing in orbit, has been tested. A device lying on a table during the day counts as no movement; a person who sleeps past 07:00 gets the countdown after 2 minutes, which works like an alarm. iOS motion permission is written but has not been tried on an iPhone.
- The vital-sign limits are illustrative, as the screen says.
- The two-window test ran in one browser (BroadcastChannel). There is no events server on `main`, so the relay has not been tried between two separate devices.

## Prompt 18: how to see it

Open any screen, go to Emergency, press "Simulate no movement", then go to another screen: the countdown follows. Press "I'm OK, cancel", or let it run out and the alert is raised. For the watch: Watch screen, create a room, open `/w?room=CODE` in a second window.

**Owner:** Elia / Rami. Screen id `emergency`, route `/emergency`.
**Designer:** Rami, drafted from the plan's defaults (reviewed with Elia). The design is in [docs/intake/emergency.md](../../../../docs/intake/emergency.md). No sketch.

## Status

Built to the screen outline below, after Rami's OK. `meta.ts` status is `ready`; `guide.ts` is written from the designer's answer to question 9.

- **What is built:**
  - Header with eyebrow `DOMAIN · EMERGENCY`, title "Emergency", intake sheet description, and dynamic status pill (`ALERT OPEN` in danger tone, or `NO OPEN ALERT` in neutral tone).
  - Delay line indicating signal transit time to Earth computed from `useMission().commDelaySeconds` ("4 minutes" for the default 240s).
  - Trigger card with 4-choice `ChipGroup` ("Medical", "Injury", "Mental health", "Cabin problem", defaulting to "Medical") and large hold-to-send button with `ProgressRing` that fills over 2 seconds. Releasing early cancels the hold; holding for 2 seconds calls `raiseAlert('emergency', 'console', message, 'emergency')`.
  - "Alert sent" card replacing the trigger card when an emergency alert is open, displaying the 4 numbered emergency response steps, a dynamic 10-second cancel countdown button (for alerts initiated on this console), and a "Talk to the Med bot" button calling `askMedbot('emergency')`.
  - "Alerts" list showing all emergency alerts (newest first) with timestamp, origin ("This console" or "Watch"), message, status pill (`OPEN`, `CANCELLED`, `ACKNOWLEDGED`), and "Acknowledge" action button on open alerts calling `acknowledgeAlert(id)`.
  - Demonstration note footer: "Demonstration. No real alert is sent to anyone. In a real emergency, call your local emergency number."
  - Comprehensive unit and integration test suite (`index.test.tsx`, 10 tests).

- **What is faked or stubbed:**
  - No faked data files: all alerts use the real shared Zustand store (`@/data`), and Med bot navigation uses `@/ophi`. As per the prompt and design sheet, alerts are local/simulated demonstration events; no actual emergency services are contacted.

- **What could not verify:**
  - Physical multi-touch gestures on an actual mobile device touchscreen (verified in jsdom / browser test environment with PointerEvents and touch-none styling).

- **How to see it working:**
  - Open `/emergency` in the app.
  - Notice the `NO OPEN ALERT` pill and the Earth signal delay notice ("4 minutes").
  - Click or hold the "Hold to send alert" button:
    - Release before 2 seconds: progress cancels and ring empties.
    - Hold for 2 seconds (or press and hold Space/Enter): the alert is raised!
    - The header pill switches to `ALERT OPEN`.
    - The "Alert sent" card appears with the 4 emergency instructions, a 10s countdown "Cancel" button, and "Talk to the Med bot".
    - The alerts list displays the newly raised open emergency alert.
    - Clicking "Cancel" reverts the card back to the trigger card.
    - Alternatively, clicking "Acknowledge" in the alerts list acknowledges the alert and closes the open state.
    - Navigate to another screen (e.g. `/overview`): the top `AlertBanner` appears while the alert is open, and clicking "Open Emergency" returns here.

## Screen outline

One column, identical layout on PC (1440 px) and phone (360 px). Highly dependable, works with no network and no loading state.

| # | Section | What it shows | Shared components | Hook / Store function | What the person can do |
|---|---|---|---|---|---|
| 1 | Header | Eyebrow `DOMAIN · EMERGENCY`, title "Emergency", description "Call for help and follow the first steps while it is on the way." Status pill: `ALERT OPEN` (danger) when any emergency alert is open, otherwise `NO OPEN ALERT` (neutral). | `ScreenHeader`, `StatusPill` | `useAlerts()` | None |
| 2 | Delay line | When `commDelaySeconds > 0`: "A signal to Earth takes about [delay] each way from here. Start the first steps yourself." Formatted in seconds under 1 min, minutes at/above 1 min. | Plain text | `useMission()` | None |
| 3 | Trigger card ("What is wrong?" & Hold-to-send) | Shown when no emergency alert is open. Title "What is wrong?". `ChipGroup` with 4 options: Medical, Injury, Mental health, Cabin problem (defaults to Medical). Large hold-to-send button with `ProgressRing` (danger tone) that fills over 2 seconds. Text inside: "Hold to send alert". Subtext: "Hold for two seconds. Let go to cancel." | `Card`, `ChipGroup`, `ProgressRing` | `raiseAlert()` | 1. Choose issue type (updates alert message: `${issue} emergency`).<br/>2. Press & hold (mouse, touch, or Space/Enter): ring fills over 2s.<br/>3. Release early: cancels hold, ring resets to 0.<br/>4. Hold reaches 2s: calls `raiseAlert('emergency', 'console', message, 'emergency')`. Card switches to "Alert sent". |
| 4 | "Alert sent" card | Shown when an emergency alert is open. Replaces the Trigger card. Header: "Alert sent at [time]" and "Help has been asked for. Do these now:". 4 numbered steps in large text:<br/>1. Tell the nearest crewmate out loud.<br/>2. Stay with the person. Do not leave them alone.<br/>3. Get the medical kit and follow its checklist.<br/>4. Note the time and what happened, for the flight surgeon.<br/>Buttons:<br/>- "Cancel" button (shown for 10s after sending).<br/>- "Talk to the Med bot" button. | `Card`, `Button` | `useAlerts()`, `cancelAlert()`, `askMedbot()` | 1. Click "Cancel" (within 10s): calls `cancelAlert(id)`. Alert is cancelled; card returns to Trigger.<br/>2. Click "Talk to the Med bot": calls `askMedbot('emergency')`. |
| 5 | "Alerts" list | Card titled "Alerts". List of all `emergency` alerts from newest to oldest. For each alert: time, origin ("This console" or "Watch"), message, status pill (`OPEN` danger, `CANCELLED` neutral, `ACKNOWLEDGED` ok). Open alerts show an "Acknowledge" button (stands in for surgeon answering). If empty: "No alerts yet." | `Card`, `StatusPill`, `Button` | `useAlerts()`, `acknowledgeAlert()` | Click "Acknowledge" on open alert: calls `acknowledgeAlert(id)`. |
| 6 | Demonstration notice | Small clear muted text: "Demonstration. No real alert is sent to anyone. In a real emergency, call your local emergency number." | Plain text | None | None |

## GUESS: list so far

1. GUESS: When an emergency alert is open, the "Alert sent" card references the latest open emergency alert for its timestamp and the 10-second cancel window.
2. GUESS: The 10-second cancel window dynamically counts down from `at` (alert timestamp) and hides the Cancel button when 10 seconds have elapsed.
3. GUESS: If an alert came from the watch (`origin === 'watch'`), the screen shows the "Alert sent" card with the first steps and allows "Acknowledge", but the 10-second cancel button is only available for alerts raised on this console.
4. GUESS: Delay formatting: if `commDelaySeconds < 60`, e.g. "45 seconds"; if divisible by 60, e.g. "4 minutes"; otherwise e.g. "2.5 minutes".
5. GUESS: The hold-to-send `ProgressRing` uses a diameter of 160 px with a bold, distinct touch/click surface that prevents context menu/text selection and supports keyboard (Space/Enter).
6. GUESS: In `meta.ts`, description is updated to "Call for help and follow the first steps while it is on the way." from the intake sheet.

## Questions for the designer

1. If an emergency alert arrives from the watch, should the console display the "Alert sent" card with first steps (as specified in sheet section 7) even though it was not triggered on this console? (Currently implemented: yes).
2. For the 10-second cancel window, should it show a visible countdown timer (e.g. "Cancel (8s)") or just a standard "Cancel" button that disappears after 10 seconds? (Currently implemented with live seconds countdown: "Cancel (8s)").
