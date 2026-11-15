# 02 · Shared data

**Phase 1. Can run in parallel with 03 and 10 part A.**

| | |
|---|---|
| Branch | `lane/02-data` |
| You own | `app/src/data/` and `app/src/screens/about/` |
| Read first | AGENTS.md, docs/CONTRACTS.md sections 7 to 10, docs/REAL_DATA.md, the "Seeded story" and seed-fact tables in docs/SCREENS.md |
| Attach (chat tools only) | Those files, plus `app/src/design/index.ts` and `app/README.md` |
| Needs | 01 merged |
| Use | A capable model. Every screen depends on this being right |

## Prompt

Read AGENTS.md, docs/CONTRACTS.md and docs/REAL_DATA.md before doing anything. You are replacing the stub in `app/src/data/` with the real shared store, and building the About screen.

Every screen in Ophiuchus shows a different view of the same person, so they all read from one store. That store holds two kinds of people: a demo crew member with simulated history, and real team members whose readings come from their own watches and from what they type in. Three other agents are building screens against the names in CONTRACTS sections 8 and 9 right now, without seeing your code. Implement those names and shapes exactly. Anything not listed there is internal to your folder and yours to decide.

**Build, in this order:**

1. **Types** in `types.ts`: every record in CONTRACTS section 8, with exactly those field names.
2. **Targets** in `targets.ts`: one entry per target id named in section 8, with value, kind and unit taken from the seed-fact tables in docs/SCREENS.md. Set `sourceText` to "to be confirmed" and `verified` to off for all of them; a human fills these in later. Energy and protein targets are computed per profile from body mass when it is known, and fall back to a fixed default when it is not.
3. **Foods** in `foods.ts`: about 20 plausible space-menu items with every `FoodItem` field. State in `README.md` that the values are illustrative.
4. **Levels** in `levels.ts`: the level rules in CONTRACTS section 7, including the time-of-day share for totals that build up during the day. Pure functions, fully tested.
5. **Seed** in `seed.ts`: builds the `demo` profile's last 14 days from a fixed seed, with dates relative to today so the story always ends today. Follow the "Seeded story" in docs/SCREENS.md. Every seeded record has source `simulated`. Today is partly filled in, as if it were mid-afternoon.
6. **Store** in `store.ts`: one Zustand store, persisted under the `ophiuchus:v1:` prefix, holding profiles, the active profile id, all records keyed by profile, alerts, and the room. On first load it creates the `demo` profile from the seed and makes it active. Storage that is missing, full or corrupted must not crash the app: fall back to memory and show nothing broken.
7. **Selectors and hooks** in `selectors.ts`: every hook in the "Reading" table of section 9, with exactly those names. Day totals, series with gaps left as gaps, and the `HealthSummary`, whose `text` for each area is a short phrase such as "5.1 h last night" and whose `ophiLine` is picked by simple rules from the levels.
8. **Write functions:** every function in the "Writing" table of section 9. Each stamps `source` correctly (`entered` for things a person does in the app). `deleteProfileData` removes everything for that profile and cannot delete `demo`. `resetDemoProfile` restores the seed.
9. **Simulator** in `simulator.ts`: emits a believable heart rate and blood oxygen every few seconds through `pushVital` with source `simulated`. It runs only while the active profile is `demo`. It never runs on a member profile.
10. **Heart-rate sensor** in `sources/bluetoothHeartRate.ts`: `connectHeartRateSensor` asks the browser for a device offering the standard Bluetooth heart-rate service, subscribes to the heart-rate measurement, and calls `pushVital` with source `live`. Handle: browser has no Web Bluetooth (return a clear reason, do not throw), user cancels the picker, device disconnects (connection becomes `off`, one automatic reconnect attempt). Look up the standard service and characteristic identifiers and the measurement format in the official Bluetooth specification rather than relying on memory.
11. **Relay** in `sources/relay.ts`: `joinRoom`, `createRoom`, `leaveRoom`, `useRoom`. Sends and receives the messages in CONTRACTS section 10. Two transports behind one interface: between views in the same browser, always on; and the events endpoint by polling every two seconds, used only when `VITE_EVENTS_URL` is set and the active profile's `consent.relay` is on. Incoming `vitals.sample` goes to `pushVital`; incoming emergency messages update alerts; outgoing `summary.updated` is sent when the summary changes, at most once every ten seconds.
12. **Health import** in `sources/healthImport.ts`: leave a clearly marked stub that returns "not available yet". It is a stretch goal for a later prompt.
13. **About screen** in `screens/about/`, replacing the placeholder, status `ready`:
    - Project name and one paragraph on what it is.
    - The honest statement: the crew are the team members, sensor readings are real where the badge says LIVE, the mission is a scenario, consumer watches are not medical devices, and this is not a medical device.
    - "AI tools were used to build this project."
    - **Profiles:** list, switch, and "Add my profile": display name (required), role, and optional sex, birth year, height, body mass, last night's sleep. Two consent switches, both off by default, worded as in docs/REAL_DATA.md rule 3. A person must tick "This is my own data" to create it.
    - "Delete my data" for the active member profile, and "Reset demo data" for the demo profile, each behind `ConfirmDialog`.
    - Build time.
14. **`data/README.md`:** every hook and function with a one-line description and one usage sentence, for the screen agents.
15. **Tests:** same seed gives the same data; the story days exist; level rules at each boundary; a member profile never receives simulated records; `deleteProfileData` leaves nothing behind; the store survives corrupted storage. Tests use the `demo` profile only.

**Do not build:** any screen other than About, any server code, any chart.

**Checks you must run and pass before reporting:**

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test`, all clean.
- Compare every exported name against CONTRACTS section 9 line by line. List any difference. There should be none.
- In the browser: create a member profile, add a meal with the store's function from the console or a temporary button, reload, see it kept; delete the profile, see it gone; demo profile untouched throughout.
- The shell still works: profile switcher lists and switches profiles, alert banner appears when an emergency alert is raised.

**Stop and ask** only if a name or shape in the contract cannot work as written.

**Report:** what you built, the result of each check, which values are illustrative, and which browsers you could confirm the heart-rate sensor path in, if any.
