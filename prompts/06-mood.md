# 06 · Mood screen

**Phase 2. Can run in parallel with 04 and 05.**

| | |
|---|---|
| Branch | `lane/06-mood` |
| You own | `app/src/screens/mood/` only |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 6 to 9 and 12, the Mood section of docs/SCREENS.md including its tone and safety rules, `app/src/data/README.md` |
| Attach (chat tools only) | Those files, plus `app/src/design/index.ts` |
| Needs | 01, 02 and 03 merged into `main`, and your branch created from that `main` |

## Prompt

Read AGENTS.md, docs/CONTRACTS.md and the Mood section of docs/SCREENS.md before doing anything. You are replacing the placeholder in `app/src/screens/mood/`. Two other agents are building the Nutrition and Physical activity screens at the same moment, so stay strictly inside your folder: no changes to shared folders, no new dependencies.

This screen is a crew member's own quick daily diary of how they feel. It answers: how have I been, what seems to move it, and what small thing can I do now? Real teammates will use it with their real feelings, so tone matters as much as function: gentle, never clinical, never labeling a person. A separate Mental health screen handles the clinical view; do not drift into it.

**Build these sections, top to bottom, in `index.tsx` (split into small components inside your folder as needed):**

1. **Header.** `ScreenHeader` with eyebrow `DOMAIN · MOOD`, the title and description from your `meta.ts`, and three pills: "Check-in done" or "Check-in due", the 7-day average to one decimal, and a trend word (Rising, Steady, Falling) comparing the last 3 days with the 4 before.
2. **Check-in card.** The main element.
   - Five large buttons, each with a simple face drawn from shapes or a lucide icon and a text label: 1 Very low, 2 Low, 3 Okay, 4 Good, 5 Very good.
   - Choosing one immediately calls `addMoodCheckin(score, [], '')`. One tap is a complete check-in.
   - Then the card shows optional extras: a `ChipGroup` of tags (Tired, Stressed, Focused, Calm, Homesick, Irritable, Proud, Lonely), multiple allowed, and a `TextField` for a note (max 500 characters). Changes call `updateMoodCheckin`.
   - If today already has a check-in, show it with an "Edit" control instead of the five buttons, and "Add another" for a later check-in.
3. **Timeline.** A `Card` with the last 14 days from `useMoodCheckins(14)`: one marker per day at the day's average score, labeled with the number so color is not the only signal, and the night's sleep hours from `useSleep(14)` drawn underneath on the same day axis. Days with no check-in are gaps. Selecting a day lists that day's check-ins with time, tags and note. Include a one-sentence text summary for screen readers.
4. **What seems to move your mood.** A `Card` with up to three sentences, each from one rule. Show a rule only when it has enough data, and show the card's empty text, "A few more days of check-ins and patterns will show here.", when none qualifies.

   | Rule | Needs | Sentence when true |
   |---|---|---|
   | Sleep | at least 2 days after a night under 6 hours and 2 days after longer nights | "Your mood was lower on days after short nights." when the difference is 0.5 or more |
   | Exercise | at least 2 days with a done session and 2 without | "Your mood was a little higher on days you exercised." when the difference is 0.5 or more |
   | Trend | at least 6 days of check-ins | "Your mood has been rising this week." or "…dipping this week." when the header trend is not Steady |

   Always "was lower on", never "because of".
5. **Try now.** Three actions in a row:
   - "Breathe for a minute": opens a `DetailDrawer` with a circle that grows for 4 seconds and shrinks for 6, the words "Breathe in" and "Breathe out", and a 60-second countdown. With reduced motion on, the circle does not animate and only the words change.
   - "Message home": navigates to `/social`.
   - "Talk to the Med bot": calls `askMedbot('mood')`.
6. **Privacy line.** Small text: "Your notes stay on this device. They are never sent to the Med bot or anyone else."
7. **Safety behaviors.**
   - If the last three days with check-ins all average 2 or lower, show a calm `Card` above the timeline: "The last few days look heavy. It might help to talk it through with the Med bot or your flight surgeon." with the "Talk to the Med bot" action. No alert is raised.
   - If a note contains any phrase from a short list about self-harm that you keep in one file in your folder, show a `Card` directly under the check-in: "You don't have to carry this alone. Please reach out to your flight surgeon or a crewmate now." with a button to `/emergency`, and a second line in smaller text: "This is a demonstration. If you are in a real crisis, contact your local emergency services." Keep the wording kind and direct. Do not raise an alert automatically and do not store or send the fact that the list matched.
8. **Games.** `GameLinks` with your screen id, last.

Set `status` to `ready` in your `meta.ts`. Update `guide.ts` only if the finished screen differs from what it says.

**Details that matter:**

- Notes are free text from real people. Render them as plain text, handle emoji and right-to-left scripts, and never include them in anything that leaves this screen.
- No sentence anywhere on the screen names a condition or labels the person. Read every string once more for this before reporting.

**Do not build:** clinical questionnaires, any mental-health score, voice or face analysis, sharing between people.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- On the demo profile: the dip after the two short nights is visible in the timeline and the sleep sentence appears; a check-in takes one tap, survives a reload, and is undone by "Reset demo data".
- On a new member profile: the check-in works, the timeline shows gaps, the patterns card shows its empty text.
- A 500-character note, emoji, and a Hebrew note all display correctly.
- 360 px and 1440 px: no sideways scroll, nothing clipped, Ophi not covering a button.
- Tests in your folder for the three pattern rules, the trend word, and both safety conditions.

**Report:** what you built, the result of each check, the exact final wording of both safety cards, and anything you needed from a shared folder that was missing.
