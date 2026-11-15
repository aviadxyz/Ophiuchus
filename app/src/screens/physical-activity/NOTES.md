# Physical activity

**Owner:** Rami. Screen id `physical-activity`, route `/physical-activity`.

## Implementation plan
- `compute.ts`: pure functions for coverage scores, weekly session counts, streak, week view data, and today status.
- `compute.test.ts`: tests for coverage scores, weekly counts, streak, today status, and edge cases.
- `TodayPrescriptionCard.tsx`: today's sessions card, Done / Done with changes / Skip actions, Undo, and DetailDrawer with tips.
- `CoverageCard.tsx`: countermeasure coverage card with 3 progress bars, status pills, and guidance.
- `HeartRateTile.tsx`: live/simulated heart-rate StatTile or EmptyState with connect sensor action.
- `index.tsx`: main screen assembling ScreenHeader with 3 summary pills, stat tiles, cards, and GameLinks.
- `index.test.tsx`: integration tests for actions, empty states, and simulator state.
- `meta.ts`: update status to 'ready'.

## What is built
- Complete Physical activity screen meeting all specs in `prompts/05-physical-activity.md`.
- `ScreenHeader` with eyebrow `DOMAIN · EXERCISE COUNTERMEASURES`, title, description, and three summary pills (Today's status, weekly sessions progress, and streak in days).
- Three `StatTile`s: Minutes today with 7-day sparkline, Resistive sessions this week (Monday to today) vs target, and Aerobic sessions this week vs target.
- "Today's prescription" card with sessions list, Done, Done with changes (1–240 min input), Skip (with reason choice), and Undo support. Form tips and countermeasure protection detail drawer for each device. EmptyState with "Log a session" action when no sessions are planned.
- "Countermeasure coverage" card with bone loading, muscle, and cardiovascular progress bars, status pills (`ON TARGET`, `WATCH`, `ACT`), actionable guidance, and demo model disclaimer.
- "Week view" bar chart with Planned vs Completed minutes for the last 7 days and screen reader text summary.
- Heart rate reading showing live or simulated vitals or an empty state offering Bluetooth sensor connection with error messages in plain words.
- `GameLinks` connecting to exercise mini-games.

## What is faked or stubbed
- Bluetooth Web API availability depends on browser hardware support; when unavailable or cancelled, plain error messaging is displayed.
- Illustrative weekly countermeasure coverage model is an educational demo model as stated on the card.

## What could not be verified
- Real Bluetooth hardware sensor pairing was tested via simulated vitals and software error paths since physical BLE hardware is unavailable in this test environment.
- Visual responsive layout was verified via automated unit and integration tests and DOM assertions at 360 px / 1440 px responsive breakpoints.

## How to see it working
1. Run `npm --prefix app run dev` and navigate to `http://localhost:5173/physical-activity`.
2. On the default demo profile, observe the three summary pills, today's sessions (1 done, 1 planned), week view with the skipped session from Day 11, and countermeasure coverage bars.
3. Test completing a session with changes or skipping with a reason; verify that tiles and week view update immediately.
4. Click "Undo" to reset a finished session to planned.
5. Create a new member profile from the About screen and switch to it to verify clean empty states with no fake zero values.
