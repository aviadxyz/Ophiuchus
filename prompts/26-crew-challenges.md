# 26 · Crew challenges: friendly competition on exercise and food goals

**Runs alone in its files. Can run beside prompt 25 and beside work on Performance. Needs the live Social network. It is merged.**

Crew members who want to can compete with their friends on two weekly goals: doing their planned exercise, and eating and drinking to target. Nobody is in a challenge until they switch it on, anyone can leave at any moment, and the only thing that ever leaves the device is one score.

| | |
|---|---|
| Branch | `lane/26-crew-challenges` |
| You own | In `app/worker/social/`: the challenge code and its tests, and the lines in `crewDo.ts` and `rules.ts` that add it. In `app/src/data/social/`: the challenge code and its tests, and the lines that export it through `app/src/data/index.ts`. In `app/src/screens/social/`: a new `Challenges.tsx` (and helpers), the lines in `index.tsx` that show it, and its tests |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 7, 8, 9 and 11 (look for "Challenge ids", `ChallengeEntry`, `ChallengeBoard`, `useChallenges`, `setChallengeJoined`, and the two challenge endpoints), docs/REAL_DATA.md, `app/worker/README.md`, every file in `app/worker/social/`, `app/src/data/social/` and `app/src/screens/social/` |
| Use | Claude Opus 5.5. This sends something derived from health data to other people, so it must be exactly right |

## Prompt

The build has started and you may write code. Read AGENTS.md, docs/CONTRACTS.md and the files under "Read first" before doing anything. Touch only what is listed under "You own". Add no dependency and no color. Every name you need is in the contract; if one is missing, stop and ask.

### Part 1. The server

Add the two endpoints of CONTRACTS section 11, `POST /api/social/challenge` and `GET /api/social/challenges`, to the crew network Durable Object, in the style of the endpoints already there (same token check, same validation helpers, same logging: path, status, duration only).

- One new table: one row per person per challenge, holding the score and when it was sent. Create it with `CREATE TABLE IF NOT EXISTS` in the same place the other tables are created, so the deployed network gains it without a migration.
- Validate: `id` is `exercise` or `nutrition`; `exercise` score is a whole number 0 to 100; `nutrition` score is a whole number 0 to 7. Anything else is refused.
- `leave` deletes that person's row for that challenge at once.
- `GET` returns, for each challenge the caller has joined, the caller's row and the rows of the caller's friends. For a challenge the caller has not joined it returns an empty list: you cannot watch a board you are not on. Someone who is not a friend is never returned.
- Rows not updated for 8 days are deleted on every write. Leaving the network or removing a friendship removes what the other person could see, the same moment.
- Tests beside the code: the token check; each validation; a non-friend never appears; a person who has not joined gets an empty list; leaving removes the row; the 8-day cleanup.

### Part 2. The data layer

- `useChallenges()` and `setChallengeJoined(challengeId, on)` exactly as in CONTRACTS section 9.
- The score is worked out on the device from the store, by the rules under "Challenge ids" in section 8, using the shared level function. While a challenge is joined, send the score when it changes and at most once a minute; fetch the boards every fifteen seconds while the Social screen is open and stop while the page is hidden.
- Which challenges a profile has joined is remembered per profile through the store, like the social account is. Switching profile on a device never carries a challenge over.
- The demo profile never touches the network: its two boards are filled from the simulated crew that already exists, with fixed simulated scores, `source` `simulated`. Joining and leaving work the same way for it, on the device only.
- A profile with no social account gets `not-joined` and the screen explains it.
- Tests: the two scores for known data; a profile that has not joined sends nothing; leaving sends `leave`; nothing but `id` and `score` is in any request body.

### Part 3. The screen

A new section on Social, "Crew challenges", below the friends list. Built from the shared components.

1. **One card per challenge**, "Exercise this week" and "Food and water this week". Each shows in one sentence what is compared ("The share of your planned exercise minutes you have done this week" and "The days this week your energy, water and protein were all on target") and a `Switch`, "Take part", off by default.
2. **Before the switch is turned on for the first time**, a `ConfirmDialog` says exactly what is shared: "Your friends who also take part will see one number: [what it is]. They never see your meals, your minutes, your body mass or anything else. You can leave at any time and your number is removed at once."
3. **When taking part:** the board, as a ranked list. Each row: position, handle, the score in words ("68% of the plan", "4 of 7 days"), a `ProgressBar`, and "You" on your own row. A simulated person carries the `SIMULATED` badge. Ties share a position. Nobody is shown in red and there is no "last place" wording: this is encouragement, not a ranking of health.
4. **When taking part and no friend is:** "No friend is taking part yet. They choose for themselves in their own Social screen."
5. **Under each board**, one line and a working link to where the score is earned: Physical activity, or Nutrition.
6. A person whose own data gives no score yet (no plan this week, nothing logged) is shown as "No score yet" and is not sent as zero.
7. Works at 360 px and 1440 px with no sideways scrolling.

### Do not build

Prizes, badges, streaks, notifications, team-against-team, challenges anyone can invent, comments on a board, any view of another person's data beyond the one score.

### Checks you must run and pass before reporting

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` in `app`, all clean.
- The demo profile: both switches work, both boards show the simulated crew, leaving empties the board.
- Read every request your code can send and confirm the body holds only `id` and `score`, or `id` and `leave`.
- With `VITE_SOCIAL_URL` empty the app builds and the section explains that the network cannot be reached.

**Report:** what you built, the result of each check, exactly what the server stores and for how long, and what you could not test (two real devices, most likely).

When all checks pass, commit, push this branch, and report. Do not merge.
