# Notes · 29 Med bot answers from the research

## Plan (prompt 29)
1. `tools/export-research.mjs`: reads `DB layer/DB/draft/*.csv`, keeps exact_match quotes with https sources, writes `research/research.generated.ts`. Runs as `prebuild`.
2. `research/research.generated.ts`: generated passages (id, quote, title, url, search words). Committed.
3. `research/search.ts`: `findPassages(question, screenLabel)`, keyword scoring, at most 4 passages, 2 per source, 1,400 characters.
4. `research/search.test.ts`: the search tests, quotes checked against evidence.csv, generated file checked against the script.
5. `chat.ts`: adds the `[research]` block to the user turn and returns `sources`; fallback mentions the research.
6. `types.ts`: `ChatSource` and `sources` on the response. `medbot-system-prompt.txt`: one paragraph on the research block.
7. `worker.test.ts`: chat tests with a fake model. `src/screens/medbot/`: "From the team's research" under the reply.

## What is built (prompt 29)
- `tools/export-research.mjs` writes `research/research.generated.ts`: **107 passages from 24 sources** (138 exact_match evidence rows; the same quote from the same page, give or take a final period or a lead-in, is merged into the longer one). 47,898 bytes. Runs as `prebuild`. Same file byte for byte from the repo root and from `app`.
- `research/search.ts` `findPassages`: words of 3+ letters, common words and words found in nearly every passage ("space", "astronaut", "mission") dropped, simple plurals folded. Rarer words weigh more. Item names and aliases count 3x a quote word; a whole multi-word item name in the question adds a bonus; the screen label adds a little but never makes a passage match alone. Threshold `MIN_SCORE = 4`, and a passage must reach half the best score. Under 1 ms per question.
- `chat.ts`: the `[research]` block goes between the context and the question; `sources` returned; none in watch mode (no block either) and none with an urgent reply. Model down with matches: "I can't reach my full brain right now, but the team's research has something on this. The passages are below. Use Emergency if it's urgent." and `sources` still carried. Logging unchanged.
- `medbot-system-prompt.txt`: one new paragraph after "What you are given", explaining the block. No other paragraph changed. `prompts/companion/medbot-system-prompt.md` (not this lane) does not have it yet.
- Screen: `src/screens/medbot/ResearchSources.tsx` and `sources.ts`; a "From the team's research" card under the conversation for the latest reply.

## Five questions and what came back
**"why do I lose bone in space"** (from Med bot): 4 passages
- "Scrutinizing scans of astronauts’ spines to inform strategies that counter bone and muscle loss in space" (Ongoing HRP Research - NASA)
- "Astronauts undergo routine bone scans before and after spaceflight to help researchers keep track of bone density changes, as well as the..." (Risk of Spaceflight-Induced Bone Changes - NASA)
- "Canadian scientists use space to study our bones, heart, blood vessels and brain." (Why do we conduct science experiments in space? | Canadian Space Agency)
- "Ongoing research seeks to better understand and quantify these losses, and help preserve bone strength through diet, exercise, and medica..." (Risks of Human Spaceflight - NASA)

**"what does radiation do to me"** (from Med bot): 4 passages
- "NASA scientists are working to develop strategies to identify and prevent health complications from space radiation exposure, including b..." (Risk of radiation-induced cancers - NASA)
- "Neutron radiation, which contributes to about 30% of total radiation on the ISS , is especially harmful because it can cause serious biol..." (Monitoring radiation for astronaut health | Canadian Space Agency)
- "Crews exposed to radiation from space may be more likely to develop cancer. Identifying the best ways to mitigate this risk and understan..." (Risks of Human Spaceflight - NASA)
- "NASA Studies Simulated Radiation" (Risk of radiation-induced cancers - NASA)

**"my eyes are blurry"** (from Med bot): 3 passages
- "Approximately 70 percent of astronauts aboard the International Space Station experience some swelling in the back of their eyes." (Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS) - NASA)
- "Investigating if a daily B vitamin supplement can prevent or mitigate brain and eye changes that may affect some humans in space" (Ongoing HRP Research - NASA)
- "Examining the relationship between fluid pressure inside the skull and changes to the eyes and brain of astronauts" (Ongoing HRP Research - NASA)

**"I can't sleep well"** (from Sleep): 3 passages
- "Space crews experience multiple hazards simultaneously. Stressors include chronic sleep loss, constant work demands, and irregularities i..." (Risks of Human Spaceflight - NASA)
- "To help minimize some of the stresses of spaceflight on the International Space Station, light-emitting diodes, or LEDs, simulate Earth’s..." (Risk from Inadequate Sleep and Irregular Schedules - NASA)
- "Risk of performance decrements and adverse health outcomes resulting from sleep loss, circadian desynchronization, and work overload" (Risk from Inadequate Sleep and Irregular Schedules - NASA)

**"I keep sleeping badly"** (from Sleep): 1 passage
- "Mild hypoxia, if untreated, can cause confusion, headaches, vision impairment, and trouble sleeping." (Risk of Hypoxia - NASA)

**"how does my immune system change"** (from Med bot): 3 passages
- "altered immune system response" (Risk of Altered Immune System Responses - NASA)
- "Scientists analyzed blood and saliva samples from Artemis II crew members to see how deep space changes the immune system." (Ongoing HRP Research - NASA)
- "The stresses of spaceflight can awaken inactive viruses inside the bodies of astronauts, leading to rashes and other symptoms." (Risks of Human Spaceflight - NASA)

**"what about kidney stones"** (from Med bot): 0 passages

Read: bone, radiation, eyes and immune are on topic. The fourth bone passage mentions "medication" in general terms, no medicine named and no dose. "Kidney stones" gets nothing because the research has nothing on the kidneys. Plain plurals only: "sleeping" does not match "sleep", so "I keep sleeping badly" finds one hypoxia quote ("trouble sleeping") instead of the sleep passages; "stressed" and "isolated" find nothing.

## Checks (prompt 29)
- `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` in `app`: all clean (45 files, 516 tests). The build runs the export first and leaves `git status` unchanged.
- `DB layer` renamed away: `npm run build` printed `export-research: "DB layer/DB/draft" not found, kept the existing research.generated.ts` and succeeded. Renamed back.
- No row from `protocols` or `inventory`, no dosage, frequency or duration column, and no "mg"/"IU"/"tablet" dose in the generated file (checked by a test too). One quote says astronauts exercise "1.5 hours per day": that is an evidence quote about exercise, not a protocol row.
- Worker: bundled `worker/index.ts` with rolldown (95 kB, text loader for the prompt) and type-checked `chat.ts`, `search.ts` and `types.ts` with a throwaway config. `wrangler` was not run, as asked.
- Screen checked in the browser at 360 px with a stubbed chat response: card under the conversation, quotes and long titles wrap, no sideways scroll, "Show all" opens the third passage, links open in a new tab.

Judgement call: a few quotes name a medicine in general terms (the daily B vitamin supplement study, "medicines to counter the effects of radiation exposures", "diet, exercise, and medication"). They are kept because none gives an amount and the system prompt still forbids advising a medicine. The Risks screen leaves the B vitamin item out; filter it here too if the team prefers.

## Not tested (prompt 29)
- The live model with the block: whether Llama on Workers AI bases its answer on the passages and says it comes from the team's research. Needs a deploy.
- `ChatSource` is in CONTRACTS section 8 ("all defined in data/types.ts") but `@/data` does not export it. The screen declares the same shape in `src/screens/medbot/sources.ts`; the Worker declares it in `types.ts`.

---

# Notes · 10b Endpoints

## Plan
1. `NOTES.md`: Plan and build notes for Cloudflare Worker endpoints.
2. `medbot-system-prompt.txt`: Section 1 of companion prompt, word for word.
3. `types.ts`: Env, chat request/response, and event shapes.
4. `validation.ts`: Strict validators for events and 6-char room codes.
5. `roomDo.ts`: RoomDurableObject with SQLite storage, monotonic cursor, 1-hour retention.
6. `chat.ts`: POST /api/chat with Workers AI, 8s timeout, urgent/forward detection, watch capping.
7. `events.ts`: Handlers for POST /api/events and GET /api/events dispatching to RoomDurableObject.
8. `index.ts`: Worker entrypoint routing /api/*, assets fallback, privacy logging, rate limits.
9. `README.md`: Endpoints documentation, payload examples, local testing, extension guide.
10. `worker.test.ts`: Vitest suite for validation, SQLite storage, cursor, retention, chat rules.

---

## What was built
- **Cloudflare Worker Server**: Set `app/wrangler.jsonc` main to `worker/index.ts`. All `/api/*` routes are handled dynamically by the Worker; all other paths (including SPA deep routes) are served by `env.ASSETS` from `dist/`.
- **POST `/api/chat`**:
  - Bound to Cloudflare Workers AI (`env.AI`) with model `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (overridable via `env.CHAT_MODEL`).
  - Uses Section 1 of `prompts/companion/medbot-system-prompt.md` verbatim in `app/worker/medbot-system-prompt.txt`.
  - 8-second model timeout returning graceful scripted offline fallback replies if remote AI is down or slow.
  - Enforces 1,000-character cap on message and 4,000-character cap on context.
  - Enforces watch mode brevity: at most 2 short sentences, capped around 30-35 words.
  - Decision on `urgent`: Implemented via direct check on reply (and user prompt for acute signs) for Emergency screen / Emergency button directions. This is fast and reliable without risking an extra model roundtrip or timeout.
  - `forward`: `true` if and only if the reply ends with `"This is one for the flight surgeon."` and `urgent` is `false`.
  - Zero server persistence: chat messages and context are never logged or stored.
- **POST and GET `/api/events`**:
  - Validates event messages against Section 10 of CONTRACTS.md: known types, 6-character room code from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0, O, 1, I), ISO timestamps, and payload range boundaries (heart rate 20..250, spo2 50..100, skinTemp 20..45).
  - Backed by SQLite in Durable Objects (`RoomDurableObject`), declared in `wrangler.jsonc` (`new_sqlite_classes: ["RoomDurableObject"]`).
  - Rooms are isolated by Durable Object instance (`env.ROOM_DO.idFromName(room)`).
  - Ordering: Monotonic autoincrement `seq` cursor, returning events oldest first.
  - 1-hour retention: Deletes messages with `created_at` or `at_ms` older than 1 hour on every write.
- **Rate Limiting & Payload Caps**:
  - 100 KB request body size cap.
  - In-memory rate limiting per client IP (180 requests/minute, ample for watch + consoles).
- **Privacy Logging**:
  - Logs exclusively `METHOD PATH STATUS DURATION_MS` (e.g. `POST /api/chat 200 482ms`). Never logs bodies, query parameters, room codes, or messages.
- **Environment**:
  - Created `app/.env.production` with `VITE_CHAT_URL=/api/chat` and `VITE_EVENTS_URL=/api/events`.

## What is faked or stubbed
- In local unit tests with Vitest, SQLite storage is verified using an in-memory SQL mock matching Cloudflare's synchronous `ctx.storage.sql.exec` API, and Workers AI is stubbed when the remote binding is not present.
- Live Workers AI remote inference runs on Cloudflare's GPU network; local `npx wrangler dev --local` uses the offline fallback for AI unless logged in with an active Cloudflare account token.

## What could not be verified
- Live Cloudflare remote deployment via `wrangler deploy` was not executed, as creating production cloud credentials and tokens is reserved for human operators (Part A / manual setup).
- Real BLE hardware watch sensors broadcasting to the live endpoint were simulated with curl and automated tests.

## How to see it working
1. Start the worker dev server:
   ```bash
   cd app
   npx wrangler dev --local --port 8799
   ```
2. Test chat endpoint:
   ```bash
   curl -X POST http://localhost:8799/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "How am I doing today?", "context": "[context]\nscreen: Nutrition\nmission: Demo\n[end context]"}'
   ```
3. Post an event:
   ```bash
   curl -X POST http://localhost:8799/api/events \
     -H "Content-Type: application/json" \
     -d '{"id":"evt-1","room":"ABCDEF","type":"vitals.sample","at":"2026-11-15T12:00:00Z","origin":"watch","payload":{"heartRate":72,"source":"live"}}'
   ```
4. Query room events:
   ```bash
   curl "http://localhost:8799/api/events?room=ABCDEF"
   ```
5. Run all checks:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
