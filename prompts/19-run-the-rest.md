# 19 · Run the rest, one task after another

One agent, one chat, four tasks in a row. Each task gets its own branch, is checked, committed and pushed, and then the next one starts without waiting for anyone.

| | |
|---|---|
| Branches | `lane/19a-polish`, `lane/19b-unwell`, `lane/17a-social-network`, `lane/17b-social-screen`, in that order. **Each branch starts from the one before it**, so the work stacks and never conflicts with itself |
| You own | Only the files each task names |
| Read first | AGENTS.md, docs/CONTRACTS.md (all), docs/DESIGN_SYSTEM.md, `app/README.md`, `app/src/data/README.md` |
| Stay out of | `app/src/screens/emergency/`, `app/src/screens/overview/figure/`, `app/src/data/autoAlert*`, `app/src/shell/`, `app/worker/`, `app/wrangler.jsonc`, `watch-native/`. Other agents are working there right now |

## Prompt

The build has started and you may write code. Read AGENTS.md, docs/CONTRACTS.md and docs/DESIGN_SYSTEM.md in full before doing anything.

You will do four tasks in order. For each one: create its branch from the branch of the task before it (the first from the latest `origin/main`), do the work, run `npm run build`, `npm run lint`, `npm run typecheck` and `npm run test` in `app` until all pass, look at what you changed at 360 px and at 1440 px wide, commit, push the branch, write three lines in the chat (what changed, check results, what you could not verify), and start the next task at once. Do not merge anything and do not wait for me between tasks. If a task is blocked, say why in one line, skip it and go on.

Rules that hold for every task: add no dependency and no color; build from the shared components in `@/design`; read and write data only through `@/data`; no text that diagnoses, prescribes or names a medicine dose; nothing a user can see is filler; status is never shown by color alone.

### Task 1 · `lane/19a-polish` · six rough edges found in review

1. **Ophi covers buttons on a phone** (`app/src/ophi/`). Under 640 px make him 48 px, and make sure a control under him can still be reached: the simplest way that works is enough, for example more bottom room for him to sit in, or letting taps pass through everything except his own button. Check at 360 px on Physical activity, where he sat on "Done with changes".
2. **Mood timeline labels overlap on a phone** (`app/src/screens/mood/`). Under 640 px show every other date, and write dates as "2 Nov", never "11/02".
3. **Physical activity gives advice when the goal is already met** (`app/src/screens/physical-activity/`). In "Countermeasure coverage", when a row is at or above its weekly goal, replace its advice sentence with "Goal met this week."
4. **The watch face clips its summary line** (`app/src/watch/pages/HealthOverviewPage.tsx`). At `/w` the sentence under the rings runs past the round edge. Keep it inside the circle: narrower, centered, at most two lines.
5. **The Watch tab says a native app exists** (`app/src/screens/watch/`). Change that sentence to: "This browser view is what runs today. A native Wear OS app is in progress."
6. **The Med bot's forwarding card squeezes the conversation** (`app/src/screens/medbot/`). The card "This is one for the flight surgeon" sits inside the fixed-height chat column and leaves the thread a sliver. Move it out of that column, directly under it.

### Task 2 · `lane/19b-unwell` · "I don't feel well"

Designed by Elia, a teammate: a health button for when you are not feeling well. Pressing it shows what is out of balance, and opens the assistant so you can say what is wrong.

- **Overview** (`app/src/screens/overview/index.tsx` only, not the `figure` folder): a clearly visible `Button`, "I don't feel well", next to the existing "Ask the Med bot" button. It calls `askMedbot('overview')`.
- **Med bot** (`app/src/screens/medbot/`): above the suggested questions, a compact card "Out of balance today". It lists every metric in `useToday()` at level `watch` or `act`: plain name, value with unit and source badge, status pill, and a quiet link to the screen it belongs to (Nutrition, Physical activity, Mood). With none: "Nothing is off target today." The card can be collapsed. Add one suggested question, "I don't feel well. What should I check?", and a scripted offline reply for it that points to the card, to the flight surgeon, and to Emergency if it is urgent.
- Tests: the card lists an off-target metric and omits one on target; the new scripted reply.

### Task 3 · `lane/17a-social-network` · the crew network, on this device only

Open `prompts/17-social.md` and carry out **Part A up to the point where it tells you to stop before the server part**. Do not build any endpoint and do not create `api/`. The result: every Social hook and function in CONTRACTS section 9 exists; the demo profile has its simulated crew of six, with moods, a pending request, and chats that answer; a member profile gets the connection state `off`, and every function returns its `offline` or empty result without error. Put your export lines in one marked block at the end of `app/src/data/index.ts`.

### Task 4 · `lane/17b-social-screen` · the Social screen

Open `prompts/17-social.md` and carry out **Part B**. One addition from Elia's sketch: in the Friends view, each friend row also shows the start of the last message and its time, like a messaging app. Do not build message translation or games. For a member profile, where the network is `off`, the screen explains in one sentence that the crew network is not connected in this demonstration and shows no dead controls.

### When all four are pushed

List the four branch names with one line each, then stop and ask me what is next.
