# 14 · Overview screen: body systems and today's routine

**Phase 3, first. Can run in parallel with 07, 08 part A and 10 part B. If a fourth agent is free, it can also run in phase 2 beside 04, 05 and 06.**

This is the landing page, so it is the first thing a judge sees. It carries two things taken straight from the challenge text ([docs/CHALLENGE.md](../docs/CHALLENGE.md)): a human figure with clickable parts, and a routine that prompts the crew member through the day.

This prompt builds the whole screen with a plain working figure. [Prompt 15](15-body-figure.md) then replaces the figure with a high-quality anatomical one. Do not attempt the anatomical drawing here.

| | |
|---|---|
| Branch | `lane/14-overview` |
| You own | `app/src/screens/overview/` including its `figure/` subfolder |
| Read first | AGENTS.md, docs/CHALLENGE.md, docs/CONTRACTS.md sections 3 and 5 to 9 and 12, the whole Overview section of docs/SCREENS.md, docs/DESIGN_SYSTEM.md, `app/src/data/README.md` |
| Attach (chat tools only) | Those files, plus `app/src/design/index.ts` and `app/src/design/tokens.css` |
| Needs | 01, 02 and 03 merged into `main`, and your branch created from that `main`. It does not need any other screen to be finished |
| Model | An inexpensive model is fine. Everything is specified |

## Prompt

Read AGENTS.md, docs/CONTRACTS.md and the Overview section of docs/SCREENS.md before doing anything. You are replacing the placeholder in `app/src/screens/overview/`. Other agents are building other screens at the same moment, so stay strictly inside your folder: no changes to shared folders, no new dependencies. You reach other screens only by navigating to their route (`/<screen-id>`, CONTRACTS section 3), never by importing from their folders.

This screen answers three questions for a crew member in under ten seconds: how am I today, which part of me needs attention, and what is still to do? The person may be the simulated demo crew member or a real teammate, so every number shows where it came from, and missing data is shown as missing.

**Files to create in your folder.** Keep the logic in the plain files so it can be tested without rendering anything.

| File | Holds |
|---|---|
| `index.tsx` | The screen: reads the hooks, lays out the sections |
| `systems.ts` | The sixteen body systems. For each: `id`, `label`, `bodySystem`, `kind`, `metricIds`, `readings`, `routes`, `whatItDoes`, `inSpace`, `howChecked`, `sourceText`, `sourceUrl`. Ids, labels, kinds, metric ids, readings and routes come from the first table under "Body systems" in docs/SCREENS.md. The three texts are copied word for word from the "Text for each system" table. `sourceText` and `sourceUrl` are empty for now |
| `systemStatus.ts` | Two functions. `worstLevel` takes a list of `Level` and returns the worst: `act` beats `watch`, `watch` beats `ok`, `none` is ignored unless every entry is `none`. `systemStatus` takes a system and today's `DaySummary` and returns `untracked` when the system has no metric ids, otherwise `worstLevel` of its metrics' levels |
| `routine.ts` | One function: takes plain data and the current time, returns the seven routine items. No hooks inside |
| `figure/index.ts` | Exports `BodyFigure` and nothing else |
| `figure/BodyFigure.tsx` | The plain working figure, with exactly the inputs in "The figure" in docs/SCREENS.md |
| `SystemDrawer.tsx` | What opens when a system is chosen |
| `SystemList.tsx` | The sixteen systems as a list |
| `RoutineCard.tsx` | The routine list |
| `guide.ts`, `meta.ts`, `NOTES.md` | As in every screen folder |

**Build in this order. Each step leaves a working screen, so if time runs out the screen is still complete up to that point.**

1. **Header.** `ScreenHeader` with eyebrow `DOMAIN · OVERVIEW`, the title and description from your `meta.ts`, and three pills:
   - `MISSION DAY N`, tone `neutral`, from `useMission().day`.
   - `N OF M DONE`, counting routine items that are done out of those that are done or due. Tone `ok` when none is due, otherwise `warn`.
   - `N OPEN ALERTS`, tone `danger`, shown only when at least one alert from `useAlerts()` has status `open`.

2. **Five tiles** in a row (two per row under 640 px), each a `StatTile` fed from `useToday()`, `useTargets()` and `useSeries(metricId, 7)` for the trend. `onOpen` navigates to the route shown.

   | Tile | Metric id | Shown as | Opens |
   |---|---|---|---|
   | Sleep | `sleepHours` | hours, one decimal | `/sleep` |
   | Energy | `energyKcal` | kcal | `/nutrition` |
   | Water | `waterMl` | litres, one decimal | `/nutrition` |
   | Exercise | `exerciseMinutes` | min | `/physical-activity` |
   | Mood | `moodScore` | "of 5" | `/mood` |

   Each tile passes the metric's `level` and `source`. Target numbers come from `useTargets()`, never typed into the screen.

3. **Today's routine.** `RoutineCard`, a `Card` titled "Today's routine". `routine.ts` returns these seven items, always in this order:

   | Id | Label | Done when | Detail text | Action when due |
   |---|---|---|---|---|
   | `sleep` | Log last night's sleep | `useToday().sleepHours.value` is present | The hours | "Open Sleep", to `/sleep` |
   | `heart-rate` | Heart-rate reading | `useLatestVitals()` has a sample with `heartRate` whose `at` is today | The value in bpm, the time, and its `SourceBadge` | "Take a reading", to `/physical-activity` |
   | `mood` | Mood check-in | A check-in from `useMoodCheckins(1)` has `at` today | The time of the check-in | "Check in", to `/mood` |
   | `exercise` | Exercise | Every session from `useExerciseSessions(today, today)` has status `done` or `changed` | "1 of 2 sessions" | "Open Physical activity", to `/physical-activity` |
   | `water` | Water | `useToday().waterMl.level` is `ok` | Litres so far, one decimal | "Add 250 ml", calls `addWater(250)` and stays on the screen |
   | `vitamin-d` | Vitamin D | `useToday().vitaminDIu.value` is above zero | None | "Open Nutrition", to `/nutrition` |
   | `weigh-in` | Weekly weigh-in | Any entry of `useSeries('bodyMassKg', 7)` has a value | The latest value in kg | "Open Nutrition", to `/nutrition` |

   Rules:
   - Each item has a state: `done`, `due` or `not-planned`. Only `exercise` can be `not-planned`, when no session is planned today. A session with status `skipped` leaves the item `due` with the detail "1 skipped".
   - Each row shows the label, the detail text, and a `StatusPill`: DONE with tone `ok`, DUE with tone `warn`, NOT PLANNED with tone `neutral`. A done row has no button.
   - Every button is a `Button` with variant `quiet`, except "Add 250 ml", which is `primary`.
   - The card's footer reads "Worked out from what you have logged today. Nothing extra is stored."
   - When everything is done: one line at the top of the card, "All done for today."

4. **Open alerts.** Only when at least one alert is open: a `Card` titled "Open alerts" listing them newest first, each with its time, origin ("This console" or "Watch"), message, and a `Button` "Open". "Open" goes to `/emergency` for kind `emergency`, otherwise to the alert's `screenId`, or `/emergency` if it has none. Do not add an acknowledge button here; that lives on the Emergency screen.

5. **Ophi's read.** A `Card` showing `useHealthSummary().ophiLine` and a `Button` "Ask the Med bot" that calls `askMedbot('overview')`. If the line is empty, show "Log something today and I will tell you how it looks."

6. **Body systems list.** `SystemList` inside a `Card` titled "Body". Sixteen rows in the order of the table in docs/SCREENS.md, under two `SectionLabel`s: "ORGANS" for kind `organ`, "WHOLE BODY" for kind `whole-body`. Each row is a button showing the system's label and a `StatusPill` with its status label and tone (ON TARGET, WATCH, ACT, NO DATA, NOT TRACKED, as in the status table in docs/SCREENS.md). Choosing a row opens the drawer in step 7. This list is what makes every system reachable at 360 px and readable without color, so it is not optional and it comes before the figure.

7. **System drawer.** `SystemDrawer`, a `DetailDrawer` titled with the system's label, containing in this order:
   - The system's `bodySystem` as a `SectionLabel`, and a `StatusPill` with its status.
   - When the status is not `untracked`: the line "Based on what you logged today. It is not a medical finding."
   - When the status is `untracked`: the line "This demo does not measure this system. Here is what space does to it and how it would be checked on a mission."
   - `SectionLabel` "WHAT IT DOES" and `whatItDoes`.
   - `SectionLabel` "IN SPACE" and `inSpace`.
   - `SectionLabel` "HOW IT IS CHECKED ON A MISSION" and `howChecked`.
   - One `SourceLine` for the three texts. It shows the system's `sourceText` and `sourceUrl` when filled in, and "Source: to be confirmed" when empty.
   - `SectionLabel` "RIGHT NOW", only when the system has metric ids or readings. One row per metric id: the `label` of that metric's target from `useTargets()`, today's value with its unit, a `StatusPill` for its level, and its `SourceBadge`. A missing value reads "No data yet". Then one row per reading, with its `SourceBadge` and no pill:

     | Reading | From | When missing |
     |---|---|---|
     | Heart rate | `useLatestVitals()`, `heartRate`, in bpm | "No sensor connected" |
     | Blood oxygen | `useLatestVitals()`, `spo2`, in % | "Not measured by this sensor" |
     | Skin temperature | `useLatestVitals()`, `skinTempC`, in °C | "Not measured by this sensor" |
     | Body mass | The latest value in `useSeries('bodyMassKg', 14)`, in kg | "No data yet" |

   - One `Button` per route of the system, labeled "Open [screen label]", with the label from `getScreen` in `@/registry`.

8. **Working figure.** `figure/BodyFigure.tsx`, placed in the "Body" card to the left of the list on PC and above it under 900 px. Its inputs are exactly `systems`, `selectedId`, `onSelect` and `heartRate`, as in "The figure" in docs/SCREENS.md. The screen passes the heart rate from `useLatestVitals()`, or none.
   - One inline SVG, `viewBox="0 0 400 880"`, scaled to its container, at most 320 px wide. A plain front-view outline from simple shapes: head, neck, torso, two arms, two legs. No face. Stroke in the border token.
   - One round marker per organ system, radius 14, at these centers:

     | System | x | y | | System | x | y |
     |---|---|---|---|---|---|---|
     | `brain` | 200 | 52 | | `digestive` | 200 | 330 |
     | `eyes` | 178 | 86 | | `kidneys` | 244 | 318 |
     | `ears` | 246 | 90 | | `spine` | 200 | 392 |
     | `face` | 200 | 112 | | `reproductive` | 200 | 452 |
     | `heart` | 218 | 232 | | `bones` | 174 | 560 |
     | `lungs` | 168 | 236 | | `muscles` | 118 | 262 |

   - A marker's color is the tone of its system's status: fill at about 25% opacity, outline at full strength. Status `untracked` uses the neutral tone with a dashed outline. Take every color from the design tokens. Do not type a color value.
   - Each marker is a real control: `role="button"`, `tabIndex` 0, opens on click, Enter and Space, has a visible focus ring, and an accessible name such as "Kidneys and bladder, WATCH". The chosen marker is drawn larger with a second ring.
   - Under the SVG, a `ChipGroup` with the four whole-body systems. Each chip's text is the label followed by the status label, for example "Blood · WATCH", so the status is readable without color. Choosing a chip calls `onSelect`.
   - The heart marker beats at `heartRate` beats per minute when a heart rate is given. A marker with status `act` pulses slowly. Nothing moves when the system asks for reduced motion.
   - Do not draw organs, bones or muscles. That is prompt 15's job, and it will replace every file in `figure/` while keeping these inputs.

9. **Ophi's hint.** While this screen is open and at least one routine item is due: if `useOphiState()` is `idle`, call `setOphiState('hint')`. When the screen closes or nothing is due any more: if the state is still `hint`, set it back to `idle`. Never change it when it is `alert`, `talking` or `thinking`.

10. **`guide.ts`** with all four fields, word for word from "Guide text for Ophi" in the Overview section of docs/SCREENS.md. **`meta.ts`:** keep id, label, group and order; set `owner` to `Rami` and `status` to `ready`; description "Your whole day on one page: how each part of you is doing and what is still to do."

**Details that matter:**

- Every value shows its source badge. A metric with level `none` shows "No data yet" and never 0.
- The system texts are information about the body, never about the person. Do not add any sentence that says what is wrong with the user, and do not rewrite the texts. The statuses and the "Open" buttons are the only guidance.
- No health conclusion is drawn from heart rate, blood oxygen or skin temperature: they have no pill and no level anywhere on this screen.
- An untracked system never shows a value, a level or a color other than neutral.
- "Add 250 ml" updates the water tile, the water row, the pills and the `kidneys` system at once.
- "Today" is the device's local date. An item that depends on a time uses the `at` field of the record.
- Layout at 1440 px: tiles in one row; then the routine card and the body card side by side, the body card wider; alerts and Ophi's read below. At 360 px: one column in the order header, tiles, routine, body (figure, chips, then list), alerts, Ophi's read.

**Do not build:** the anatomical drawing, cabin or environment readings (there is no data for them), editing of any record other than the water button, reminders or notifications that fire by themselves, streaks or points, any system beyond the sixteen.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- Tests in your folder for `worstLevel` (all `none`, mixed with `none`, empty list, each pair), for `systemStatus` (a tracked system, an untracked one, a tracked one with no data), for `routine` (each item done and due, exercise with no sessions, with one skipped, with all done), and one test that `systems.ts` has exactly the sixteen ids in docs/SCREENS.md with no empty text.
- On the demo profile: tiles are filled; the routine shows a mix of DONE and DUE; "Add 250 ml" changes the water row; a mood check-in made on the Mood screen turns that row to DONE when you come back.
- On a new member profile with no data: every routine item is DUE or NOT PLANNED, tracked systems read NO DATA, untracked ones read NOT TRACKED, no zeros, no errors.
- Each of the sixteen systems opens its drawer from the list, and from its marker or chip, by mouse, by touch and by keyboard alone. Focus returns to the control that opened it.
- Every "Open" button lands on the right screen, including screens that are still placeholders.
- 360 px and 1440 px: no sideways scroll, nothing clipped, Ophi not covering a button.
- With "reduce motion" on in the system settings, nothing moves.

**Report:** what you built, the result of each check, which step you reached if you ran out of time, anything you needed from a shared folder that was missing, and a reminder that the sixteen system texts still show "Source: to be confirmed".
