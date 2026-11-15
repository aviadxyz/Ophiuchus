# Rules for coding agents

You are working on Ophiuchus, an astronaut health console built by a small team during a two-day hackathon. Several people and several agents, on different AI tools, work in this repo at the same time. These rules exist so the result is one product that works when the pieces are merged.

## Current phase

The build has started when a human says so in your prompt, or when `app/package.json` exists in the repo. Before that, this repo is in preparation: you may write and edit documents and prompts only, and must not create source files, configuration, or dependencies.

## What the product is for

The challenge asks for a visual tool that helps astronauts assess their own health during a mission and gives guidance on improving it. It must not assume the astronaut is a medical expert. Whatever you build should make a health indicator easier to read, explain why it matters in space, or tell the crew member what to do next and when to tell the flight surgeon. The full text is in [docs/CHALLENGE.md](docs/CHALLENGE.md).

## Read before your first change

1. [docs/CONTRACTS.md](docs/CONTRACTS.md), all of it. It fixes every shared name, path and shape.
2. [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), all of it.
3. [docs/CHALLENGE.md](docs/CHALLENGE.md), the text and "The five questions every screen answers".
4. The spec your prompt points to.

## The contract comes first

- Use the names, paths, fields and values in CONTRACTS.md exactly. Other agents are building against the same names right now and cannot see your work.
- If something you need is not in the contract, or the contract looks wrong, **stop and ask the human**. Do not invent a name, add a field, or work around it. A wrong guess costs more than a question.
- Do not edit CONTRACTS.md.

## Your lane

- Your prompt names the folders you own. Create and change files only there.
- Do not edit another lane's folder, the shared folders (`shell`, `registry`, `design`, `data`, `ophi`) unless your prompt gives them to you, or any file at the repo root.
- Import shared things only from `@/design`, `@/data`, `@/ophi` and `@/registry`. Never from another screen's folder or from a file deep inside a shared folder.
- Do not add, remove or upgrade a dependency. Everything allowed is already installed. If you believe you need one, stop and ask.
- Work on your own branch, named in your prompt. Do not switch branches, merge, rebase or push to `main`.
- Do not refactor, rename or reformat anything you were not asked to change.

## Look

- Build screens from the shared components. Do not add colors, fonts, shadows, or your own version of a component that exists.
- Every screen starts with `ScreenHeader`.
- Every screen works at 360 px wide and at 1440 px wide with no sideways scrolling.
- Status is never shown by color alone.

## Data

- Read and write through `@/data` only. Do not keep your own copy of shared data and do not touch browser storage.
- The app holds real health readings from real team members next to a simulated demo profile. Treat all of it as private:
  - Never write a real reading, name or export file into the repo, a test, a log line, an error message or a comment. Tests and examples use the `demo` profile.
  - Never send data anywhere except through the functions in `@/data`.
  - Show the source badge wherever a value is displayed, so live, entered, imported and simulated values are never confused.
  - Missing data is shown as missing. Do not fill gaps with made-up values.
- Any target or factual claim shown to the user carries a `SourceLine`. If the target's `verified` flag is off, show "Source: to be confirmed". Do not invent a citation.

## Behavior

- No dead buttons and no placeholder text in anything a user can see.
- User-facing text is in English, plain and short.
- Keys and secrets never go in the repo or the browser bundle.
- Do not use NASA logos, mission emblems or agency insignia.

## Medical caution

This is a demonstration and not a medical device, and the watches feeding it are consumer devices. Do not write text that diagnoses, prescribes or gives drug doses. Describe what the data shows, give the general guidance with its source, and point to the flight surgeon for decisions.

## How to work

1. Read what your prompt lists.
2. Write a plan of at most ten lines at the top of the `NOTES.md` in your folder: the files you will create and what each does. Then build. Only stop for an answer if your prompt says to wait, or if you hit a contract problem.
3. Build the smallest working version first, then fill in.
4. Before you say you are done, run `npm run build`, `npm run lint`, `npm run typecheck` and `npm run test` in `app`, and fix what they report. Check the result at 360 px wide.
5. Finish `NOTES.md` with: what is built, what is faked or stubbed, what you could not verify, and how to see it working.
6. Report the same to the human in a few lines, plus any contract problem you noticed.

If you cannot run commands or see the app, say so plainly in your report. Do not claim a check you did not perform.
