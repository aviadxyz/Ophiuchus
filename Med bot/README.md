**Draft data warning:** The data that was taken from `DB/draft`, including candidate protocols, has not undergone human review and may contain mistakes. It requires human review before clinical use.

# Orbital Health Med Bot

One local conversational agent for medical questions and emotional support. New files live only in this folder. Existing recommendation, ingestion and frontend code remain unchanged. This is a demonstration, not a medical service or psychiatric treatment system.

## Start with the existing environment

From the repository root in PowerShell:

```powershell
cd 'Med bot'
$env:HEALTH_API_TOKENS='{"replace-with-a-long-random-secret":["demo"]}'
& '..\Recommendation_agent\.venv\Scripts\python.exe' -m uvicorn medbot.api:create_app --factory --host 127.0.0.1 --port 8001 --workers 1
```

This reuses the Python environment already installed for the recommendation agent. No dependency is installed or upgraded by this implementation. Open `http://127.0.0.1:8001/docs` for the typed API. Keep server tokens out of source, browser bundles and screenshots. Replace `demo` with the identity associated with your existing health records when appropriate. This command does not create synthetic health history automatically.

The service defaults to no authorized users if `HEALTH_API_TOKENS` is absent. Each accepted token must map to exactly one astronaut; multi-astronaut administrative credentials are rejected on Med Bot routes. The client never chooses its astronaut ID. Use a trusted authenticated application proxy when connecting a browser. No permissive CORS configuration is enabled.

### Configuration

| Setting | Default / meaning |
|---|---|
| `HEALTH_API_TOKENS` | Existing server-side token-to-astronaut map; defaults to `{}` |
| `HEALTH_DB_PATH` | Existing `Recommendation_agent/data/health.sqlite3`; read-only in Med Bot |
| `HEALTH_KNOWLEDGE_MODE` | `draft`; set `approved` to retrieve reviewed exports only |
| `HEALTH_GOVERNANCE_FILE` | Optional existing clinician-maintained rules/protocol configuration |
| `MEDBOT_DB_PATH` | `Med bot/data/medbot.sqlite3`, logically separate chat/mood storage |
| `MEDBOT_ASSESSMENT_URL` | Unconfigured; optional loopback URL ending in `/api/health/assess` |
| `MEDBOT_ASSESSMENT_TOKEN` | Server-only token authorized for the existing assessment service |
| `MEDBOT_SECURE_COOKIE` | `1`; optional legacy cookie requires HTTPS; use `0` only for local HTTP development |
| `OLLAMA_BASE_URL` | Existing provider's loopback-only URL, usually `http://localhost:11434` |
| `OLLAMA_MODEL` | Existing provider default `qwen3:4b-instruct`; must already be installed locally |
| `MEDBOT_TIMEOUT_SECONDS` | 30 per local-model HTTP operation; configurable up to 300 |

The existing Ollama provider is reused, including rejection of cloud-backed models. Med Bot applies a 30-second timeout per model HTTP operation and a bounded context budget. Classification and response generation are separate structured calls; a cold-start local-model verification occurs once per process. Total cold-start latency can exceed the current frontend's eight-second timeout. The frontend integration guide calls this out; no frontend timeout is silently changed.

Run one worker: temporary sessions are process-local. Saved sessions survive restart when saving is enabled; unsaved sessions do not. Multi-worker/distributed session storage is outside this delivery.

## Behavior and data boundaries

`MedBot` orchestrates authorization/consent → urgent-language triage → combined intent/mood classification → relevant tools → structured response → authorized context saving. Explicit self-reported mood overrides the model. Inferred mood is always tentative and is never inferred from heart rate, HRV, sleep, camera, or voice. Classification uses recent conversation to resolve follow-ups.

Ordinary loneliness, homesickness, stress, anxiety and crew-conflict conversations do not automatically trigger health analysis. Response style is controlled by the mood-aware prompt, not a fixed production reply per mood. Mock replies in tests and the demo are clearly labeled synthetic.

Personal data is fetched only with `personal_health` consent and a relevant personal-data intent. `HealthTools` imports the existing history, trend, risk, protocol, knowledge and evidence functions. Operational SQLite access uses `mode=ro`, so Med Bot does not create, migrate or edit the recommendation database. Missing records and baselines remain missing. Existing recommendations are explained with their original references rather than replaced. Medication questions are directed to the flight surgeon without doses or medicine changes.

Formal assessment requires both personal-data consent and `formal_assessment: true`. With the optional authorized loopback assessment interface configured, existing readings are submitted to the existing service; that service performs validation and saves the assessment. Stale readings may be rejected there. Chat alone never creates a formal assessment. No direct operational health-database write occurs here.

Draft knowledge remains research-only, carries original review flags and cannot authorize a clinical action. Source objects are built from actual source/evidence records with HTTP(S) URLs. Existing approved rules and protocols still govern actionable suggestions. Behavioral research lookup reuses the same CSV query layer. When no approved support options exist, everyday nonclinical supportive conversation remains available.

The model supplies a conversational bridge and selects only existing source/action IDs. Personal numbers, baseline comparisons, trend descriptions and research excerpts are rendered from retrieved records by the server. The response guard rejects unknown references, generated URLs, measurement values, common prescribing/dosing patterns, diagnoses and false claims of human contact. Source excerpts are quotations with review labels, not newly authorized treatment instructions. These guards and model prompts are development safeguards, not a proof that all unsafe or inaccurate language can be detected. Clinician review and broader safety evaluation are still necessary.

### Urgent situations and unavailable services

Deterministic language patterns run before optional research or model calls. Structured model triage provides another urgent signal. Self-harm language, immediate danger, concerning confusion and emergency descriptions prioritize human/onboard help. Existing approved red-risk findings also take precedence. No numerical mood score is used as an emergency threshold. Language triage is conservative, English-focused and may produce false positives or miss indirect phrasing; it is not validated clinical triage.

Urgent replies work even when Ollama is down. They point to the existing Emergency screen and onboard procedures, mention communication delays and clearly state that this demo cannot contact anyone. `human_support_available` is false. `request_crew_support()` returns `not_configured` and `contacted: false`, even with sharing consent: no integration exists. No hotline numbers or invented mission emergency protocols are provided.

Model connectivity failure produces `service_unavailable` (HTTP 503); invalid or rejected generated content produces `response_withheld`. No fabricated clinical fallback is generated. For actual health emergencies, this application is not a substitute for immediate human assistance.

## Consent, retention and deletion

All three consent flags start false:

- `personal_health`: permit relevant reads from existing operational records.
- `save_conversations`: retain chat messages and explicit session preferences across restarts.
- `mood_history`: permit voluntary check-in storage and use of that saved history in emotional conversations.

Temporary context expires after 30 minutes of inactivity and contains at most 50 messages and 25 cached responses per session. Saved messages, cached responses and voluntary mood records expire after 30 days. Expired data is purged on store operations, including subsequent reads; there is no background cleanup daemon while the service is stopped. At most 100 temporary sessions per astronaut and 1,000 total are accepted. Consent flags remain until changed or deleted.

Only explicit mood-check-in submissions create mood-history records. A self-reported mood in chat may guide that session and, with chat-saving consent, be part of its saved context; it is not automatically a mood check-in or shared clinical record. No inferred mood is saved as a clinical observation.

Chat-saving consent applies prospectively: enabling it does not copy earlier unsaved messages or preferences into persistent storage. Withdrawing chat-saving consent deletes saved chat sessions and keeps only current temporary continuity; reenabling it does not resurrect deleted saved messages. Withdrawing mood consent deletes saved check-ins. Withdrawing health consent clears health-tool-derived conversation context and saved sessions so those values are not subsequently reused. Deletion endpoints remove one session, mood history, or all Med Bot data for the authenticated astronaut. They do not delete operational health records. Retry keys are scoped to session/astronaut; repeating the same message returns its cached response, while changed content with the same key returns 409. First-message retries also reuse a server-issued session.

Detailed chats and mood notes are not written to shared health measurements. The service does not log message bodies, model prompts or health payloads; validation errors omit rejected input and responses use `Cache-Control: no-store`. Do not enable request-body logging in a proxy. SQLite uses secure deletion for removed content but is not encrypted by this service. Protect the directory, disks, backups and transport. No absolute confidentiality promise is made. No emergency disclosure is currently implemented because no contact integration is configured.

## Test and demonstrate

```powershell
& '..\Recommendation_agent\.venv\Scripts\python.exe' -m pytest tests -q
& '..\Recommendation_agent\.venv\Scripts\python.exe' -m medbot.demo
# Optional live test against the already installed local model:
$env:RUN_OLLAMA_TEST='1'
& '..\Recommendation_agent\.venv\Scripts\python.exe' -m pytest tests/test_ollama.py -q
Remove-Item Env:RUN_OLLAMA_TEST
```

The offline suite mocks model calls and uses synthetic astronaut data in temporary stores. The demo shows emotional support, a contextual follow-up, consent-based sleep explanation and urgent help without saving chat or mood history. It imports the existing synthetic health fixture without modifying real approved/draft exports. No paid calls, model downloads or external contact messages occur.

See [INTEGRATION.md](INTEGRATION.md) for exact API requests, response handling and frontend connection steps. The existing frontend is present but deliberately unchanged under this folder-only delivery.
