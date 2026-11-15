# Risks

**Owner:** Aviad. Screen id `risks`, route `/risks`. Status `ready`.

## Plan (as built)

- `tools/export-research.mjs` reads `DB layer/DB/draft/*.csv` (hand-written CSV parser, no dependency) and writes `research.generated.ts`. Only evidence marked `exact_match` is kept.
- `research.generated.ts` is generated. Do not edit it. Re-run: `node src/screens/risks/tools/export-research.mjs` from `app/`.
- `systems.ts` groups research items into the ten body systems by name. It throws at load if a name, quote or countermeasure link is not in the research.
- `readings.ts` reads this person's data through `@/data` and gives each system its status (`signsFor`).
- `index.tsx` is the screen. `SystemDrawer.tsx` is the drawer. `risks.test.tsx` holds the tests.

## What is built

Header with `N TO WATCH` and `DRAFT RESEARCH`, the clinician note, a table of ten systems with a status pill, and a drawer per system: what it does, what spaceflight does to it, your signs today, what is done about it, evidence quotes with source title and address, and the Med bot button.

Status rules: the row shows the worst level among its readings. It is ON TARGET only when every reading that can have a status has data and is on target; one missing reading turns the row to NO DATA. Heart rate is shown but never decides a status (the store gives it no level). NOT TRACKED is for systems with no reading in this app (Pulmonary, Nervous system, Immune, Radiation).

Readings per system: Cardiovascular (exercise minutes, heart rate), Skeletal (calcium, vitamin D, resistive sessions in the last 7 days), Renal (water, sodium), Sleep and psychological (sleep, mood), Digestive (energy, protein), Metabolic (body mass, energy, protein).

## Counts from the research

| System | Risk items | Countermeasures | Quotes |
|---|---|---|---|
| Cardiovascular | 3 | 1 | 3 |
| Pulmonary | 5 | 4 | 3 |
| Skeletal | 5 | 4 | 3 |
| Renal | 0 | 0 | 0 |
| Nervous system | 4 | 2 | 3 |
| Sleep and psychological | 8 | 3 | 3 |
| Digestive | 3 | 0 | 3 |
| Immune | 4 | 0 | 3 |
| Metabolic | 4 | 1 | 3 |
| Radiation | 4 | 2 | 3 |

Renal is empty: nothing in the research is about the kidneys or urinary system. The screen says so.

## Judgement calls and what is not shown

- The research gives no body system and no severity for any item. Placement in a system is the team's judgement. No system is ranked.
- "What this system does" sentences are written by the team (`whatItDoesBy: 'team'`). Everything else is looked up from the research.
- Left out on purpose: antibiotics, anti-inflammatories and disinfectants (Immune), and the B vitamin supplement (Nervous system), because this app names no medicine. Immune therefore shows a note instead of countermeasures.
- Also left out: items that are not health risks or whose stored quote does not support them ("astronauts", "Human Research Roadmap", project names, "exercise regimens", "mission readiness assessments", radiation detectors such as CANS, "reduced physical activity" / "accelerated aging").
- The Sleep reading has no "log it" link because the Sleep screen is still a placeholder.

## Faked or stubbed

Nothing is faked. The research is automatic extraction, all `pending`, unreviewed.

## Not verified

Not checked on a real phone or watch. Checked in desktop Chrome at 360 px and 1440 px: no sideways scrolling, no console errors.

## See it working

`npm run dev`, open `/risks`. On the demo profile, Skeletal shows a flagged reading; open its row. Switch to a new member profile in the sidebar: no row says ON TARGET.
