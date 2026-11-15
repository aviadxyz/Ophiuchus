# HRR and relationship-first upgrade report

Date: November 14, 2026.

## Result and remaining blocker

The existing application was extended, not replaced. A real local Ollama run on the previously cached NASA bone-risk page produced **three relationship candidates**. **One relationship passed validation and was exported to `DB/draft/relations/condition_treatment.csv`**. Its endpoints are bone density loss and resistive exercise, and its evidence is an exact excerpt from the NASA page. The other two candidates were retained with reasons: one missing exact quote, one endpoint-type pair unsupported by the existing CSV tables. Nothing was automatically medically approved.

**Full HRR collection and extraction remain blocked by NASA's robots endpoint.** Both index attempts encountered this redirect chain:

```text
https://humanresearchroadmap.nasa.gov/robots.txt
  -> HTTP 302 /error/?aspxerrorpath=/robots.txt
  -> HTTP 500
```

The crawler fails closed when it cannot verify that policy. No index contents, risk pages, reports or URLs were invented to compensate. The HRR-only extraction command returned a nonzero exit status and explicitly reported that no HRR documents were available. The successful demonstration used the existing official NASA bone-risk page; it is not a claim that HRR reports were ingested.

## Diagnosis before changes

The twelve pre-upgrade staged chunks contained **zero raw relationship claims**, despite having entity rows. The previous local schema requested all entity types, monitoring, interventions and relationships simultaneously. Thus, no edges were reaching the exporter. Inspection also found that a valid claim with endpoint types not represented by one of the nine relation tables could be omitted from relation output without an explicit diagnostic. The draft exporter itself already retained pending relations with valid dependencies; this was not a draft-versus-approved viewing issue.

## Recorded live results

| Metric | Result |
| --- | ---: |
| Previously cached successful source URLs | 30 |
| HRR index fetches blocked by robots-policy failure | 2 |
| HRR risks discovered by the automated crawler | 0 — discovery blocked |
| HRR evidence documents discovered/downloaded/parsed | 0 — discovery blocked |
| Completed staged chunks, including prior work | 13 |
| Source documents with staged extraction | 6 |
| Unique entities in the cumulative database | 83 |
| Claims awaiting review, including entity assertions | 88 |
| New relationship candidates in the live demonstration | 3 |
| Demonstration candidates with verified quotes | 2 |
| Candidates matching an existing table and staged | 1 |
| Relationships actually exported to draft | 1 |
| `condition_treatment.csv` rows | 1 |
| Other relation CSV rows | 0 |
| Approved clinical protocols created | 0 |

An independent read-only web lookup displayed the current official index, but the automated crawler did not download its entries because policy verification failed. Its displayed count was not substituted for actual manifest coverage. No pre-existing explicit list of 25 target URLs was found; `hrr_target_urls` is available for an explicit list if supplied later.

The accepted row's entity, claim and evidence foreign keys and its exact quote were checked against the original cached NASA text. See `staging/runs/hrr_relationship_csv_audit.json`. The source is https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/ . Its existing link to HRR risk ID 77 establishes the diagnostic risk association; no ID was guessed. Review status remains pending. A resume check skipped the completed passage with zero new extraction calls and retained exactly one exported relationship.

## Implementation

- `crawler/hrr.py`: dynamic risk/index discovery, inactive status, explicit linked pagination, associated reports, supplementary/appendix/cross-cutting inventory, shared document associations, structural gap/task links, finite scope, download checkpoints and versioned original files. Generic page limits do not truncate this workflow.
- `crawler/__init__.py`: same-host robots redirects, cached policy failures and safe URL-space normalization. Existing generic crawl commands remain supported.
- `parsers/structured.py`: deterministic HTML risk sections, original rating/duration/approval text, PDF headings and page numbers, bibliography exclusion. Full original PDFs remain cached.
- `extraction/relationships.py`: compact named-endpoint schema, conservative predicate mappings, exact evidence verification and conversion into existing entity/claim/relation models. Unsupported pairs remain in diagnostics instead of being relabeled to fill tables.
- `extraction/selection.py`: configurable section-aware context selection, with eligible/selected counts. The default selects up to three chunks per document; setting `HRR_MAX_CHUNKS_PER_DOCUMENT=0` selects all eligible chunks.
- `extraction/ollama_provider.py` and `extraction/cache.py`: reuse the current local model and native structured output, bounded output, serial inference, mode-specific schema/prompt hashes, cached results and resume. No external LLM was used.
- `pipeline.py`: connects relationship extraction to the existing resolver, source/page evidence checks, staging and CSV writer; adds explicit relation rejection/export diagnostics and source/risk filters.
- `diagnostics.py`: counts candidates, verified quotes, resolved endpoints, validation, staging and export; reports by source, evidence document, NASA risk and CSV. Includes coverage and export failures.
- `storage/__init__.py`: adds atomic binary cache writes without changing any CSV columns.
- `__main__.py`, `config/sources.yaml`, `.env.example`, `README.md`: new CLI options, explicit targets, settings and reproduction instructions.
- `tests/test_hrr.py`, HRR fixtures, the genuine NASA excerpt fixture, and `tests/test_ollama.py`: new offline regression and end-to-end coverage.

Paths above are relative to `knowledge_ingestion/` where applicable. Existing normalization, review, inventory, approved-protocol authorization and runtime query interfaces are preserved. All original staging/review records and stable IDs remain in place. A snapshot of all 58 existing draft/approved CSV files was saved under `DB/snapshots/before_hrr_20261114_151720/` before updated exports.

## Tests and limitations

**49 pytest tests passed.** Tests cover all risk entries in a fixture, inactive risk status, multiple/shared reports, PDF download caching, scope limits, structured HTML/PDF sections, bibliography exclusion, source-grounded relationship parsing, endpoint creation/deduplication, staging, actual CSV output, approved exclusion, repeat processing, context budgeting and interruption recovery. Standard tests use mocked inference and no network or live model.

The new discovery implementation was exercised against fixtures; live HRR HTML layout and full report ingestion remain unverified because of the robots failure. Section/heading recognition is heuristic. Exact quote matching proves provenance, not medical validity. Human review is required. Full-table population cannot be claimed from this one-passage demonstration, and unsupported relationship types remain empty.

## Retry full HRR workflow when access is available

```powershell
python -m knowledge_ingestion crawl --all-risks --include-evidence --resume
python -m knowledge_ingestion extract --provider ollama --relations-first --hrr-only --resume
python -m knowledge_ingestion export --draft
python -m knowledge_ingestion report
```

For every eligible passage rather than the default three-chunk sample per document, set `HRR_MAX_CHUNKS_PER_DOCUMENT=0` in `.env` before extraction. For one risk, add `--risk-id 100` to crawl and extraction. The full combined command is documented in README. Existing cached generic sources can independently use `extract --provider ollama --relations-first --source-id SOURCE_ID`; this does not claim HRR coverage.
