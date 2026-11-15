# 27 · A mini game at the bottom of Sleep

**Runs alone in its own folder. Can run beside every other prompt. Written to be pasted into Gemini, with the game's own description added at the end.**

| | |
|---|---|
| Branch | `lane/27-sleep-game` |
| You own | One new folder, `app/src/games/<game-id>/`, and nothing else |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 1, 6, 7, 9 and 13, docs/DESIGN_SYSTEM.md, `app/src/games/NOTES.md`, `app/src/design/index.ts`, `app/src/data/index.ts` |

## Prompt

You are adding one mini game to Ophiuchus, an astronaut health console built by a small team at a hackathon. The app is in `app/` (Vite, React 19, TypeScript in strict mode, Tailwind v4). Other people and other agents are working in this repository right now, so the rules below are strict. Read AGENTS.md and docs/CONTRACTS.md section 13 before you write anything.

**Where the game goes.** Create one folder, `app/src/games/<game-id>/`, where `<game-id>` is a short name for the game in lower case with hyphens (for example `wind-down`). Everything you write goes in that folder. It needs three files, and may have more:

1. `meta.ts`, with a named export `meta` of the type `GameMeta` from `@/registry`:
   - `id`: the folder name, exactly.
   - `label`: the game's name as the player sees it.
   - `description`: one plain sentence saying what the player does.
   - `screens`: `['sleep']`. This is what puts the game at the bottom of the Sleep screen.
   - `countsAsExercise`: `false`, unless the player really moves their body for the whole round. If it is `true`, call `logGameMinutes('<game-id>', minutes)` from `@/data` once when a round ends.
2. `index.tsx`, with the game component as its **default export**.
3. `NOTES.md`: what is built, what is faked, what you could not test, and how to see it.

**You do not wire anything up.** The app finds the folder by itself. It opens the game full-window at `/games/<game-id>`, already wrapped in a page with a "Back" button and the game's name as the title, and the Sleep screen already shows a "Games" section at its bottom that lists every game whose `screens` includes `sleep`. Do not edit the Sleep screen, the router, the registry or any other file outside your folder. If you think you need to, stop and tell me.

**Rules that break the build or the merge if ignored:**

- Add no dependency. Do not touch `package.json`. Everything allowed is already installed: React, `react-router`, `lucide-react` for icons, and MediaPipe for camera body tracking (CONTRACTS section 1).
- Import shared things only from `@/design`, `@/data`, `@/registry` and `@/ophi`. Never from a screen's folder, another game's folder, or a file deep inside a shared folder.
- Outside the play area, build from the shared components in `@/design` (`Button`, `Card`, `ChipGroup`, `ProgressBar`, `StatusPill`, `SectionLabel`, `EmptyState` and the rest). Do not write your own version of one that exists.
- Colors, fonts, spacing and radius come from the Tailwind theme in `app/src/design/tokens.css` (`bg-bg`, `bg-surface`, `border-border`, `text-text`, `text-text-secondary`, `text-text-muted`, `text-accent` and so on). Tailwind's default palette is switched off, so a class like `bg-blue-500` does nothing. Inside a canvas, read the colors from the CSS variables in that file. Add no color and no font. The only font is Inter.
- Do not use browser storage (`localStorage`, `sessionStorage`, IndexedDB) and do not send anything over the network. A best score lives in React state for the session only.
- Nothing from your folder may load until the game's route is opened. Do not import your game from anywhere.
- TypeScript strict: no `any`, no `as` casts to silence an error, no unused variables. The lint allows zero warnings.

**What every game in this app does:**

- **Three views:** a start view, the play view, and a result view with "Play again" and "Back to Sleep" (a `Button` that goes to `/sleep` with `useNavigate` from `react-router`).
- **The start view** says in one sentence how to play and in one sentence why it matters for sleep on a mission. A judge opens it with nobody explaining, in a noisy room.
- **A round is short:** 60 to 90 seconds, with the time left always visible.
- **It works with a mouse, with a keyboard and with a finger**, at 360 px wide and at 1440 px wide, with no sideways scrolling.
- **If it uses the camera or the microphone:** ask only after the player presses Start; say on the start view "Your video stays on this device and is never saved or sent."; offer "Play without camera" on the start view and switch to it by itself when permission is denied or there is no camera; stop the camera when the round ends, when the tab is hidden and when the game closes.
- **Stop every timer, animation frame and sound** when the game closes or the tab is hidden.
- **Nothing shows status by color alone**, and nothing flashes more than three times a second.
- **No medical claims.** The game does not measure, score or judge the player's sleep or health, does not diagnose, and gives no medicine or supplement advice. If it states a fact about sleep in space, either leave the fact out or show it with a `SourceLine` from `@/design` with empty text, which reads "Source: to be confirmed". Do not invent a citation.
- **No real names and no health data** in the code, the tests or the notes. No NASA logos, mission emblems or agency insignia.
- User-facing text is in English, plain and short. No placeholder text and no button that does nothing.

**Tests.** Put the game's rules (scoring, timing, anything with numbers) in a plain `.ts` file with no React in it, and test that file with Vitest in a `.test.ts` file beside it.

**Checks you must run and pass before reporting.** In `app`: `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`. Fix what they report. Then run `npm run dev`, open `/sleep`, and confirm: the game is listed under "Games" at the bottom; the link opens it; a full round can be played and replayed; "Back to Sleep" returns to Sleep; the same at 360 px wide. If you cannot run commands or see the app, say so plainly. Do not claim a check you did not perform.

**When done:** commit on this branch, push the branch, and report in a few lines: the game id, what works, what you cut, and what you could not test. Do not merge, do not switch branches, and do not push to `main`.

**The game to build:**

[paste the mini game description here]
