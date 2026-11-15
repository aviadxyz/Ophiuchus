# 20 · Risks, from the team's research database

**Runs alone in its folder. Can run beside every other prompt.**

The Risks tab is still a placeholder. A teammate built a research database (`DB layer/`) by reading NASA and Canadian Space Agency pages, and a recommendation service on top of it (`Recommendation_agent/`). This prompt turns that research into the Risks screen. The service itself is a Python backend and is not used: the screen reads a small data file made from the database.

| | |
|---|---|
| Branch | `lane/20-risks` |
| You own | `app/src/screens/risks/` only |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 4 to 9, docs/DESIGN_SYSTEM.md, docs/CHALLENGE.md, `app/src/data/README.md`, `app/README.md`, `DB layer/README.md`, `Recommendation_agent/README.md`, and the CSV files under `DB layer/DB/draft/` |
| Read only, never change | Everything under `DB layer/` and `Recommendation_agent/` |

## Prompt

The build has started and you may write code. Read AGENTS.md, docs/CONTRACTS.md and docs/DESIGN_SYSTEM.md before doing anything. You are replacing the placeholder in `app/src/screens/risks/`. Touch nothing outside that folder. Add no dependency and no color.

Ophiuchus is an astronaut health console for people who are not medical experts. The Risks screen answers one question: "What does spaceflight do to my body, which of those risks am I showing signs of today, and what is done about each?" Hackathon judges will open it with nobody explaining.

### Step 1. Turn the research into one data file

The research is in `DB layer/DB/draft/`: risk factors, conditions, countermeasures (`entities/treatments.csv`), the links between them (`relations/`), and for each link a claim and a piece of evidence with the exact quoted text and the page it came from (`evidence/`, `metadata/sources.csv`). It was extracted automatically and is marked `pending`, so it is noisy: some "conditions" are not conditions at all ("astronauts", "Human Research Roadmap", project names).

1. Write a small Node script at `app/src/screens/risks/tools/export-research.mjs` that reads those CSV files and writes `app/src/screens/risks/research.generated.ts`. It keeps only rows whose evidence has `verification_status` `exact_match`, and for each kept item carries the quoted evidence text, the source title and the source address. It adds no dependency (parse the CSV by hand; fields can be quoted and contain commas). Run it and commit both the script and its output.
2. In a second, hand-written file, `systems.ts`, group what the script kept into the ten body systems below. For each system list: the major risks (two to four short names), the conditions and risk factors from the research that belong to it, the countermeasures the research links to them, and up to three evidence quotes with their sources. Drop anything that is not a health risk. Where the research has nothing for a system, say so in the data and show it on screen. **Do not write a fact, a countermeasure or a quote that is not in the research files.** Plain-language explanations of what a body system does are the one exception; mark those in the data as written by the team.

Systems, in this order: Cardiovascular, Pulmonary, Skeletal, Renal, Nervous system, Sleep and psychological, Digestive, Immune, Metabolic, Radiation.

### Step 2. The screen

1. **Header.** `ScreenHeader`, eyebrow `DOMAIN · FLIGHT RISK MAP`, title "Risks", description "What spaceflight does to each part of the body, the signs you are showing today, and what is done about it." Pills: how many systems show signs today (`N TO WATCH`, tone `warn`, or `danger` if any is at `act`), and `DRAFT RESEARCH` (tone `neutral`).
2. **A line under the header:** "Research gathered by the team from NASA and Canadian Space Agency pages. It has not been reviewed by a clinician."
3. **The table.** `DataTable` with columns System, Major risks, Your signs today, plus the pill. One row per system.
   - "Your signs today" comes from this person's own data, through `@/data`: Cardiovascular from exercise minutes and the latest heart rate; Skeletal from calcium, vitamin D and resistive sessions this week; Renal from water and sodium; Sleep and psychological from sleep hours and mood; Digestive and Metabolic from energy, protein and body mass; the rest have no reading in this app. Show the worst level among a system's readings as the row's pill (ON TARGET, WATCH, ACT), and `NOT TRACKED` (tone `neutral`) for systems with no reading. A reading with no data counts as NO DATA and never as on target.
   - The bar tone on each row follows the same level.
4. **A row opens a `DetailDrawer`** with, in this order:
   - What this system does, in one or two plain sentences (written by the team).
   - "What spaceflight does to it": the risks, in plain words taken from the research descriptions.
   - "Your signs today": each reading that feeds this system, with value, unit, source badge, target and status pill, and a quiet link to the screen where it is logged (Nutrition, Physical activity, Mood). For a system with none: "This app does not track a reading for this system."
   - "What is done about it": the countermeasures from the research, as a short list.
   - "Evidence": up to three quotes, each in quotation marks, each followed by a `SourceLine` with the source title and its address.
   - One quiet button, "Ask the Med bot about this" (`askMedbot('risks')`). When any sign is at `act`, also the sentence "If this stays off target, raise it with the flight surgeon."
5. **No severity ranking.** Do not show "high / moderate" severity per system unless you can quote NASA's own rating for it from the research files. A ranking with no source is worse than none.
6. **`guide.ts`**, all four fields, in plain words. `meta.ts`: status `ready`, owner unchanged.

### Do not build

A call to the Python service, any diagnosis, any medicine name or dose, a body drawing, genetics or "susceptibility" claims about the person, or anything outside your folder.

### Checks you must run and pass before reporting

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` in `app`, all clean.
- On the demo profile, at least one system shows WATCH or ACT, and its drawer names the reading that caused it.
- On a new member profile with no data, no system shows ON TARGET.
- Every quote on screen appears word for word in `DB layer/DB/draft/evidence/evidence.csv`. Write a test that checks this against the generated file.
- 360 px and 1440 px: no sideways scrolling, nothing clipped.

**Report:** what you built, the result of each check, how many items the research gave each system and which systems came out empty, and anything in the research that looked wrong.

When all checks pass, commit, push this branch, and report. Do not merge.
