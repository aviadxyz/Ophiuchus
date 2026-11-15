# Environment

**Owner:** Rami. Screen id `environment`, route `/environment`. Built from [prompt 25](../../../../prompts/25-environment.md).

## Plan

- `data/environment.ts`: `environmentAt(date)` works the station out from the clock (slow sine waves, fixed phases, no random numbers). `useEnvironment()` and `useEnvironmentSeries(metricId, hours)` read it. Test beside it.
- `data/types.ts`, `targets.ts`, `index.ts`: the environment names, eight targets, the exports.
- `metrics.ts`: the nine values in order, with the plain texts. `derive.ts`: levels, target words, header pills.
- `EnvironmentTile.tsx`, `EnvironmentDrawer.tsx`, `ConnectsCard.tsx`, `index.tsx`: the screen. `meta.ts`, `guide.ts`. `index.test.tsx`.

## What is built

The whole screen of the prompt: header with level pills and SIMULATED, the simulated line, nine tiles in Air, Cabin and Radiation, a drawer for each tile (what it is, 24-hour chart with highest and lowest and their times, what it does to the body, what to do, source line, link to the related screen), and the "How this connects to your health" card with three working links. The guide answers the five questions.

## What is faked

Every value. The app has no cabin sensor. Values come from the clock, so every device shows the same numbers at the same time. Nothing is stored. Gravity is the mission's `gravity` (0 for Ophiuchus-1, in transit).

## Limits and sources

Read from NASA technical briefs (PDFs, text extracted on the machine):

| Value | Limit | Source |
|---|---|---|
| Temperature | 18 to 27 °C | OCHMO-TB-002 Rev B, crew health limit [V2 6012] |
| Humidity | 25 to 75 % | same |
| Carbon dioxide | under 3 mmHg (one-hour average) | OCHMO-TB-004 Rev D [V2 6004] |
| Noise | under 85 dBA | OCHMO-TB-035 Rev B, hazardous noise limit [V2 6077]. This is a ceiling, not a comfort level: the continuous limit is the NC-50 curve (NC-40 for sleep), which the brief gives per octave band, not as one dBA number |
| Radiation in the cabin | under 54 µSv/h (1.3 mSv a day) | OCHMO-TB-020 Rev G [V1 4033]. This is a design limit for habitable systems in free space, not a limit on a person. The career limit (600 mSv) is not a rate |
| Oxygen, both MOSFET values | not found | `verified` off. The values 20 to 22 %, 60 and 20 µGy/h are illustrative |

Gravity has no target. It is not a target id, so `TargetMap` leaves the environment targets optional (see below).

## Contract notes and changes outside my files

- `TargetKind` has no "none", and a target for gravity would have to invent a limit. Gravity has no target and no level pill.
- `useEnvironment()` gives `{ sample, connection }`. The contract does not name the field; `sample` follows `useLatestVitals`.
- Adding the eight ids to `targetIds` broke a hand-written `TargetMap` in `watch.test.tsx` and `MetricValue.targetId` users. To avoid touching other lanes, `TargetMap` keeps the core ids required and the environment ids optional, and `MetricValue.targetId` is the core ids only (`CoreTargetId`).
- `registry/registry.test.ts` lists the screens by hand. It is a shared file; at Rami's OK I added `environment` to its two lists (the only edit outside my files besides `data/types.ts`, `targets.ts`, `index.ts`).

## What I could not verify

The sources were read from extracted PDF text; I did not read the NASA-STD-3001 volumes themselves. The oxygen range is not sourced. Checked in the browser pane (see the report); not on a physical phone.
