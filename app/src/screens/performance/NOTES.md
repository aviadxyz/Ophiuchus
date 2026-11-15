# Performance

**Owner:** Aviad. Screen id `performance`, route `/performance`. Built on Sunday 15 November from the team's design mockup.

## Plan

- `sample.ts`: the fictional sample record, two domains (Cognitive, Physical), each with a brief, weekly tests, personal factors, a plan and references. Test days are worked out from today.
- `Markers.tsx`: the four tiles, the tests table and the drawer with the dated chart.
- `Cards.tsx`: the brief, "What moves this for you", the plan with its buttons, and the reading list.
- `index.tsx`: the header, the Cognitive / Physical switch, and the empty state for team profiles.
- `guide.ts`, `meta.ts`, `index.test.tsx`.

## What is built

The screen as planned. Cognitive: attention lapses, reaction time, hand and eye speed, short-term memory, cost of a distraction. Physical: hip bone density lost, muscle lost, heart and lung fitness, grip strength, jump power lost, heart rate rise under load. Every tile and row opens a drawer with the last three weekly tests, each with its date and time. Levels follow CONTRACTS section 7 and a test checks every marker against the shared level function.

## What is faked or stubbed

- Every value is fictional sample data and carries the SIMULATED badge. It is shown on the demo profile only; a team profile sees "No performance tests have been recorded".
- Nothing can be entered: the app has no test to take and no store record for a test result.
- The mockup's genetic and microbiome items were left out. Its exercise loads, food amounts and task-cancelling rule were reworded as a plan agreed with the flight surgeon, with no amounts.

## Sources

Two papers are linked and were checked (docs/REFERENCES.md): Basner 2015 and LeBlanc 2000. The two NASA Human Research Program entries name a risk, not a page that was opened, and show "Source: to be confirmed". The parts of the brief with no checked source say so in the source line.

## How to see it

Demo profile, `/performance`. Press "Physical", then the "Hip bone density lost" tile.
