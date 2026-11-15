# Orbital Health API integration

All routes require `Authorization: Bearer <server-configured-token>` with permission for the requested astronaut. API tokens belong in a trusted backend proxy, not bundled Base44/browser source. Configure a same-origin proxy to this service; no wildcard CORS policy is enabled.

## Candidate-review mode

The recommendation API defaults to `HEALTH_PROTOCOL_MODE=candidate_review` with `HEALTH_KNOWLEDGE_MODE=draft`. Set the protocol mode to `approved` to retain the original approved-action behavior. No frontend or Med Bot source was changed.

The existing `recommendations` array may now contain personally matched draft records with `status: requires_review`, `requires_medical_approval: true`, `protocol_origin: draft_candidate`, and the original `protocol_review_status: pending`. The assessment has `protocol_mode: candidate_review` and remains `medical_review_required`. This is not confirmation that an intervention is safe or approved.

Additional per-card provenance fields are `matching_condition_ids`, `matching_relation_ids`, and `applicability_limitations`. Display the limitations and review badge prominently. Do not attach treatment-start controls or display the card as an approved action. Candidate frequency and recheck fields remain null. The existing evidence endpoint returns actual draft source records marked `research_only: true` with their original review flags. These snapshots are saved with the assessment and remain subject to astronaut authorization.

Condition-only matches have no supporting measurement IDs. Do not invent metric links in the UI. Condition IDs and mission applicability fields come from trusted profile provisioning; client-supplied `mission_context` cannot add diagnoses or select a mission phase for this path. With the present CSV graph, the agent needs a matching recorded condition because the nine candidates have no direct biomarker links. Missing personal or mission context legitimately produces zero cards.

See [examples/candidate_review_response.json](examples/candidate_review_response.json) for a response generated from the actual CSV and a synthetic profile. The selection model in that demonstration is an explicitly labeled stub; production requests continue to use the installed local Ollama model. Use a new request ID after changing mode or profile/configuration because retries return the original saved assessment.

## Endpoints

| Method | Path | Result |
|---|---|---|
| POST | `/api/health/assess` | Full persisted assessment with findings, risks, limitations and 0–5 recommendations |
| GET | `/api/astronauts/{id}/recommendations` | Latest full assessment; 404 before first assessment |
| GET | `/api/recommendations/{id}/evidence` | `{ "evidence": [...] }`, including source title, URL, excerpt, page/section and limitations |
| GET | `/api/astronauts/{id}/health-history?days=30&metrics=sleep_duration` | Authorized profile, baseline status, historical readings, symptoms and prior assessments |

POST example (use a current, timezone-aware timestamp; this timestamp is illustrative):

```json
{
  "astronaut_id": "AST_001",
  "request_id": "sensor-batch-unique-id",
  "measurements": [
    {
      "measurement_id": "sleep-measurement-unique-id",
      "astronaut_id": "AST_001",
      "metric": "sleep_duration",
      "value": 5.8,
      "unit": "hours",
      "timestamp": "2026-11-15T08:00:00Z",
      "source": "wearable-demo"
    }
  ],
  "symptoms": [],
  "mission_context": { "flight_day": 128 }
}
```

Trusted profile data supplies mission and environment identity for safety checks. Client context cannot authorize protocols or alter these identities. Measurements must name the same astronaut as the request. `request_id` is the idempotency key: preserve it on transport retries. Send a new ID for a new assessment.

The complete generated synthetic response is [examples/synthetic_response.json](examples/synthetic_response.json). Real empty knowledge exports produce `risk_level: "undetermined"`, `assessment_status: "medical_review_required"`, `recommendations: []`, and a missing-approval explanation. `invalid_input` means no current measurement passed validation. `incomplete` retains deterministic results when the model fails. Partial input rejection is visible in `validation.rejected` and `limitations`.

## Connect existing Countermeasures cards

Replace the hardcoded array at the existing data-fetch boundary, preserving existing classes and layout:

```jsx
const response = await fetch(
  `/health-proxy/api/astronauts/${encodeURIComponent(astronautId)}/recommendations`,
  { credentials: 'include', signal: abortController.signal }
);
if (!response.ok) throw new Error(`Assessment request failed (${response.status})`);
const assessment = await response.json();
const cards = assessment.recommendations.slice(0, 5);
// Existing component: cards.map(card => <RecommendationCard key={card.recommendation_id} ... />)
```

Map `title` → card title, `description` → body, `priority` → order, and `frequency_label` → timing (omit if null). Show `status` as a badge, `related_risk_ids` as supporting risk, and `supporting_metric_ids` as supporting readings. Read actual values from assessment validation/findings or authorized history. Link to the evidence endpoint for the evidence panel. Render text as text, not raw HTML. Allow only HTTP(S) source links when opening external evidence.

For `approved_action`, show the approved protocol instruction. For `requires_review` or `informational_only`, show review/education styling and disable any start-treatment control. For `escalation`, show an urgent card before routine content. Independently show `escalation_required` and `escalation_status` even when there are zero cards; a missing approved workflow must not hide the urgent state. Pending escalation requires human action and does not mean a clinician was notified. Display `limitations`, especially synthetic-demo and missing-data notices. A zero-length array must show an honest empty state, not placeholder medical advice. Do not render old hardcoded numerical intervention instructions.

Use a loading state and a visible retry/error state; abort requests when switching astronauts and clear the previous astronaut's cards. Handle 401 (session/authentication), 403 (access denied), 404 (no assessment), 409 (idempotency/measurement conflict), and 422 (invalid request schema). The proxy must obtain the authorized astronaut from the authenticated application session and protect its service token.
