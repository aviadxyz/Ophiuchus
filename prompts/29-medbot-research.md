# 29 · The Med bot answers from the team's research database

**Runs alone in its files. Can run beside prompt 28. Needs the live server.**

Today the Med bot on the public link answers from its instructions and the person's summary only. It never looks at the research the team collected in `DB layer/DB`. After this prompt, every question is matched against that research, the matching passages are given to the model with their sources, and the same passages are shown under the reply with a link, so the person can see where the answer comes from.

| | |
|---|---|
| Branch | `lane/29-medbot-research` |
| You own | In `app/worker/`: a new folder `research/` (the search code, its generated data file and its tests), a new script `tools/export-research.mjs`, and the lines in `chat.ts`, `types.ts`, `validation.ts`, `medbot-system-prompt.txt`, `worker.test.ts`, `README.md` and `NOTES.md` that use them. In `app/src/screens/medbot/`: the lines that read `sources` and show them, and their tests. In `app/package.json`: one `prebuild` line under `scripts`, nothing else |
| Read first | AGENTS.md. docs/CONTRACTS.md section 8 (`ChatSource`) and section 11 (`POST /api/chat`, look for `sources`). `app/worker/README.md`, `app/worker/chat.ts`, `app/worker/systemPrompt.ts`, `app/worker/medbot-system-prompt.txt`, `prompts/companion/medbot-system-prompt.md`. The research: `DB layer/NOTES.md`, `DB layer/README.md`, the CSV files under `DB layer/DB/draft/`. How the Risks screen already reads it: `app/src/screens/risks/tools/export-research.mjs`, the top of `app/src/screens/risks/research.generated.ts`, `app/src/screens/risks/NOTES.md`. The screen: `app/src/screens/medbot/index.tsx` and `scriptedReplies.ts` |
| Use | Claude Opus 5.5 |

## Prompt

The build has started and you may write code. Read AGENTS.md, docs/CONTRACTS.md and the files under "Read first" before doing anything. Touch only what is listed under "You own". Add no dependency. Every name you need is in the contract; if one is missing or looks wrong, stop and ask.

Three facts about the research that shape everything below:

1. Only `DB layer/DB/draft/` has content. `DB layer/DB/approved/` is empty. Every row is marked `pending`: it was extracted automatically from NASA and Canadian Space Agency pages and no clinician has reviewed it. The app must say so wherever a passage is shown.
2. The trustworthy part of a row is its quote. Evidence with `verification_status` `exact_match` is word for word from the source page, with the page's address. Use quotes, not the extractor's own summaries.
3. The folder `Med bot/` in the repo is a teammate's separate Python agent that runs on a laptop with a local model. It is not what the public link runs and it cannot run on Cloudflare. Do not run it, port it or edit it. The public Med bot is `app/worker/chat.ts`.

### Part 1. Turn the research into a file the server can search

Write `app/worker/tools/export-research.mjs`, a Node script with no dependency, in the style of the Risks script. It reads the CSV files in `DB layer/DB/draft/` and writes `app/worker/research/research.generated.ts`.

- Keep only passages backed by evidence marked `exact_match`. Each passage has: an id, the quote word for word, the source title, the source address, and the search words for it: the name and aliases of every item (risk factor, condition, countermeasure, environment, finding, biomarker) that the quote is evidence for, plus the names on both ends of every relation it supports.
- Leave out the `protocols` and `inventory` folders completely, and never copy a `dosage`, `frequency` or `duration` column. The draft protocols are unreviewed and the Med bot never gives a dose.
- Leave out any passage whose source address is empty or does not start with `https://`.
- The same quote from the same source appears once, with its search words merged.
- The output is sorted and stable, so running the script twice gives the same file byte for byte. Its header says it is generated, from where, and how to run it again.
- You may copy the CSV parser from the Risks script into yours. Do not import from the Risks folder and do not edit it.
- If the `DB layer` folder cannot be found (a build that has only the `app` folder), the script prints one line saying it kept the file that is already there, and exits with success. It must never fail a build.
- Add `"prebuild": "node worker/tools/export-research.mjs"` to the scripts in `app/package.json`, so every build, including the one Cloudflare runs on each push to `main`, takes the research as it is on GitHub at that moment. Commit the generated file as well, so a build without the folder still has it.

### Part 2. Find the passages for a question

`app/worker/research/search.ts`: one pure function, `findPassages(question, screenLabel)`, returning at most four passages, best first.

- Lower-case, split into words, drop common English words and words under three letters, and treat simple plurals alike. No embedding model, no network call, no dependency.
- A match on a search word (an item name or alias) counts more than a match inside the quote. A whole multi-word name found in the question ("bone loss", "kidney stones") counts most. The screen label adds a little, so a question asked from the Sleep screen leans toward sleep passages.
- A passage needs a real match to be returned. A question with no match returns an empty list: showing an unrelated quote is worse than showing none. Set the threshold by trying it on the questions in the tests below.
- At most two passages from the same source, and at most 1,400 characters of quotes in total, so the model's instructions are not crowded out.
- It must run in a few milliseconds on the whole file. Build any index once when the module loads.
- Tests: "why do I lose bone in space" returns passages about bone; "what does radiation do to me" returns passages about radiation; "how do I tie my shoes" returns none; an empty or one-word nonsense question returns none; the two-per-source and character limits hold; every returned quote is found word for word in `DB layer/DB/draft/evidence/evidence.csv` (read the CSV in the test, as the Risks test does); and the committed generated file equals what the script produces now.

### Part 3. Give the passages to the model and return them

In `app/worker/chat.ts`:

- Call `findPassages` with the message and the screen label. When it returns passages, add a block to the user turn, after the context block and before the question:

  ```
  [research]
  1. "quote one" (Source title)
  2. "quote two" (Source title)
  [end research]
  ```

- Add one paragraph to `app/worker/medbot-system-prompt.txt`, written as an explanation and not as a rule list, saying: some messages come with a research block; the passages are quotes from NASA and Canadian Space Agency pages that the team collected, taken automatically and not reviewed by a clinician; when a passage answers the question, base the answer on it and say in plain words that it comes from the team's research; never say the research states something that is not in the block; when the block is absent or does not answer the question, answer as before and do not mention research; the limits on diagnosis and doses are unchanged and a passage never overrides them. Do not change any other paragraph of that file.
- The response gains `sources`: the passages that were given to the model, as `ChatSource` (`title`, `url`, `quote`). Empty when nothing matched. Always empty when `replyMode` is `watch`, and in watch mode do not add the block either: the watch reply is two short sentences.
- When the model cannot be reached and passages were found, the scripted fallback says it cannot reach its full brain and that the team's research has something on the question, and `sources` still carries the passages. When nothing was found the fallback is unchanged.
- `urgent` and `forward` work exactly as before. An urgent reply carries no sources: nothing competes with the Emergency instruction.
- Logging is unchanged: method, path, status, duration. Never the question or a passage.
- Tests in `worker.test.ts`, with a fake model: a bone question puts the block in the user turn and returns `sources`; a question with no match sends no block and returns an empty list; watch mode never has the block or sources; a model failure with matches returns the fallback with `sources`; an urgent reply has none; an old client that ignores `sources` still gets `reply`, `urgent` and `forward` as before.

### Part 4. Show the sources under the reply

In `app/src/screens/medbot/`:

- Read `sources` from the response. A missing field counts as an empty list, so the screen keeps working against a server that has not been updated.
- Under a Med bot reply that has sources, a small section headed "From the team's research". Each passage: the quote in quotation marks, and a `SourceLine` with the source title linking to its address. One line under the list: "Taken automatically from NASA and Canadian Space Agency pages. Not reviewed by a clinician."
- More than two passages: show two and a "Show all" button that opens the rest in place.
- Scripted replies and replies with no sources show nothing extra. Do not invent a source for them.
- Links open in a new tab. Long addresses and quotes wrap; nothing scrolls sideways at 360 px.
- Tests: a reply with sources shows each quote and a link with the right address; a reply without shows no section; a response with no `sources` field does not break.

### Do not build

An embedding index, a vector database, a call to any model other than the one `chat.ts` already uses, a new endpoint, storage of questions or answers, any use of the `protocols` or `inventory` data, or a rewrite of the system prompt.

### Checks you must run and pass before reporting

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` in `app`, all clean. `npm run build` must run the export first and leave no change in `git status` when the research has not changed.
- Run the export from the repo root and from `app`; both give the same file.
- Rename `DB layer` for a moment, run `npm run build`, confirm it still succeeds and says it kept the existing file, and rename it back.
- Print, for five questions of your choice across different body systems, the passages `findPassages` returns, and read them: are they about the question? Put the five questions and what came back in `NOTES.md`.
- Confirm no row from `protocols` or `inventory`, and no dose, is in the generated file.
- The size of the generated file, and that the Worker still builds with it.

**Report:** what you built, the result of each check, how many passages the file holds and from how many sources, the five test questions with their passages, and what you could not test (the live model's behaviour with the block, most likely).

When all checks pass, commit, push this branch, and report. Do not merge.
