# Admin · prompt 28

## Plan

1. `worker/ground/rules.ts` checks a report body; `reports.ts` holds the table, the two endpoints and the 7-day cleanup. Routed through the crew network's Durable Object.
2. `data/ground/report.ts` builds a `GroundReport` from the store; `api.ts` and `sanitize.ts` talk to the server; `share.ts` sends and removes; `view.ts` opens and closes the ground view; `simulated.ts` makes the simulated crew.
3. The setting lives in the store per profile (`groundShare`), sanitized on load in `persistence.ts`.
4. `screens/admin/`: `ShareCard` (my record), `GroundViewCard` (confirm, code, crew list), `ReportDrawer` (one report, read only), `text.ts` (words and times).
5. Tests beside each part.

## What is built

- **Server.** `POST /api/ground/report` and `GET /api/ground/reports`, inside `CrewNetworkDurableObject` (no new class, no change to `wrangler.jsonc`). Table `ground_reports`: `report_id`, `key_hash` (SHA-256 of the key), `report` (JSON of the contract's fields only, rebuilt field by field), `received_at`. One row per `reportId`; the first report fixes the key; a later report or remove with another key gets 403; `remove` deletes at once; every write deletes rows older than 7 days, and the GET ignores them too. Body over 20 KB, bad ids, a `demo` report, names over 40 characters, a week that is not exactly the five metrics with seven entries, more than 20 alerts or a message over 300 characters: 400. `receivedAt` is the server clock. `GROUND_CODE` unset: 503. Wrong or missing code: 401. The code is compared in constant time (both sides hashed first). Logging is unchanged: method, path, status, duration.
- **Data.** `useGroundShare`, `setGroundShare`, `useGroundView`, `openGroundView`, `openSimulatedGroundView`, `closeGroundView` from `@/data`. Sharing is off by default and kept per profile with a random `reportId` and `key` (`crypto.randomUUID()`), so switching profile never carries it over. Saved data from before this change loads with sharing off. While on for the active member profile: one send when switched on, then on change at most once a minute, and once when the page is visible again; nothing while hidden. A failed send shows `failed` and retries after a minute or on the next change. Off sends `remove` and forgets the ids only after the server has it; a failed remove keeps them and retries. `deleteProfileData` leads to the same remove. All network calls run one after another, so a remove never overtakes a send. The demo profile makes no request at all.
- **Report.** Built with the same functions the snapshot and hooks use (`summarizeDay`, `buildHealthSummary`, `seriesFor`, `targetsFor`). Holds exactly the contract's fields. `today.bodyMassKg` is always empty, because a report never holds a body mass (the server also forces it empty). A `demo` report has every source set to `simulated`.
- **Ground view.** The code is a module variable in `data/ground/view.ts`, sent only in the `Authorization` header of the one GET, never stored or put in a URL; a wrong code is forgotten at once. Polls every 30 seconds while open and visible. A failed poll keeps the last list and its "fetched at" time.
- **Simulated crew.** One report per member of the simulated crew in `data/social/simulatedCrew.ts`, plus the demo profile's own report when its sharing is on. Values come from the clock (rounded to the minute, so every device matches). Levels all come from `levelFor`: kestrel_9 is ACT (sleep and mood), orbit_owl and quiet_comet are WATCH, the rest ON TARGET. Reports were sent 6, 9, 14, 25, 62 and 545 minutes ago, each arriving one signal delay later.
- **Screen.** Header pills, "Send my record to Earth" with the confirmation text from the prompt, "Ground view" with a confirmation before either button, the code form, the crew list (`DataTable`, worst first, late reports say "No newer report has arrived"), the detail drawer (five summary lines, today against targets with `SourceLine`, five seven-day `TrendChart`s, latest vitals, questions for the flight surgeon and emergency alerts), the empty state, and "Close the ground view". Leaving the screen closes the view. Nothing in the ground view changes data.

## Faked or stubbed

- The simulated crew and every value in it.
- The energy target in the drawer is shown as "their own daily target" with its level only: it depends on the person's body, which the report does not carry.

## Not verified

- The real server with `GROUND_CODE` set, and two real devices sharing at once. The endpoint tests run the real Durable Object code on Node's SQLite.
- A member profile's switch in the browser with the server reachable (tested in unit tests with a fake server only).

## Outside this folder

- `src/registry/registry.test.ts` lists the screen ids of CONTRACTS section 3; `admin` was added there so the test matches the contract.
- The shared `TextField` has no password type, so the code field is a plain input with the same classes.

## How to see it

`npm run dev` in `app`, pick the demo crew member, open Admin under About. Switch sharing on (it asks first), then "Look at the simulated crew" (it asks first), open a row, close the view. With `VITE_GROUND_URL` empty, "Open with the ground code" says the server cannot be reached.
