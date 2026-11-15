# Entity-enrichment implementation and pilot

Implemented a separate cached-source enrichment pass using local Ollama. Existing schemas, canonical IDs, source documents, review decisions and relationship records are preserved.

## Recorded results

- Local enrichment requests: **10**, all succeeded; no external LLM calls.
- Pilot duration: **15 minutes 54 seconds**, plus the subsequent offline audit/export.
- Model proposals: **63**.
- Source-backed attribute claims exported after revalidation: **14**, all pending review.
- Unsupported model suggestions rejected initially: **28**; another **4** saved proposals were excluded by the entity-attribution audit. Missing/null suggestions were omitted.
- Newly filled cells from enrichment: **14**.
- Additional empty cells recovered from previously staged entity rows by fixing export merging: **1**.
- Existing entity IDs preserved: **170**.
- Existing relationship IDs/rows preserved: **54**.
- Nonempty baseline values changed: **0**.
- Human approvals granted: **0**.
- Current queued jobs remaining: **247**. All **10** completed pilot checkpoints match the current queue and will be reused. No extra model calls were made for audit, revalidation or export.

The pilot selected treatment-related passages first. It does not establish that biomarkers, conditions or other unexamined entities lack attributes. Unsupported supervision values and non-verbatim values were rejected. Attribution checks also caught a training statement assigned to a different intervention; such records are retained for inspection and excluded from CSV output. Lexical matching and exact quotes do not prove semantic or medical validity, so every addition still requires human review.

## Changes

- Added the enrichment catalog, focused Pydantic output model, field/source validation, job inventory, caches and checkpoints under `knowledge_ingestion/enrichment/`.
- Reused the current local Ollama model, with serial requests, at most five existing entities per request, configurable 1600-character passages and a 1024-token output cap.
- Added `enrich`, field-level `review --enrichment`, conservative export overlays and existing-row blank-cell coalescing.
- Added one evidence-linked `has_attribute` claim per addition using the existing CSV columns. Conflicting values are preserved separately; existing values are never overwritten.
- Approved exports require both an approved base entity and an approved attribute. Pending additions remain outside runtime queries. No clinical protocols or mission inventory are created.

## Verification

**88 offline tests passed**, including biomarker units/methods/frequency/device extraction, wrong-entity attribution, explicit supervision booleans, field approval isolation, source quote validation, export coalescing, conflicts, cache invalidation and interruption recovery. A repeated production draft export produced byte-identical CSV contents, confirming no duplicate additions or unstable field merging.

Every exported enrichment claim was checked against its original cached source/page. The baseline comparison confirmed stable entity IDs, unchanged nonempty values and all 54 existing relationships. Detailed results are in `staging/enrichment/pilot_audit.json`; request/rejection/remaining-work diagnostics are in `enrichment_report.json`. The pre-enrichment CSV snapshot is `DB\snapshots\before_enrichment_20261114_193440`.

## Continue

```powershell
# Another bounded batch of up to ten new requests
python -m knowledge_ingestion enrich --resume
python -m knowledge_ingestion export --draft

# Review field additions before approved export
python -m knowledge_ingestion review --enrichment
python -m knowledge_ingestion export --approved-only

# Explicitly process all remaining relevant cached passages; may take hours
python -m knowledge_ingestion enrich --all --resume
```

Use `--entity-type biomarkers`, `--entity-id`, or `--source-id` for targeted runs. Plain `extract` remains separate and does not perform enrichment. A full cached pass is not being claimed from this pilot.
