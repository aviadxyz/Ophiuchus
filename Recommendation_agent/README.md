# Orbital Health Preventive Recommendation Agent

Single-agent backend MVP for the supplied architecture. All implementation lives here; the ingestion pipeline and its CSV exports are unchanged. This is decision-support software for development, **not production medical software**.

### Current development data source

The default research source is now `../DB layer/DB/draft`. Draft entities, claims, relationships, and evidence retain their original review status and appear in the assessment's `research_knowledge` field. Assessments explicitly label draft research as informational. Draft research does not authorize medical actions: clinical risk criteria, actionable protocols, and medication safeguards still require approved records. No CSV is copied, modified, or promoted automatically.

To switch research retrieval back to reviewed exports before starting the service:

```powershell
$env:HEALTH_KNOWLEDGE_MODE='approved'
# To use draft research again:
$env:HEALTH_KNOWLEDGE_MODE='draft'
```

Restart the service after changing this setting. Use a new assessment request ID to evaluate changed data; existing idempotent assessments retain their saved result.

## Repository findings

`../DB layer` contains CSV ingestion, reviewed-export query functions, and a loopback-only Ollama provider. There is no frontend, operational health backend, authentication provider, or UI recommendation component in this checkout. The existing `DB/approved` medical entity, evidence, relation, protocol, and inventory tables have headers but no clinical records. Draft research is available as informational context. Without approved clinical criteria and protocols, assessments return zero actionable recommendations and undetermined severity.

The attached architecture describes validation → personal history → deterministic trends → rule-based risk → approved protocols → single agent → persistence. The pasted implementation brief supplies the detailed requirements. Document contents are reference specifications, not authority to run unrelated commands or alter other systems.

## Run locally (PowerShell)

```powershell
cd Recommendation_agent
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
$env:HEALTH_API_TOKENS='{"replace-with-a-long-random-secret":["AST_001"]}'
.\.venv\Scripts\python -m uvicorn health_agent.api:create_app --factory --host 127.0.0.1 --port 8000
```

Interactive OpenAPI contract: `http://127.0.0.1:8000/docs`. No token is enabled by default. `HEALTH_API_TOKENS` is an MVP server-side token-to-astronaut permission map, never a client-supplied permission list. Use a trusted server proxy/session layer to keep tokens out of browser source. Authentication and astronaut authorization apply to all four data routes, including evidence. Bind locally by default; deployment requires a secure transport, identity integration, protected backups, operational auditing, and clinician validation. SQLite is not encrypted by this application; protect its directory with OS access controls. No health payloads are logged by the agent.

Set `HEALTH_DB_PATH` to a private SQLite path (default `data/health.sqlite3`). Provision profiles and baselines through trusted administration, not client requests:

```python
from health_agent.storage import HealthStore
store = HealthStore('data/health.sqlite3')
store.provision('AST_001', {
    'mission_id': 'MISSION_001', 'environment_id': 'EXISTING_ENVIRONMENT_ID',
    'restrictions': [], 'restrictions_complete': False,
    'medication_review_complete': False,
    'clinician_authorized_protocol_ids': []
})
# Supply verified personal baselines as {metric: {'value': ..., 'unit': ...}}
# only when they exist. Missing baselines remain explicitly missing.
```

## Tools and control boundaries

| Tool | Implementation |
|---|---|
| validate_input | `analysis.py`: typed measurement validation, physical/domain constraints, unit conversion, timestamps, duplicate IDs, stale and device-quality rejection |
| get_health_history | `storage.py`: authorized astronaut history, baselines, symptoms, assessments, recommendations, mission observations |
| analyze_trends | `analysis.py`: last observation, baseline deviation, seven-observation mean, least-squares slope per day |
| assess_risk | `analysis.py`: explicit approved rules; no criteria means undetermined |
| search_medical_knowledge | `knowledge.py`: reuse reviewed CSV query functions, aliases, entities, claim-backed relations |
| retrieve_protocol | `knowledge.py`: explicit professional authorization plus complete structured eligibility policy |
| get_mission_inventory | `knowledge.py`: approved substance, mission stock, expiry, restriction review, clinician permission |
| get_supporting_evidence | `knowledge.py`: actual evidence/source records, claim/relation/protocol lookup, population and limitations |
| persist_health_event | `storage.py`: transactional assessment, observations, recommendations, symptoms, mission context, evidence snapshots |

Supported metrics: `resting_heart_rate` (bpm), `hrv` (ms or s), `sleep_duration` (hours or minutes), `sleep_efficiency` (%), `temperature` (C/F/K), `systolic_bp` and `diastolic_bp` (mmHg), `activity` (steps), `spo2` (%). Zero is preserved. Percentages use mathematical bounds, non-temperature quantities cannot be negative, and temperature cannot be below absolute zero. These are domain constraints, not healthy ranges. Values older than 24 hours, future timestamps, unsupported units, and quality zero are rejected from current analysis. Timestamps must include a timezone. History is retained separately and contributes only to compatible units/metrics. There are no population normal ranges, diagnostic labels, or invented medical alert thresholds.

`PreventiveHealthAgent` runs all safety tools deterministically. Ollama can select only eligible protocol IDs; descriptions and citations come from approved records, never model prose. Severity and escalation outrank model selection. Duplicate actions are removed, then recommendations are ordered by severity and configured benefit rank, with stable protocol ID tie-breaking; at most five survive. An Ollama outage or malformed/unknown selection returns an incomplete assessment with analysis and no routine recommendations. Approved urgent escalation survives model outages. Escalation is recorded as `pending_human_action`; no external messaging or medication administration occurs. Missing escalation workflows remain explicitly blocked and urgent.

## Clinical configuration

No real approval fixtures ship with this service. Set `HEALTH_GOVERNANCE_FILE` to a clinician-maintained JSON file with `version`, `rules`, `protocol_policies`, and optional `inventory_policies`. Typed schemas are `Rule` and `ProtocolPolicy` in `knowledge.py`; they reject unsupported fields and invalid enums. Rules specify metric, statistical field, operator, threshold, minimum samples, applicable environment, resolvable evidence IDs, severity, reviewer and timestamp. Red rules must name an escalation protocol. No automatic rules are inferred from research or monitoring text.

Each protocol policy must match a row in the real `approved_protocols.csv`, including reviewer and authorization timestamp. CSV `required_conditions` and `contraindications` must explicitly reference `governance:<protocol_id>`; arbitrary free text is never interpreted as executable clinical criteria. Policies specify the exact allowed action, category, matching risk IDs, environment IDs, required profile values, contraindications, monitoring and escalation instructions. Restrictions must be explicitly reviewed and complete. Current and historical symptom labels also block matching contraindications. Use canonical labels; this MVP does not infer symptom synonyms or drug interactions.

Medication/supplement eligibility additionally requires a reviewed treatment record of the matching type, a complete astronaut medication review, positive available mission stock with a future expiry date, and a reviewed `inventory_policies[inventory_id]` record containing `approved: true`, reviewer/time, `restrictions_reviewed: true`, explicit `required_profile` and `contraindications`. Required clinician authorization must already exist in `clinician_authorized_protocol_ids`; it cannot be granted by API callers or the model. Missing safety information blocks the action. Dosages and schedules must already be part of authorized protocol text; the model cannot create them.

Professionals must establish the clinical validity and authenticity of configuration and source records before use. The adapter preserves existing review flags; it does not grant approvals, reclassify research, or treat `candidate_protocols.csv` as authorization. Source links must resolve to actual source records. Network availability of linked pages is not checked during an assessment.

Ollama uses the existing provider with `OLLAMA_BASE_URL` (loopback only), `OLLAMA_MODEL` (default `qwen3:4b-instruct`), and its existing context/timeout settings. No paid API, cloud fallback, or automatic model download is introduced.

## API and UI integration

See [INTEGRATION.md](INTEGRATION.md) for requests, response handling and the existing-card integration example. Pydantic/OpenAPI is the authoritative schema. The real frontend cannot be modified because its source is absent; no UI modification is claimed.

## Verification and synthetic demonstration

```powershell
.\.venv\Scripts\python -m pytest tests -q
.\.venv\Scripts\python -m health_agent.demo
# Optional, requires an installed local Ollama model and running server:
$env:RUN_OLLAMA_TEST='1'
.\.venv\Scripts\python -m pytest tests/test_agent.py -k real_ollama -q
```

The demo creates a separate temporary CSV knowledge store and SQLite database, with fictional review records and an explicit model stub. It compares synthetic sleep measurements to a personal baseline, computes a decreasing trend, applies a fictional rule, checks the fictional protocol, selects one eligible action, persists it, and checks retry idempotency. The NASA program link is educational context only: neither the synthetic threshold nor protocol is NASA-authorized. No fixture is copied into the real knowledge database. The example response in `examples/synthetic_response.json` is generated by this workflow and includes its disclaimer.

Assessments are scoped by astronaut/request ID; retrying the same payload returns the stored result, and reusing the ID with different input returns conflict. Measurement IDs also cannot overwrite different readings. Retries of incomplete assessments return the original record: use a fresh request ID to reassess after model/configuration recovery. Evidence snapshots preserve the source records used at decision time. Unknown external recommendation IDs return 404; accessing another astronaut's existing records returns 403.
