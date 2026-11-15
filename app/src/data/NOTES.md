# data

**Owner: lane 02** ([prompt 02](../../../prompts/02-shared-data.md)). The `social/` folder inside it belongs to lane 17.

## Plan

- `types.ts` records of CONTRACTS section 8 (the four social records are lane 17's). `dates.ts` local-date helpers.
- `targets.ts` one target per id, per profile. `foods.ts` the illustrative space menu. `levels.ts` the level rules.
- `seed.ts` the 14-day demo story from a fixed seed. `store.ts` one persisted Zustand store plus the write functions.
- `compute.ts` pure day, series and summary maths. `selectors.ts` the React hooks of section 9.
- `simulator.ts` demo-only vitals. `sources/` Bluetooth heart rate, relay (same-browser channel and polling), health-import stub.
- `index.ts` the only public path. `README.md` for the screen agents. Tests beside each file. About screen in `screens/about/`.

## What is built

Everything in the prompt except the crew-network names. Every hook of CONTRACTS section 9 "Reading" and every function of "Writing" and "Sensors and sync" exists with the contract's name. Usage notes for each are in `README.md`. The saved store is one Zustand store under `ophiuchus:v1:store`; readings that arrive every few seconds live in a separate unsaved store (`runtime.ts`) so they do not rewrite storage.

## Decisions the contract left open (all internal, all in README.md)

- A total made of several records has one source; any simulated record makes the total `simulated`.
- `waterMl` counts drinks only. `heartRate` never gets a level (always `none`).
- `MetricValue.source` and each area's `source` in `HealthSummary` are `null` when there is no data.
- `useLatestVitals()` gives `{ latest, connection }`. `useRoom()` gives `{ code, connection }` with `off`, `local`, `online`, `error`.
- Member profiles get two planned sessions a day (one resistive, one aerobic, 60 minutes). Planned sessions alone are not data: exercise minutes stay missing until one is done, changed or skipped. Needed because the contract has no function that adds a planned session.
- The demo profile is rebuilt when the date changes, so its story ends today.
- The demo profile accepts only simulated readings; a member profile never accepts one. Both are enforced in `pushVital`.
- `createProfile` returns the new id and throws if there is no display name.
- Saved history keeps one vital reading every five minutes (cap 6,000); the newest reading is always kept live.

## What is faked or stubbed

- Foods (`foods.ts`), every target value (`targets.ts`, all `verified: false`, source "to be confirmed"), the mission's length and delay to Earth, and the whole demo history are illustrative or simulated.
- `sources/healthImport.ts` is a stub that returns "Health import is not available yet."
- The events endpoint transport is written but has never talked to a server (no endpoint exists yet). Its tests cover only message checking.

## What could not be verified

- The Bluetooth heart-rate path against a real sensor, in any browser. Tested only with parsing tests and fake devices.
- The events endpoint (polling and posting).
- The identifiers `heart_rate` and `heart_rate_measurement` are the Web Bluetooth names for the SIG Heart Rate service and its measurement characteristic. The SIG spec page read for this lists the flags and field order but not the numeric UUIDs; the search result listed 0x2A37 for the measurement and I did not confirm 0x180D for the service from an official page.

## How to see it working

`npm run dev` in `app`, open `/about`. Add a profile, switch with the sidebar or the profile list, delete it. In the browser console, `await import('/src/data/index.ts')` gives the same module the app uses, for example `d.addMeal('almonds', 2)`. `npm run test` runs the 109 tests.
