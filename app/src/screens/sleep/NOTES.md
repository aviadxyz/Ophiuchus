# Sleep

**Owner:** Aviad. Screen id `sleep`, route `/sleep`. Built on Sunday 15 November from the team's design mockup.

## Plan

- `index.tsx`: header, four tiles, the 14-night chart, then the cards below.
- `LogCard.tsx`: log or correct last night (hours and an optional 1 to 5 quality).
- `NightDetail.tsx`: the sample night hour by hour, "What moves your sleep", "What helps" and the reading list.
- `derive.ts`: week average, sleep debt, date and range helpers. `sample.ts`: the fictional sample night.
- `guide.ts`, `meta.ts`, `index.test.tsx`.

## What is built

For every profile, from that profile's own records through `@/data`: last night against the target, the 7-night average, sleep debt over 7 nights, nights recorded, a 14-night bar chart with the target line and its source, and a form that records last night (`addSleep`, source ENTERED). A night with no record is shown as missing and never counted as zero. "What helps" and "Key reading" are general and shown to everyone. The games section sits at the bottom.

## What is faked or stubbed

- "Last night, hour by hour" and "What moves your sleep" are a fictional sample, shown on the demo profile only, marked SIMULATED. The app has no overnight sensor record.
- The mockup's genetic and microbiome items, its sleep-stage (EEG), glucose, melatonin and cortisol values, and its supplement and light amounts were left out: the app does not prescribe and has no such readings.
- The header pill and tiles use the levels from `@/data`; this screen compares nothing itself.

## Sources

The sleep target's source comes from the shared target. Two papers are linked and were checked (docs/REFERENCES.md): Barger 2014 and Flynn-Evans 2016. The NASA "evidence base" entry and the "What helps" steps show "Source: to be confirmed".

## How to see it

Demo profile, `/sleep`. On a team profile, enter hours under "Log last night" and press Save.
