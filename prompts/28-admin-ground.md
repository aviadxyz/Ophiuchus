# 28 · Admin: the crew's records, for the medical team on Earth

**Runs alone in its files. Can run beside prompt 29. Needs the live server.**

A new tab, Admin, directly under About. A crew member can agree, after a confirmation, to send their record to the medical team on Earth. A person on Earth opens the same tab, confirms, enters the ground code, and sees every crew member who agreed, each with the time the report was sent, so a late report is still useful and is never mistaken for a fresh one.

| | |
|---|---|
| Branch | `lane/28-admin-ground` |
| You own | A new folder `app/src/screens/admin/`. A new folder `app/src/data/ground/`, the lines that export it through `app/src/data/index.ts`, and the lines in `app/src/data/store.ts`, `persistence.ts` and `types.ts` that remember the setting per profile. A new folder `app/worker/ground/`, and the lines in `app/worker/index.ts`, `app/worker/social/crewDo.ts` and `app/worker/types.ts` that route to it. One line each in `app/src/config.ts`, `app/.env.production` and `app/.env.example` for `VITE_GROUND_URL` |
| Read first | AGENTS.md. docs/CONTRACTS.md sections 3, 4, 6, 7, 8, 9 and 11: look for `admin`, `GroundReport`, `useGroundShare`, `useGroundView`, `setGroundShare`, `openGroundView`, `openSimulatedGroundView`, `closeGroundView`, the two ground endpoints, `GROUND_CODE` and `VITE_GROUND_URL`. docs/DESIGN_SYSTEM.md. docs/REAL_DATA.md. `app/worker/README.md`. Then the code you will copy the style of: `app/worker/social/crewDo.ts`, `app/worker/social/rules.ts`, `app/src/data/social/challenges.ts`, `app/src/data/social/api.ts`, `app/src/data/social/simulatedCrew.ts`, `app/src/data/snapshot.ts`, `app/src/screens/social/Challenges.tsx`, `app/src/screens/about/index.tsx` |
| Use | Claude Opus 5.5. This sends real people's health readings off their device, so it must be exactly right |

## Prompt

The build has started and you may write code. Read AGENTS.md, docs/CONTRACTS.md and the files under "Read first" before doing anything. Touch only what is listed under "You own". Add no dependency and no color. Every name you need is in the contract; if one is missing or looks wrong, stop and ask.

Some profiles in this app belong to real people and hold their real readings. Nothing of theirs leaves the device unless that person has switched sharing on, and nothing can be read back without the ground code. Tests and examples use the `demo` profile only. No real name or reading goes in a test, a log line, an error message or a comment.

### Part 1. The server

Add the two endpoints of CONTRACTS section 11, `POST /api/ground/report` and `GET /api/ground/reports`.

- **Where it lives.** Write the logic as plain functions in `app/worker/ground/` (validation, the table, read and write). Store the rows in a new table inside the existing crew network Durable Object, created with `CREATE TABLE IF NOT EXISTS` in the same place the other tables are created, the way the challenge table was added. In `app/worker/index.ts`, send `/api/ground/*` to that same object. Do not add a Durable Object class and do not touch `wrangler.jsonc`: a new class needs a migration, and a failed migration takes the public link down.
- **The table.** One row per `reportId`: the hash of its `key`, the report as text, and when it was received. Only the latest report is kept.
- **Writing.** The first `report` for a `reportId` stores the SHA-256 hash of its `key`. A later `report` or `remove` whose key does not hash to the same value is refused with 403. `remove` deletes the row at once.
- **Validation.** `reportId` and `key` are 16 to 64 characters of letters, digits and hyphens. `report.kind` must be `member`; a `demo` report is refused, because simulated crew never reach the server. `displayName` and `role` are at most 40 characters. The whole body is at most 20 KB. `week` has exactly the five metric ids of the contract with seven entries each. At most 20 alerts, each message at most 300 characters. Any field not in `GroundReport` is dropped before storing. Anything else is refused with 400.
- **`receivedAt`** is set by the server when the report arrives, never taken from the body.
- **Reading.** `GET /api/ground/reports` compares the code in the `Authorization` header with the secret `GROUND_CODE` in constant time. No secret set: 503 and nothing else. Wrong or missing code: 401. Right code: every stored report, each with its `receivedAt`. Add `GROUND_CODE?: string` to `Env`. Never write the code, or a default for it, anywhere in the repo.
- **Cleanup.** On every write, delete rows not updated for 7 days.
- **Logging** stays as it is: method, path, status, duration. Never a body, a name or the code.
- **Tests beside the code:** each validation; a second device cannot overwrite or remove another device's report; `remove` deletes; a `demo` report is refused; no secret gives 503; a wrong code gives 401 and no report; the right code gives the reports with `receivedAt`; the 7-day cleanup; an unknown field is not stored.

### Part 2. The data layer

Everything in CONTRACTS section 9 that starts with `useGround`, `setGround`, `openGround`, `openSimulatedGround` or `closeGround`, exported from `@/data`.

- **The setting** is per profile and off by default, remembered through the store with the `reportId` and `key`, which are made with `crypto.randomUUID()` on the first send. Read `persistence.ts` first: saved data from before this change must still load, with sharing off. Switching profile on a device never carries the setting over.
- **Building the report.** One function builds the `GroundReport` for a profile from the store, reusing the functions `snapshot.ts` already uses. It holds exactly the fields in the contract. Missing values stay missing. Every value keeps its own `source`.
- **Sending.** While sharing is on for the active profile: send once when it is switched on, then when the report changes, at most once a minute, and once when the page becomes visible again. Stop while the page is hidden. A failed send sets `state` to `failed` and is tried again on the next change or after a minute. Switching off sends `remove` first and only then forgets the `reportId` and `key`.
- **The demo profile never touches the network.** Switching sharing on for it works on the device only.
- **The ground view.** `openGroundView(code)` calls the endpoint and maps the answer to `state`: 200 `open`, 401 `wrong-code`, 503 `not-set-up`, anything else or no `VITE_GROUND_URL` `offline`. While `open`, fetch again every 30 seconds and stop while the page is hidden. The code is held in a module variable, never in the store, never in browser storage, never in a URL. `closeGroundView()` clears it and the reports.
- **The simulated ground view.** `openSimulatedGroundView()` fills `reports` with one report for each member of the simulated crew that `data/social/simulatedCrew.ts` already defines, plus the demo profile's own report if its sharing is on. All have `kind` `demo` and every value has source `simulated`. Give them fixed values worked out from the clock so they are the same on every device: one crew member with an `act` level, two with `watch`, the rest `ok`, and `sentAt` values that differ on purpose (a few minutes ago, about an hour ago, about nine hours ago) so the screen can show a late report. Use `levelFor` for every level; do not write a level by hand.
- **Tests:** a profile with sharing off sends nothing; the request body holds only `reportId`, `key` and `report`, and the report holds only the contract's fields (assert that no mood note, meal, body mass or birth year is in it); switching off sends `remove`; the demo profile makes no request; each server status maps to its `state`; the code is in no store state and no storage key; old saved data loads with sharing off.

### Part 3. The screen

`app/src/screens/admin/`, with `meta.ts`: `id` `admin`, `label` `Admin`, `group` `reference`, `order` 40, `owner` `Rami`, `status` `ready`, `eyebrow` `GROUND · MEDICAL TEAM`, an icon from lucide that reads as oversight, and `description` "What the medical team on Earth sees: the record of every crew member who agreed to share it." Also `guide.ts` in the shape the other screens use. The registry finds the folder by itself; edit no list. Built from the shared components, importing only from `@/design`, `@/data`, `@/ophi` and `@/registry`.

1. **`ScreenHeader`**, with pills that say how many crew are reporting and how many need attention once the view is open.
2. **Card "Send my record to Earth"**, about the active profile. One sentence: "The medical team on Earth sees nothing of yours until you switch this on." A `Switch`, "Share [display name]'s record with the ground team". Turning it on opens a `ConfirmDialog` first, with exactly what is sent: "The ground team will see your name and role, today's sleep, food, water, exercise and mood with their status, the last seven days of each, your latest heart rate, and your alerts, including questions the Med bot passed to the flight surgeon. They do not see your mood notes, your meals, your body mass or your chats. You can switch this off at any time and your record is deleted from the server at once." Buttons "Share my record" and "Not now". Under the switch, the state in words: when it was last sent, or that the last send failed and will be tried again. A source badge says whether this is a real or a simulated profile.
3. **Card "Ground view"**, closed at first. One sentence saying this part is for the medical team on Earth. Two buttons: "Open with the ground code" and "Look at the simulated crew".
   - Either button opens a `ConfirmDialog` before anything is fetched: "You are about to open the health records of the crew. They are private. Open them only if you are part of the medical team for this mission." Buttons "Open the records" and "Cancel".
   - After confirming the first button: a password-type field for the code and "Open". `wrong-code`: "That code is not right." `not-set-up`: "The ground code has not been set on the server yet. You can look at the simulated crew instead." `offline`: "The server cannot be reached."
   - After confirming the second: the simulated crew, with a line above the list saying every person in it is simulated.
4. **When open: the crew list.** A line first: "Signal delay on this mission: [delay from `useMission()`]. A report is at least that old when it arrives." and when the list was last fetched. Then one row per report, the one that needs attention most first. Each row: name, role, the worst level of its summary as a `StatusPill` with its word, how many open alerts, and "Sent [time] · [how long ago]". A report older than one hour also says "No newer report has arrived", in neutral tone, in words and not by color alone. A `demo` report carries the `SIMULATED` badge.
5. **A row opens a `DetailDrawer`:** the five summary lines (sleep, food, water, exercise, mood) each with its level, its text and its source badge; today's values against their targets; a seven-day `TrendChart` for each of the five weekly metrics with the target line and a text summary; the latest vitals with their source badge and time, or "No reading"; the alerts with time, kind and status, questions for the flight surgeon under their own heading. Targets shown carry a `SourceLine`. Missing values are shown as missing.
6. **Nobody has shared yet:** an `EmptyState`, "No crew member is sharing a record yet. Each person chooses for themselves in the card above, on their own device."
7. **"Close the ground view"** calls `closeGroundView()` and returns the card to its closed state. Leaving the screen does the same.
8. The ground view only reads. No button changes a crew member's data, acknowledges an alert or sends a message.
9. Works at 360 px and 1440 px with no sideways scrolling.

### Do not build

Accounts or passwords for ground staff, messages from ground to crew, editing or acknowledging from the ground view, export or download of records, any report that includes a field outside `GroundReport`, a default or example ground code.

### Checks you must run and pass before reporting

- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` in `app`, all clean.
- On the demo profile: the switch asks for confirmation and remembers its state; "Look at the simulated crew" asks for confirmation, then lists the simulated crew with different report ages; a row opens its detail; closing empties the view.
- Read every request your code can send and confirm that a profile with sharing off sends nothing, and that the code appears only in the `Authorization` header of the one `GET`.
- Search your diff for the code, for any real name beyond what `team.ts` already holds, and for any reading. There must be none.
- With `VITE_GROUND_URL` empty the app builds, the switch explains that the server cannot be reached, and the simulated view still works.
- 360 px wide: no sideways scrolling on the closed card, the open list and the drawer.

**Report:** what you built, the result of each check, exactly what the server stores and for how long, and what you could not test (the real server with the secret set, and two real devices, most likely).

When all checks pass, commit, push this branch, and report. Do not merge.
