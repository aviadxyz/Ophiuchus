# Mood Screen Plan

- `safetyPhrases.ts`: Self-harm detection phrase list and matching helper.
- `patterns.ts`: Stats, 7-day average, trend word, 3 pattern rules, safety checks.
- `CheckinCard.tsx`: 5 face buttons, instant log, tags ChipGroup, note TextField, safety card 2.
- `TimelineCard.tsx`: 14-day mood points with score labels, sleep hours, day selection, sr-only summary.
- `PatternsCard.tsx`: "What seems to move your mood" card with 3 rule sentences or empty text.
- `TryNowCard.tsx`: Breathe DetailDrawer (60s countdown, 4s/6s cycle, reduced-motion), Social & Medbot buttons.
- `index.tsx`: ScreenHeader with 3 pills, safety card 1, composing cards, privacy line, GameLinks.
- `meta.ts`: Change status to 'ready'.
- `mood.test.tsx`: Unit and integration tests for trend word, 3 pattern rules, and safety conditions.

# Notes

**Owner:** Rami. Screen id `mood`, route `/mood`.

## What is built
- **ScreenHeader**: Eyebrow `DOMAIN · MOOD`, title "Mood", description from `meta.ts`, and 3 dynamic pills: "Check-in done" / "Check-in due", 7-day average to one decimal, and trend word (Rising, Steady, Falling).
- **Check-in card**: 5 large score buttons with Lucide face icons and labels (1 Very low to 5 Very good) for immediate 1-tap logging (`addMoodCheckin(score, [], '')`). Expandable tags with `ChipGroup` (Tired, Stressed, Focused, Calm, Homesick, Irritable, Proud, Lonely) and note `TextField` (max 500 characters) auto-saved via `updateMoodCheckin`. When today has a check-in, shows summary with Edit and Add another actions.
- **Safety Card 2 (Crisis assistance)**: Directly under check-in card when a self-harm phrase is detected. Wording: *"You don't have to carry this alone. Please reach out to your flight surgeon or a crewmate now."* with direct button to `/emergency` and subtext *"This is a demonstration. If you are in a real crisis, contact your local emergency services."*
- **Safety Card 1 (Heavy days support)**: Calm card placed directly above the timeline when the last 3 days with check-ins all average 2 or lower: *"The last few days look heavy. It might help to talk it through with the Med bot or your flight surgeon."* with a quiet action to "Talk to the Med bot" (`askMedbot('mood')`). No alert is raised.
- **Timeline card**: 14-day mood score markers with visible score number and tone, gap markers for missing days, sleep hours axis drawn underneath on the same day axis with 6h threshold marking, interactive day selector to inspect individual check-ins (time, source badge, tags, RTL/emoji-safe note), and screen reader summary text.
- **What seems to move your mood**: Evaluates sleep, exercise, and trend rules; shows up to three factual sentences or empty text *"A few more days of check-ins and patterns will show here."*
- **Try now**: Three actions ("Breathe for a minute", "Message home", "Talk to the Med bot"). Breathing opens `DetailDrawer` with 60s countdown, 4s inhale circle expansion and 6s exhale circle contraction, with `prefers-reduced-motion` support.
- **Privacy line**: *"Your notes stay on this device. They are never sent to the Med bot or anyone else."*
- **Games**: `GameLinks` with screenId `mood`.

## What is faked or stubbed
- Nothing is faked or stubbed in the screen. All data reads and writes flow through the official `@/data` store (`useMoodCheckins`, `useSleep`, `useExerciseSessions`, `addMoodCheckin`, `updateMoodCheckin`).

## What could not be verified
- Real human crisis lines or clinical emergency services (by design, this is an astronaut health console demonstration).

## How to see it working
1. Run `npm run dev` in `app` and navigate to `/mood`.
2. On demo profile: note "Check-in due" pill, 14-day timeline with sleep hours underneath, and "Your mood was lower on days after short nights."
3. Tap "4 Good": check-in is logged immediately, pill changes to "Check-in done", tags and note appear. Enter text (supports Hebrew, emoji, up to 500 chars) and tap "Done".
4. Type "hurt myself" in the note field to see Safety Card 2 appear with the Emergency button.
5. In About screen, click "Reset demo data" to verify it undoes the check-in.
