# 16 · Fill in the sources

**Run once the challenge's resources are known and 02 and 14 are merged. Runs alone: it touches two other lanes' files, so nobody else may have those files open.**

Every target and every statement about the body in the app currently shows "Source: to be confirmed", because nothing was checked during preparation. Judges score scientific validity, so this is the highest-value hour of the weekend after the app works. This prompt replaces the placeholders with real sources, and corrects any number or sentence the sources contradict.

**Give this to a strong model in a tool that can open web pages.** It needs careful reading, and it must never invent a citation.

| | |
|---|---|
| Branch | `lane/16-sources` |
| You may change | In `app/src/data/targets.ts`: the fields `sourceText`, `sourceUrl`, `verified`, and, only after my OK, `value` and `upper`. In `app/src/screens/overview/systems.ts`: the fields `sourceText`, `sourceUrl`, and, only after my OK, the three text fields. Nothing else |
| Read first | AGENTS.md, the "Resources" section of docs/CHALLENGE.md, the seed-fact tables in docs/SCREENS.md, "Body systems" in docs/SCREENS.md, `app/src/data/targets.ts`, `app/src/screens/overview/systems.ts` |
| Needs | The resource links pasted by Rami into the "Resources" section of docs/CHALLENGE.md |

## Prompt

Read AGENTS.md and the "Resources" section of docs/CHALLENGE.md. Your job is to find a real, citable source for every target in `app/src/data/targets.ts` and for the text of every body system in `app/src/screens/overview/systems.ts`.

**Rules that cannot bend:**

- Cite only a page or document you actually opened in this session and in which you read the fact. Never cite from memory. Never guess a link.
- Prefer, in this order: the resources listed on the challenge page; NASA Human Research Program pages and evidence reports; other NASA technical documents; other space agencies; peer-reviewed papers. Do not cite news articles, encyclopedias or blogs.
- If you cannot find a source for something, leave it as it is and list it as not found. An honest "to be confirmed" is better than a weak citation.
- Change no number and no sentence without my OK.

**Step 1. Look, and report. Change nothing yet.** Give me two tables.

Targets:

| Target id | Value in the app | What the source says | Source title and link | Same, different, or not found |
|---|---|---|---|---|

Body systems, one row per system and text field (`whatItDoes`, `inSpace`, `howChecked`):

| System id | Field | Supported, partly, wrong, or not found | What the source says, in a few words | Source title and link |
|---|---|---|---|---|

For every row marked different, partly or wrong, propose the corrected value or sentence. Keep sentences as short and plain as the ones they replace, with no diagnosis and no drug names.

**Then stop and wait for my OK on the proposed changes.**

**Step 2. After my OK, write.**

- For each target with a source: set `sourceText` to a short citation (organization, document title, year) and `sourceUrl` to the link, and set `verified` to on. Apply the value changes I approved.
- For each body system with a source: set `sourceText` and `sourceUrl`. One source per system is enough; pick the one that supports the most of its text. Apply the sentence changes I approved.
- Leave everything else exactly as it was.

**Step 3. Report what is still unsourced,** and list any other statement of fact you noticed in the app that has no source (guide texts, the "why it matters" phrases on the Nutrition screen, the About screen). Do not edit those; their owners will.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean. If a test fails because an approved value changed, tell me which one instead of editing it.
- Open the app: a sourced target shows its source line with a working link; an unsourced one still shows "Source: to be confirmed"; the same for three body systems of your choice.
- Every link you wrote opens the page you cited.

**Report:** how many targets and systems are now sourced out of how many, the changes made to values and sentences, and the full list of what is still unsourced.
