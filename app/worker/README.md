# Ophiuchus Worker Backend (`app/worker/`)

This directory contains the Cloudflare Worker backend for Ophiuchus. It hosts the Med bot chat endpoint (`/api/chat`) and the device relay event broker (`/api/events`), backed by Cloudflare Workers AI and a SQLite-backed Durable Object.

All non-`/api/*` routes are delegated directly to the SPA static build in `dist/` via Cloudflare's static assets binding (`env.ASSETS`).

---

## 1. Endpoints

### 1.1. `POST /api/chat`
Answers crew medical and health questions without exposing model keys to the browser.
- **Model**: Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`, configurable via `env.CHAT_MODEL`).
- **System Prompt**: Kept in `app/worker/medbot-system-prompt.txt` (word-for-word from Section 1 of the companion prompt). Teammates can modify the text file directly without editing code.
- **Limits**: Maximum 1,000 characters for message text; 4,000 characters for context.
- **Timeout**: 8 seconds on model calls; falls back gracefully to friendly offline replies on timeout or network error.
- **Privacy**: Chat messages, context, and responses are **never** stored on the server.

#### Request Shape
```json
{
  "message": "How much water should I drink today?",
  "screenId": "nutrition",
  "screenLabel": "Nutrition",
  "context": "[context]\nscreen: Nutrition\nmission: Ophiuchus-1, day 12 of 45, Lunar orbit\nwater: today 1.2 of 2.5 L, status watch, source entered\nreply mode: standard\n[end context]",
  "replyMode": "standard"
}
```

#### Response Shape
```json
{
  "reply": "You're at 1.2 litres toward your 2.5 litre target for today. Drinking another bottle this afternoon will keep you on track.",
  "urgent": false,
  "forward": false
}
```

- `urgent`: `true` when the reply directs the user to the Emergency screen or button; `false` otherwise.
- `forward`: `true` when the reply ends with the exact forwarding sentence `"This is one for the flight surgeon."`, and **never** `true` when `urgent` is `true`.

---

### 1.2. `POST /api/events`
Relays messages between a paired watch and console (e.g. emergencies, vital samples, health summaries).

#### Validation Rules
- `room`: 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0, O, 1, I).
- `type`: One of `emergency.raised`, `emergency.cancelled`, `emergency.acknowledged`, `vitals.sample`, `summary.updated`.
- `at`: Valid ISO 8601 timestamp string.
- `origin`: `'console'` or `'watch'`.
- `payload`:
  - `emergency.raised`: `{ "alertId": "alt-123", "message": "High HR alert" }`
  - `emergency.cancelled`: `{ "alertId": "alt-123" }`
  - `emergency.acknowledged`: `{ "alertId": "alt-123" }`
  - `vitals.sample`: `{ "heartRate": 82, "spo2": 98, "skinTempC": 36.6, "source": "live" }` (ranges: HR 20..250, SpO2 50..100, skinTemp 20..45).
  - `summary.updated`: Non-empty `HealthSummary` object.

#### Example Request
```json
{
  "id": "evt-sim-4921",
  "room": "ABCDEF",
  "type": "vitals.sample",
  "at": "2026-11-15T10:30:00.000Z",
  "origin": "watch",
  "payload": {
    "heartRate": 74,
    "spo2": 99,
    "skinTempC": 36.4,
    "source": "live"
  }
}
```

#### Response Shape
```json
{
  "ok": true,
  "id": "evt-sim-4921"
}
```

---

### 1.3. `GET /api/events?room=CODE&after=CURSOR`
Retrieves messages for a room newer than `CURSOR`, ordered oldest first.

#### Query Parameters
- `room` (required): 6-character room pairing code.
- `after` (optional): Monotonic cursor sequence from previous call.

#### Response Shape
```json
{
  "events": [
    {
      "id": "evt-sim-4921",
      "room": "ABCDEF",
      "type": "vitals.sample",
      "at": "2026-11-15T10:30:00.000Z",
      "origin": "watch",
      "payload": {
        "heartRate": 74,
        "spo2": 99,
        "skinTempC": 36.4,
        "source": "live"
      }
    }
  ],
  "cursor": "42"
}
```

---

## 2. Storage & Retention

- **Storage Engine**: SQLite in Durable Objects (`RoomDurableObject`). Declared in `wrangler.jsonc` via `new_sqlite_classes: ["RoomDurableObject"]`.
- **Per-Room Isolation**: Each room code maps to its own Durable Object instance (`env.ROOM_DO.idFromName(room)`). Rooms cannot inspect each other's data.
- **Retention**: On **every single write**, all events with `created_at` or `at_ms` older than **1 hour** are pruned:
  ```sql
  DELETE FROM events WHERE created_at < ? OR at_ms < ?;
  ```
- **Zero Chat Storage**: `/api/chat` never writes messages or contexts to disk or memory.

---

## 3. Privacy & Logging

- Requests to `/api/*` are logged strictly with:
  ```
  <METHOD> <PATH> <STATUS_CODE> <DURATION_MS>
  ```
  Example: `POST /api/chat 200 482ms`
- **NEVER** logs:
  - User messages or prompt context
  - Bot replies
  - Room codes or query parameters
  - Event payloads or biometric data

---

## 4. Local Testing

To test the worker locally:
```bash
cd app
npx wrangler dev
```
Wrangler will boot the Miniflare local runtime with the SQLite Durable Object and Static Assets enabled.

### Testing Endpoints Locally
```bash
# Chat endpoint
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How am I doing today?", "context": "[context]\nscreen: Nutrition\nmission: Demo\n[end context]"}'

# Post an event
curl -X POST http://localhost:8787/api/events \
  -H "Content-Type: application/json" \
  -d '{"id":"test-1","room":"ABCDEF","type":"vitals.sample","at":"2026-11-15T12:00:00Z","origin":"watch","payload":{"heartRate":72,"source":"live"}}'

# Fetch events
curl "http://localhost:8787/api/events?room=ABCDEF"
```

---

## 5. Adding New Endpoints (e.g., `api/social/`)

When Prompt 17 introduces `/api/social/*`:
1. **Routing**: Add the route check in `app/worker/index.ts`:
   ```ts
   if (url.pathname.startsWith('/api/social/')) {
     return handleSocialRoute(request, env);
   }
   ```
2. **Storage**: Declare another SQLite-backed Durable Object class (e.g. `SocialDurableObject`) in `app/worker/socialDo.ts`, or add a table to an existing Durable Object.
3. **Migration**: Append a new migration tag in `wrangler.jsonc`:
   ```jsonc
   "migrations": [
     { "tag": "v1", "new_sqlite_classes": ["RoomDurableObject"] },
     { "tag": "v2", "new_sqlite_classes": ["SocialDurableObject"] }
   ]
   ```
4. **Retention**: Social chat messages expire after 24 hours (per docs/REAL_DATA.md rule 10).
