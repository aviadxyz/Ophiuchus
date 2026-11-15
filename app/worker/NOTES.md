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
