# 04 · Nutrition screen

**Phase 2. Can run in parallel with 05 and 06.**

| | |
|---|---|
| Branch | `lane/04-nutrition` |
| You own | `app/src/screens/nutrition/` only |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 6 to 9, the Nutrition section of docs/SCREENS.md, `app/src/data/README.md` |
| Attach (chat tools only) | Those files, plus `app/src/design/index.ts` |
| Needs | 01, 02 and 03 merged into `main`, and your branch created from that `main` |

## Prompt

Read AGENTS.md, docs/CONTRACTS.md and the Nutrition section of docs/SCREENS.md before doing anything. You are replacing the placeholder in `app/src/screens/nutrition/`. Two other agents are building the Physical activity and Mood screens at the same moment, so stay strictly inside your folder: no changes to shared folders, no new dependencies.

This screen answers one question for a crew member: am I eating and drinking enough of the right things to stay healthy on this mission? The person may be the simulated demo crew member or a real teammate entering their own meals, so every number shows where it came from, and days with no data show as empty instead of zero.

**Build these sections, top to bottom, in `index.tsx` (split into small components inside your folder as needed):**

1. **Header.** `ScreenHeader` with eyebrow `DOMAIN · NUTRITION`, the title and description from your `meta.ts`, and three pills: energy level, water level, and "N off target" counting the six nutrients in section 3 below.
2. **Four tiles** in a row (two per row under 640 px), each a `StatTile` fed from `useToday()` and `useSeries(metricId, 7)`:

   | Tile | Metric id | Unit | Target text example |
   |---|---|---|---|
   | Energy | `energyKcal` | kcal | "of 2,900 today" |
   | Water | `waterMl` | shown in L | "of 2.5 L today" |
   | Protein | `proteinG` | g | "of 110 g today" |
   | Sodium | `sodiumMg` | mg | "limit 3,500" |

   Target numbers come from `useTargets()`, never typed into the screen.
3. **Space-critical nutrients.** A `Card` titled "Space-critical nutrients" holding a `DataTable` with columns Nutrient, Why it matters in space, Today, Status. Rows, in order: `vitaminDIu`, `calciumMg`, `ironMg`, `sodiumMg`, `omega3G`, `potassiumMg`. "Why it matters" is one short phrase per row taken from the spec. The row's bar tone and pill come from the metric's level. Opening a row shows a `DetailDrawer` with: a 7-day `TrendChart` with the target line, the `SourceLine` from the target, and the three foods from `useFoods()` richest in that nutrient (lowest, for sodium and iron).
4. **Today's meals.** A `Card` listing `useMeals(today)` grouped as Breakfast, Lunch, Dinner, Snacks by time of day. Each entry shows the food name, portions, kcal, and a remove button that calls `removeMeal`. Water entries from `useWater(today)` appear as one line, "Water: 1.5 L in 6 entries". Two buttons: "Add food" and "Add water 250 ml" (calls `addWater(250)`).
5. **Add food.** A `DetailDrawer` with a `TextField` search over `useFoods()`, each result showing name, kcal, and its two most notable nutrients, with a portions `NumberField` (0.5 to 5, step 0.5) and an Add button that calls `addMeal`. The drawer stays open after adding so several items can be added quickly, and shows "Added" briefly.
6. **Body mass.** A `Card` with a `TrendChart` of `useSeries('bodyMassKg', 14)` and, when the latest value is more than 5% below the first, the note "Down more than 5% since the start of the mission. Worth raising with your flight surgeon." A small "Log today's weight" field calling `addBodyMass`. If there is no body mass data, an `EmptyState` with that same action.
7. **Suggestion.** One `Card` showing the first rule below that applies, in this priority order:
   1. Sodium level is `act`: suggest lower-sodium choices for the rest of the day.
   2. Energy level is `act` and the time is after 16:00: state the gap in kcal and name two foods from the list that would close most of it.
   3. Water level is `watch` or `act`: suggest a drink, with the amount still to go.
   4. Vitamin D has no intake today: remind about the daily supplement.
   5. Otherwise: one positive sentence.

   Keep each rule's wording to two sentences and within the medical caution rules in AGENTS.md.
8. **Games.** `GameLinks` with your screen id, last.

Set `status` to `ready` in your `meta.ts`. Update `guide.ts` only if the finished screen differs from what it says.

**Details that matter:**

- Every `StatTile` and every value in the table passes the metric's `source`, so the badge shows.
- A metric with level `none` shows "No data yet" and never 0.
- Every add and remove updates tiles, table, pills and suggestion at once.
- Format numbers with thousands separators; water in litres to one decimal.

**Do not build:** custom foods, barcode scanning, recipes, meal plans.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- On the demo profile: tiles, table and suggestion are filled; adding a meal and a water changes them; a reload keeps the change; "Reset demo data" on About undoes it.
- On a new member profile with no data: no zeros pretending to be data, no errors, clear empty states.
- Twenty meals in one day still lay out correctly.
- 360 px and 1440 px: no sideways scroll, nothing clipped, Ophi not covering a button.
- Tests in your folder for the five suggestion rules and for the "N off target" count.

**Report:** what you built, the result of each check, anything you needed from a shared folder that was missing, and which targets still show "to be confirmed".
