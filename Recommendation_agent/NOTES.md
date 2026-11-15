# Candidate-review implementation plan
1. Add typed, evidence-backed candidate retrieval with explicit applicability configuration.
2. Match trusted profile condition IDs or real configured biomarker relationships.
3. Add review-only recommendation rendering, provenance and persistence support.
4. Default the recommendation API to candidate_review; retain approved mode and shared-tool defaults.
5. Preserve approved escalation, inventory checks, zero-to-five limits and model-failure behavior.
6. Add synthetic tests and an example using the actual draft candidate CSV.
7. Run recommendation, ingestion and Med Bot compatibility checks.
8. Document configuration, trusted profile fields, limitations and verification results.

## Built

- Recommendation API and Python agent constructor default to candidate_review, reading the actual populated draft candidate CSV. `approved` explicitly selects the previous clinical-action path; shared knowledge-tool authorization checks remain unchanged. The original approved-protocol fixture/demo opts into approved mode explicitly.
- `health_agent/candidates.py` validates typed candidate/configuration data, personal condition matches, actual configured biomarker edges, original source references and explicit mission applicability. Unknown, rejected, inconsistent or unsupported records are excluded.
- `config/candidate_applicability.json` maps the nine current protocols to documented preflight, in-mission, microgravity, ISS or spacewalk-preparation context. No measurement-to-condition mappings were fabricated; the supplied metric mapping is empty because the current candidates lack those direct graph links.
- Returned cards remain `requires_review`, with provenance, condition/relation IDs, source links and explicit unresolved safety limitations. Condition-only matches do not acquire unrelated measurement IDs. Dose/frequency/duration fields are not promoted into start-treatment instructions.
- Existing approved urgency, authorization, inventory safeguards, persistence, stable IDs, idempotency, zero-to-five limits and model-failure behavior remain intact. Approved urgent escalation suppresses ordinary draft review cards.
- `health_agent/candidate_demo.py` and `examples/candidate_review_response.json` demonstrate one actual draft candidate using a clearly synthetic profile and an explicitly labeled selection stub, without fictional medical approvals.

## Verification

- Recommendation suite: **83 passed**, one optional live test skipped; existing Starlette/httpx deprecation warning remains.
- Ingestion suite: **110 passed**.
- Med Bot compatibility suite: **73 passed**, one optional live test skipped.
- Separate complete candidate-review turn against installed local **qwen3:4b-instruct**: one `requires_review` recommendation, `medical_review_required`, draft provenance intact. Only synthetic personal data and existing public CSV research were used.
- Actual-CSV synthetic-profile demo and persisted/retried API behavior passed; Python compilation passed.
- App build/typecheck/lint/tests were attempted. They cannot run because this checkout lacks installed frontend `tsc`, `eslint`, and `vitest` executables. No dependency installation or frontend edit was performed; no 360px UI check is claimed.

## Limits and operation

- Candidate matching is research relevance, not a diagnosis, validated treatment eligibility or production medical readiness. No medical approval was granted and no CSV status was changed.
- Real profiles without exact trusted `condition_ids` or genuine configured measurement links may still return zero cards. Known mission/environment identity and any source-specific phase/activity/gravity qualifiers must be provisioned through trusted administration.
- Restart the API to use its new default. For original clinical behavior set `HEALTH_PROTOCOL_MODE=approved`; candidate_review requires draft knowledge mode. Changed profile/configuration/mode requires a new assessment request ID because saved retries intentionally return their original result.
- Follow README.md and INTEGRATION.md for the profile fields, mode settings, provenance and review-only UI handling. Run `python -m health_agent.candidate_demo` for the isolated synthetic example.
- All edits in this step are confined to Recommendation_agent. Existing uncommitted DB-layer candidate work was preserved. Med Bot, ingestion implementation, CSV data, shared contracts and frontend source were not edited in this step. Work is on `lane/19-candidate-review`; no merge or push was performed.
