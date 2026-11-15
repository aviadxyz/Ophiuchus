# Plan
1. meta.ts, guide.ts: update screen metadata and Ophi guide text per spec.
2. systems.ts: define 16 body systems with metrics, readings, routes, and spaceflight texts.
3. systemStatus.ts: implement worstLevel and systemStatus evaluation logic.
4. routine.ts: pure function computing the seven daily routine items and progress.
5. figure/BodyFigure.tsx, figure/index.ts: SVG figure with markers, whole-body chips, heart beat & pulse animations.
6. SystemList.tsx: accessible list of 16 systems split into organs and whole body with status pills.
7. SystemDrawer.tsx: DetailDrawer displaying system physiology, mission checks, live metrics & readings, route buttons.
8. RoutineCard.tsx: Card rendering today's routine items with status pills, action buttons, and completion state.
9. index.tsx: assemble ScreenHeader, StatTiles, RoutineCard, Body card (figure + list), open alerts, Ophi read & hint.
10. overview.test.tsx: Vitest suite covering worstLevel, systemStatus, routine logic, and systems specifications.

# Overview

**Owner:** Rami. Screen id `overview`, route `/overview`. Status `ready`.

## What is built
- `ScreenHeader` with eyebrow `DOMAIN · OVERVIEW`, title `Overview`, and summary pills: `MISSION DAY N`, `N OF M DONE`, and `N OPEN ALERTS` (when alerts are active).
- Five `StatTile` metrics: Sleep (`sleepHours`, hours with one decimal), Energy (`energyKcal`, kcal), Water (`waterMl`, litres with one decimal), Exercise (`exerciseMinutes`, min), and Mood (`moodScore`, of 5) with targets, source badges, and 7-day sparklines.
- `RoutineCard`: lists the seven routine items (sleep, heart rate, mood, exercise, water, vitamin D, weekly weigh-in) with live states (`done`, `due`, `not-planned`), detail text, source badges, "Add 250 ml" primary action, quiet navigation buttons, and "All done for today." banner when all are done.
- `BodyFigure`: plain working SVG figure (400x880 viewBox, max 320 px wide) with 12 organ markers, 4 whole-body system chips, accessible names, focus rings, heart beat animation timed to `heartRate`, act pulse animation, and `@media (prefers-reduced-motion: reduce)` support.
- `SystemList`: 16 body systems split into "ORGANS" and "WHOLE BODY" with `StatusPill`s (ON TARGET, WATCH, ACT, NO DATA, NOT TRACKED).
- `SystemDrawer`: opens on selection with system role, non-medical finding disclaimer (or untracked demo notice), WHAT IT DOES, IN SPACE, HOW IT IS CHECKED ON A MISSION, `SourceLine`, RIGHT NOW live metrics and readings (heart rate, blood oxygen, skin temp, body mass), and route navigation buttons.
- Open alerts card with alert origin ("This console" or "Watch"), message, timestamp, and "Open" navigation button.
- Ophi's read card with `ophiLine` and "Ask the Med bot" button.
- Ophi hint integration: sets Ophi state to `hint` when routine items are due, resets to `idle` when complete or upon unmounting.
- Vitest test suite (`overview.test.tsx`) covering `worstLevel`, `systemStatus`, `routine`, `systems` data integrity, and UI integration.

## What is faked or stubbed
- Per contract, the 16 body systems have empty `sourceText` and `sourceUrl` and currently render "Source: to be confirmed" under the three texts until filled in Phase 4 (prompt 16).
- The body figure is a plain working outline per prompt 14 specifications; prompt 15 will replace the files in `figure/` with high-quality anatomical artwork while preserving the component interface.

## What could not be verified
- Physical Bluetooth sensors were verified using the simulator and synthetic vital samples rather than real Bluetooth hardware.

## How to see it working
1. Run `npm --prefix app run dev` and open `http://localhost:5173/overview`.
2. On the default demo profile, observe the filled stat tiles, routine progress pill (e.g. 5 OF 7 DONE), open alerts, and Ophi hint dot.
3. Click "Add 250 ml" on the routine card to see the water tile, routine progress, kidneys system status, and water row update at once.
4. Click any organ marker on the figure or item in the list to open the `DetailDrawer`.
5. Switch to a new blank profile to confirm all tracked systems show NO DATA, untracked show NOT TRACKED, routine items are DUE or NOT PLANNED, with no errors or bogus zeros.

## "I don't feel well" (prompt 19, task 2)
A primary "I don't feel well" button sits next to "Ask the Med bot" in "Ophi's read" and opens the Med bot from Overview.
