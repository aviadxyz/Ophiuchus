# 13 · Code review by a strong model

A read-only review of the code, done by the most capable model you have. It looks for what the building agents cannot see from inside their own lane: pieces that do not fit together, places that broke the contract, and holes in how real health data is handled.

It is different from prompt 11. Prompt 11 clicks through the running app looking for visible bugs. This one reads the code.

**Run it twice:**

| When | Scope | Why |
|---|---|---|
| **Gate 1:** after 01 is built, before it is merged and before any other lane starts | The foundation | A mistake here is copied by every lane that follows. Ten minutes now saves hours |
| **Gate 2:** after phase 3 is merged, before the finishing touches | The whole repo | Everything is in, there is still time to fix |

A short version is also worth running on any single lane whose report sounded unsure.

| | |
|---|---|
| Branch | None. It reads `main`, or the lane branch for gate 1. It changes nothing in the first pass |
| Read first | AGENTS.md, docs/CONTRACTS.md (all), docs/REAL_DATA.md, docs/DESIGN_SYSTEM.md, docs/CHALLENGE.md |
| Use | The strongest model available, with a fresh session that has not seen the building agents' conversations |
| Fill in first | `[gate 1 or gate 2]` |

## Prompt

Read AGENTS.md, docs/CONTRACTS.md, docs/REAL_DATA.md and docs/DESIGN_SYSTEM.md in full. Then review this repository as **[gate 1 or gate 2]**.

Ophiuchus is an astronaut health console built over a weekend by several agents on different AI tools, each working alone in its own folder against a shared contract. None of them saw the others' code. Hackathon judges will use the result hands-on, and it holds real health readings from real team members. I need you to find what is wrong before they do. You did not write this code, so read it skeptically: assume each agent's report was optimistic and check the code itself.

**Do not change any file.** Your output is a findings table. I will tell you afterwards what to fix.

**Start by running** `npm run build`, `npm run lint`, `npm run typecheck` and `npm run test` in `app`, and the tests in `api` if it exists. Report the results as they are. If you cannot run commands, say so and continue by reading.

**Then check each of these and report on every one, including the ones that are fine:**

1. **Contract.** Compare the code with docs/CONTRACTS.md section by section. List every name, path, field, value, route or function that is missing, extra, renamed or behaves differently from what the contract says. Check both sides of each interface: that the provider exports it as specified and that every user calls it as specified.
2. **Lane boundaries.** Any file outside its owner's folder that was changed by a lane. Any import from another screen's folder or from deep inside a shared folder. Any dependency in `package.json` that is not in CONTRACTS section 1.
3. **Fit between pieces.** Trace these five paths through the code end to end and say where each one breaks or relies on something that does not exist:
   - Adding a meal on Nutrition changes today's totals, the level, the health summary, and what the watch view shows.
   - A skipped exercise session shows in the week view and in the summary.
   - A mood check-in appears in the timeline; its note never leaves the Mood screen.
   - Emergency held in the watch view raises an alert, shows the shell banner on every screen, appears on the Emergency screen, can be acknowledged, and the watch view updates. Same path through the events endpoint between two devices.
   - "Ask the Med bot about this" on a screen arrives at the Med bot with the right screen, and a reply comes back, online and offline. A reply marked `forward` offers "Send to flight surgeon", and a sent question shows on Overview.
   - If Social is built: a mood check-in with sharing on reaches a friend as a word and tags only; with sharing off it reaches nobody.
4. **Real data and privacy.** Check every rule in docs/REAL_DATA.md against the code. In particular: can a simulated value ever be written to a member profile; can a real reading reach a log line, an error message, a test fixture, the repo, or the relay or model without the matching consent switch on; does "Delete my data" remove everything, including anything a screen stored on its own; are mood notes sent anywhere; does any message carry a name; if Social is built, does anything other than a handle, a role, a mood score with at most two tags, and chat text ever reach the server, can a non-friend read a mood or send a message, and is the token ever exposed to a screen or a log; how long does the server keep messages; is any key or secret in the repo or the browser bundle.
5. **Honest labeling.** Any place a value is displayed without its source badge. Any place missing data is shown as zero or filled in. Any target or fact shown without a source line.
6. **Failure handling.** What happens when browser storage is full or corrupted, the network is off, the chat or events address is empty, the model call times out, the heart-rate sensor disconnects, the camera or microphone is denied. Does one screen crashing take down the app.
7. **Medical caution.** Any user-facing sentence that diagnoses, prescribes, gives a dose, labels a person, or draws a health conclusion from a consumer sensor reading. Quote each one.
8. **Server, if `api/` exists.** Input validation, rate limits, what is logged, whether one room can read another's messages, whether the system prompt can be overridden by the user's message in a way that produces a dose or hides the Emergency direction.
9. **Things that will bite on demo day.** Hard-coded dates, time zones, anything that only works on the developer's machine, anything that depends on today being a particular mission day, leftover debug output, text a user can see that is unfinished.
10. **Consistency of look.** Colors, fonts or component look-alikes outside the design system, and any screen without the standard header.
11. **Tests.** Whether the tests would actually catch a regression in the five paths above, or only assert that things render.
12. **Challenge fit.** For each finished screen, check the five questions in docs/CHALLENGE.md: values with units and source badges, a guide with all four fields filled in real words, a status level on each measured value, and something that tells the user what to do next. List screens that miss any of these. At gate 2, also say which rows of the coverage table in that file are still not true in the code.

**Report as one table,** most serious first:

| Severity | Where (file and line) | What is wrong | What will happen because of it | Suggested fix | Fix is inside one lane's folder? |

Severity: **blocker** (the demo breaks, or private data leaks), **major** (a judge will notice, or a contract mismatch that will break a later lane), **minor** (cleanup).

After the table, give me three short lists: what you checked and found sound, what you could not check and why, and for gate 1 only, a plain yes or no on whether the other lanes can safely start on this foundation.

Be concrete. A finding without a file and a consequence is not useful. Do not report style preferences. If you are unsure whether something is a problem, say so and say what would settle it.

**After I reply with the rows to fix:** make the smallest change for each, stay inside the folder of the lane that owns the file, add or adjust a test where one would have caught it, re-run the four commands, and report each row as fixed and verified, not fixed with the reason, or needs a human. If a fix requires changing docs/CONTRACTS.md, do not change it; tell me what the change would be.
