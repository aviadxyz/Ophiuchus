# Nutrition

**Owner:** Rami. Screen id `nutrition`, route `/nutrition`.

## Plan

- `index.tsx` composes the sections in order and owns which drawers are open. `meta.ts` status `ready`.
- `format.ts` number, litre and date formatting. `nutrients.ts` the six space-critical nutrients, the off-target count, richest-food and notable-nutrient helpers.
- `suggestion.ts` the five suggestion rules as a pure function. `Tiles.tsx` the four stat tiles.
- `NutrientTable.tsx` the table and its detail drawer. `MealsCard.tsx` today's meals and the two add buttons.
- `AddFoodDrawer.tsx` search and add. `BodyMassCard.tsx` trend, note, weigh-in. `SuggestionCard.tsx`.
- Tests: the five rules and their priority, the off-target count, the helpers, and a screen test on the demo and an empty member profile.

## What is built

All eight sections of the prompt: header with three pills, four tiles with seven-day sparklines, the space-critical nutrients table with a detail drawer (seven-day chart with the target line, the target's source line, the three foods richest in it or lowest for sodium and iron), today's meals grouped by time of day with remove buttons and the water line, the Add food drawer, body mass with the 5% note and a weigh-in field, one suggestion, and the game links. `meta.ts` status is `ready`. `guide.ts` was left as it is; it matches the finished screen.

Choices the prompt left open:

- **"N off target"** counts the six nutrients at level `watch` or `act`. A nutrient with no data is not counted. When none of the six has data the pill reads NUTRIENTS NO DATA instead of "0 OFF TARGET". Its tone is danger if any is `act`, warn if any is `watch`, otherwise ok.
- **Meal groups** by time: breakfast 05:00 to 10:00, lunch 11:30 to 14:30, dinner 17:30 to 20:00, anything else is a snack.
- **Suggestion rule 2** (energy) uses the full-day target for the gap. Rule 3 (water) gives the amount still to go against the full-day target. Rule 1 and rule 2 name foods from `useFoods()` only.
- **"Notable nutrients"** in the Add food drawer are the two a food is highest in as a share of its daily target.
- A small "Remove last drink" button sits beside the water line, so a mistaken 250 ml tap can be undone. The prompt did not ask for it.
- Under 640 px the table's column headings are shortened ("Why" instead of "Why it matters in space") because the shared `DataTable` card layout gives a long heading most of the card's width and squeezes the text beside it to one letter per line. Hooked to a media query in `useNarrow.ts`.

## What is faked or stubbed

Nothing is faked. All numbers come from `@/data`. The "why it matters in space" phrases are seed wording from docs/SCREENS.md, plus one of mine for potassium (the spec lists potassium as a row but gives no reason), so they are unverified.

## Targets that still show "to be confirmed"

Every one. All targets in `@/data` have `verified: false`. Each tile row, the table, the drawer's chart, the body mass card and the suggestion show "Source: to be confirmed".

## What could not be verified

- The exact wording of the five suggestions has not been reviewed by a clinician.
- Ophi, fixed in the bottom-right corner, can sit over a right-edge button such as a remove button at some scroll positions, as any fixed helper does. Nothing is permanently hidden: the end of the page leaves room for it. Not changed here (lane 03).
- Not tested on a physical phone, only at 360 px in the browser pane.

## How to see it working

`npm run dev` in `app`, open `/nutrition` on the demo profile. Add water and a food, reload, then "Reset demo data" on About. Create a profile on About to see the empty states. `npm run test` runs the suggestion, helper and screen tests in this folder.
