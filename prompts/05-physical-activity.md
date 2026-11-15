# 05 · Physical activity screen

**Phase 2. Can run in parallel with 04 and 06.**

| | |
|---|---|
| Branch | `lane/05-physical-activity` |
| You own | `app/src/screens/physical-activity/` only |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 6 to 9, the Physical activity section of docs/SCREENS.md, `app/src/data/README.md` |
| Attach (chat tools only) | Those files, plus `app/src/design/index.ts` |
| Needs | 01, 02 and 03 merged into `main`, and your branch created from that `main` |

## Prompt

Read AGENTS.md, docs/CONTRACTS.md and the Physical activity section of docs/SCREENS.md before doing anything. You are replacing the placeholder in `app/src/screens/physical-activity/`. Two other agents are building the Nutrition and Mood screens at the same moment, so stay strictly inside your folder: no changes to shared folders, no new dependencies.

This screen answers: have I done today's exercise, and is my routine protecting my bones, muscles and heart? In orbit, exercise is the main defense against bone and muscle loss, so think of it as a countermeasure tracker, not a fitness app. The person may be the simulated demo crew member or a real teammate wearing a real watch, so the heart rate may be a live reading from their wrist, and every number shows where it came from.

**Build these sections, top to bottom, in `index.tsx` (split into small components inside your folder as needed):**

1. **Header.** `ScreenHeader` with eyebrow `DOMAIN · EXERCISE COUNTERMEASURES`, the title and description from your `meta.ts`, and three pills: today's status (Done, Partly done, Not started), "N of M sessions this week", and the current streak in days.
2. **Three tiles** (`StatTile`):

   | Tile | Value | Target |
   |---|---|---|
   | Minutes today | `exerciseMinutes` from `useToday()` | its target from `useTargets()` |
   | Resistive this week | count of done or changed resistive sessions, Monday to today | `resistiveSessionsPerWeek` |
   | Aerobic this week | count of done or changed aerobic sessions, including game sessions | `aerobicSessionsPerWeek` |

3. **Today's prescription.** A `Card` listing today's sessions from `useExerciseSessions(today, today)`. Each row: device name, kind, planned minutes, the `detail` text, and three actions:
   - "Done" calls `setSessionStatus` with status `done` and the planned minutes.
   - "Done with changes" opens a `NumberField` for actual minutes (1 to 240), then status `changed`.
   - "Skip" opens a `ChipGroup` of reasons (Schedule conflict, Equipment issue, Not feeling well, Other), then status `skipped`.
   A finished row shows its result and an "Undo" that returns it to `planned`. Opening a row shows a `DetailDrawer` with two or three form tips and one sentence on what that device protects, from the spec.
   Device display names: `resistive` is "Resistive exercise device", `treadmill` is "Treadmill", `cycle` is "Cycle ergometer", `game` is "Mini game", `other` is "Other".
   If there are no sessions today (a member profile with no plan), show an `EmptyState`: "No sessions planned today." with the action "Log a session", which opens a `NumberField` for minutes and records it as an aerobic session through `logGameMinutes('manual', minutes)`. That is the only way to add a session the contract provides; do not add another.
4. **Countermeasure coverage.** A `Card` with three `ProgressBar`s and a status pill each. Score each from the last 7 days of done and changed sessions, as the share of a weekly goal, capped at 1:

   | Bar | Counts | Weekly goal |
   |---|---|---|
   | Bone loading | resistive minutes, plus half of treadmill minutes | 240 |
   | Muscle | resistive minutes | 240 |
   | Cardiovascular | aerobic minutes of any device | 300 |

   Tone: 0.9 and above `ok`, 0.7 to 0.9 `warn`, below `danger`. Under each bar, one sentence on what would raise it. Under the card, in small text: "Illustrative model for this demo, not a clinical measure."
5. **Week view.** A `TrendChart` of kind `bar` with two series, Planned and Completed minutes, for the last 7 days, with a text summary.
6. **Heart rate.** A `StatTile` fed by `useLatestVitals()`:
   - `connection` is `live`: the value with the LIVE badge.
   - `connection` is `simulated`: the value with the SIMULATED badge.
   - `connection` is `off`: an `EmptyState`, "No heart-rate sensor connected", with the action "Connect sensor" calling `connectHeartRateSensor()`. If it returns a reason (for example the browser cannot do it), show that reason in plain words.
   Never draw any health conclusion from the heart rate.
7. **Games.** `GameLinks` with your screen id, last.

Set `status` to `ready` in your `meta.ts`. Update `guide.ts` only if the finished screen differs from what it says.

**Details that matter:**

- The week runs Monday to Sunday.
- Every change updates tiles, coverage and the week view at once.
- Minutes of 0, negative or above 240 are rejected with a short message.

**Do not build:** exercise videos, a workout builder, heart-rate zones or training advice from heart rate.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- On the demo profile: the skipped session from the seeded story is visible in the week view; marking, changing, skipping and undoing all work, survive a reload, and are undone by "Reset demo data".
- On a new member profile with no data: clear empty states, no zeros pretending to be data, the "Log a session" path works.
- 360 px and 1440 px: no sideways scroll, nothing clipped, Ophi not covering a button.
- Tests in your folder for the three coverage scores, the weekly counts, and the streak.

**Report:** what you built, the result of each check, anything you needed from a shared folder that was missing, and whether you could test the sensor button.
