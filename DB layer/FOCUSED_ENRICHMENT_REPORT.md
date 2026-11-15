# Monitoring and microbiome enrichment report

All changes are confined to `DB layer/`. Original CSV byte prefixes, headers, IDs, row order, review statuses, approved data and snapshots are preserved. No pre-existing files were deleted. All 401 outside source-file hashes matched the baseline.

## Actual additions

| Draft CSV | New pending rows |
|---|---|
| `DB/draft/entities/biomarkers.csv` | 2 |
| `DB/draft/entities/conditions.csv` | 1 |
| `DB/draft/entities/microbiome.csv` | 1 |
| `DB/draft/entities/risk_factors.csv` | 1 |
| `DB/draft/evidence/evidence.csv` | 1 |
| `DB/draft/evidence/knowledge_claims.csv` | 5 |
| `DB/draft/monitoring/monitoring_guidance.csv` | 1 |
| `DB/draft/relations/condition_biomarker.csv` | 1 |
| `DB/draft/relations/risk_microbiome.csv` | 1 |

Total: **14 pending rows**. Newly added biomarkers are blood pressure and bone density. New relationships are the NASA-described blood-pressure/fainting association and a gut-microbiome association with an explicitly stated crew health risk. The latter is stored in `risk_microbiome`, not misclassified as a condition relation.

One monitoring record captures bone scans. Its before/after-spaceflight study schedule is preserved in claim metadata; `recommended_frequency` remains empty. No medical ranges, monitoring thresholds, wearable capabilities, treatments or protocol authorizations were invented.

## Extraction provenance and limitations

The final automatic pass covered **40 eligible cached NASA passage/focus jobs**, with all completed checkpoints reused on the repeat run. Strict evidence, type and relationship checks rejected the automatic relationship proposals; that final automatic pass added no relationships. The three exact-source proposals in `config/focused_passages.json` were separately checked by the configured local Ollama model, passed the normal typed/source validators, and were appended pending review. This is explicitly model-assisted source-span curation, not a claim that broad automatic extraction succeeded. Raw model outputs and rejected candidates are retained.

HRR Evidence and Risks discovery remained blocked because its robots endpoint returned HTTP 500. There were no cached HRR evidence PDFs to pilot; cached NASA risk/HRP summaries were used instead. No restriction was bypassed and no recursive citation downloads or broad recrawl occurred. Taxonomic/diversity/abundance detail, new condition–microbiome relations and risk–biomarker relations remain coverage gaps; none were fabricated.

## Data-quality review required

**2 early pilot batches** failed later classification/scope guards. Only their six task-created CSV rows were restored under the task's unintended-change restoration rule; every original record and later valid addition was preserved. Raw output, staging and restoration journals remain available in quarantine, and resume/export cannot reintroduce these batches. There are no remaining flagged annotations from these pilots in the live CSVs. See `reports/focused_enrichment/final.json` and `staging/focused/quarantine.json`.

**5 pre-existing biomarker classification issues** were reported (anatomical structures or microbial community concepts stored as biomarkers). These old rows were not corrected, moved or deleted.

## Verification

- 134 DB-layer tests passed; one optional real-model test was skipped in the offline suite. Real local-model runs and source-support checks were performed separately.
- All old CSVs retained their complete original byte prefixes; all new rows have pending review status.
- Full resume reused all 40 jobs without re-extraction. Reapplying all three source-span transactions and running normal draft export left every CSV hash identical.
- Interrupted append recovery, duplicate suppression, foreign keys, classification, source quoting, one-writer exclusion and transient Windows reader-lock retry were tested.
- Tests used fresh temporary directories inside DB layer, bytecode writing disabled, and pytest cache disabled. Test artifacts are retained and ignored by the local .gitignore.
- Application builds/tests were not run because they could write outside the user-authorized folder. No agent, Med Bot, UI, external API, authentication or root configuration was changed.

## Files and operation

Core additions are `knowledge_ingestion/focused/` (typed schemas, local extraction, validation, append journals, locking, diagnostics and exact-span proposals), plus tests and `config/focused_passages.json`. The existing CLI, private local transport and draft-export dispatch gained backward-compatible focused branches. Existing behavior is preserved unless focused mode or the append-preservation marker is present. `README.md` documents commands and storage. The full changed/new file list is `reports/focused_enrichment/change_scope.json`.

`baseline.json`, `final.json`, `idempotency.json`, `hrr_access.json`, `exact_span_proposals.json`, and per-run reports are inside `reports/focused_enrichment/`. Cache, staged records, checkpoints and transactions remain inside their existing DB-layer tree. The old general export manifest is not rebuilt; the focused final report records current additions.

All data remains research awaiting professional review. The rest of the application was intentionally left untouched.
