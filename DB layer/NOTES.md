# Candidate protocol implementation plan
1. Add a curated relation/evidence selection with verbatim documented fields.
2. Add a dry-run/apply command using existing schemas and dependencies.
3. Validate joins, review status, original chunks and exact quotations.
4. Stage only pending candidates; preserve all existing source records.
5. Rehearse the existing exporter in isolation and reject unrelated changes.
6. Generate candidates and an accepted/excluded provenance audit.
7. Test repeatability, review preservation, and approved-action exclusion.
8. Run ingestion and recommendation regression suites and document results.

## Result

Nine real-source research candidates were populated in the draft candidate CSV from 30 existing condition-treatment relationships. Twenty-one relationships were excluded. All new candidates remain pending; approved exports and the clinical authorization registry are unchanged. No crawler, extraction provider, existing ingestion implementation, recommendation agent, Med Bot or frontend source was changed.

The command is `python -m knowledge_ingestion.protocol_candidates --root . --apply` from this folder. Omitting `--apply` performs a read-only dry run. `PROTOCOL_CANDIDATES_REPORT.json` records complete evidence, original IDs, missing fields and exclusion reasons. See `PROTOCOL_CANDIDATES_REPORT.md` for the human-readable result and limitations.

Candidates survive normal draft export because they are separate staging batches. This does not create clinical recommendations or medical authorization. No synthetic approval records or fabricated source content were inserted.

## Verification

- 22 new candidate-population tests passed, including the recommendation agent's real approved-protocol filter rejecting pending candidates.
- All 88 existing ingestion tests passed (109 total in the full run before the final additional isolation test, which passed in the focused 22-test run).
- Recommendation agent: 37 passed, one optional live-model test skipped; existing dependency deprecation warning remains.
- Live population was applied twice: nine candidates on each run, zero additional staging batches on the second run, no duplicate rows.
- Isolated double export verified identical CSV content; all unrelated draft tables, approved exports and clinical authorization records were preserved.
- Python compilation passed. No new dependencies, network retrieval or model calls were needed.
- Work is on `lane/18-draft-protocol-candidates`; no merge or push was performed.
