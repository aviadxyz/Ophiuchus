# Space Health Knowledge Ingestion

A bounded NASA/CSA ingestion and query application for Python 3.12+. It builds an evidence-backed CSV knowledge base, not a health monitoring agent. All extracted knowledge starts pending human review. Extraction approval means faithful source capture, never authorization of clinical use.

## Setup (PowerShell)

```powershell
python --version
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Extraction defaults to **local Ollama**, using its official Python SDK and native JSON-schema output: https://ollama.com/blog/structured-outputs . No Gemini or OpenAI credentials are needed. Install the Ollama desktop application from https://ollama.com/download/windows and start it. Download the configured model yourself (this is a separate, potentially large download):

```powershell
ollama pull qwen3:4b-instruct
```

The application never downloads models automatically. If the desktop server is not running, launch Ollama or use `ollama serve` in another terminal. Once the model is installed and documents cached, extraction needs no internet access. The app only permits loopback Ollama endpoints and rejects cloud-backed models; it never falls back to Gemini.

```dotenv
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:4b-instruct
OLLAMA_TEMPERATURE=0
OLLAMA_NUM_CTX=8192
OLLAMA_NUM_PREDICT=2048
OLLAMA_TIMEOUT_SECONDS=300
EXTRACTION_CHUNK_SIZE=2400
EXTRACTION_CHUNK_OVERLAP=200
```

If upgrading an existing installation, rerun `python -m pip install -r requirements.txt` and add these variables to `.env`. Existing sources, CSV schemas, extracted JSON and review decisions are preserved. Gemini remains optional: explicitly set `LLM_PROVIDER=gemini`, `GEMINI_API_KEY` and optionally `GEMINI_MODEL` (default `gemini-3.8-flash`). It uses the same Pydantic schema and verification flow: https://ai.google.dev/gemini-api/docs/structured-output . Never commit credentials.

This workspace was tested with Python 3.13.2 because Python 3.12 was not installed. It uses Python 3.12 compatible syntax. Use the existing `.venv` or a new virtual environment; the local Ollama SDK is installed in `.venv`. The earlier `.deps` directory is a historical dependency copy and need not be used.

## Commands

### Separate entity enrichment

Relationship extraction intentionally creates sparse entities. Enrichment fills supported missing attributes on **existing IDs**, separately from `extract`, using cached source text and local Ollama only. It does not recrawl, create entities or medical relationships, infer missing values from general knowledge, or approve clinical use. No cloud key is needed.

```powershell
# Default pilot: at most ten enrichment calls, plus the local health probe
python -m knowledge_ingestion enrich --max-requests 10 --resume
python -m knowledge_ingestion export --draft
python -m knowledge_ingestion report

# Review individual attribute additions
python -m knowledge_ingestion review --enrichment
python -m knowledge_ingestion export --approved-only

# Explicitly continue through all remaining matching cached passages
python -m knowledge_ingestion enrich --all --resume
python -m knowledge_ingestion export --draft
```

Plain `enrich` uses the ten-request limit. Repeating it processes another bounded batch, skipping completed jobs. `--all` removes that call limit and can take hours. Use `--entity-id`, `--entity-type` (plural CSV name such as `biomarkers`), or `--source-id` to narrow the run. Cached results do not consume the inference-call budget. `--resume` documents the always-enabled checkpoint behavior. The only new optional tuning setting is `ENRICHMENT_CHUNK_SIZE` (default 1600 characters); requests group at most five entities of the same type and cap generated output at 1024 tokens within the existing Ollama context and timeout settings.

Each proposed scalar field has its own exact supporting quote, existing entity ID and source/page/section location. Text values must be verbatim source phrases; supervision booleans require explicit required/not-required statements. Nulls and missing-value placeholders are omitted. Types, requested fields, IDs, source quotes and original-page matches are checked in Python. A conservative lexical check also requires the quote to name the entity/approved alias or share substantive entity words, so an unrelated intervention in the same passage does not automatically qualify. Ambiguous pronoun-only evidence may need an edited quote with more source context. Exact matching and lexical attribution cannot establish semantic or medical truth: **review the field and quote together**. Export revalidates each saved addition against its original job before filling a cell.

Enrichment checkpoints, rejected raw rows and original model responses are under `staging/enrichment/`; raw structured responses are cached under `cache/enrichment/`. Keys include source/text content, target IDs/fields, model/settings and schema/prompt versions. Changed inputs produce new jobs without deleting old results. `enrichment_report.json` records the current run, remaining jobs, rejections, examined versus unsearched fields and the last draft export's cell counts. A successful request may legitimately find no attributes. A partial failure never removes earlier successful checkpoints.

`export --draft` merges supported additions into blank entity cells and stores their evidence in the existing evidence tables. Attribute claims use `predicate=has_attribute`, a null object ID and JSON claim text containing the field and value. Existing nonempty values are retained. The default treatment status `unknown` can be filled only with an explicitly documented allowed status; approval is never inferred. Multiple competing additions leave an empty cell unresolved until a reviewer chooses one. Both source-backed assertions remain available for review. The exporter also coalesces nonempty attributes from existing duplicate entity rows instead of ignoring later rows.

Pending additions appear only in drafts; an approved export requires separate approval of the base entity and the individual field. Pending additions cannot silently become approved because the entity was already reviewed. `review --enrichment` supports approve/reject/skip, or an edited JSON file containing `entity_id`, `field`, `value`, `evidence_text`; edits are revalidated and remain pending. This workflow does not authorize treatment protocols or infer mission inventory.

Plain `python -m knowledge_ingestion extract` now defaults to the smaller relationship-first local extraction path. `EXTRACTION_MODE=relations_first` makes that preference explicit. Use `extract --generic` (or `EXTRACTION_MODE=generic`) only to request the older all-entity schema; the optional Gemini provider also requires that generic mode. Medical risk/evidence documents are prioritized; the general astronaut directory is excluded with a reason in extraction status. Changing the default does not remove existing generic extraction results. A timeout means the model did not respond within `OLLAMA_TIMEOUT_SECONDS`; smaller-schema mode reduces the requested work but cannot guarantee a particular inference time.

### HRR collection and relationship-first extraction

The original generic crawler and extraction commands remain available. The HRR workflow inventories the official Risk and Evidence indexes, active/inactive risk pages, direct report links, supplements, appendices and cross-cutting PDFs. It does not apply the generic 30-page limit or recurse through PDF references. Discovery uses actual links rather than guessed risk IDs. Shared documents retain all risk associations in `staging/sources/hrr_manifest.json`; document/research edges are kept there, separately from medical relations. Add any known explicit target URLs to `hrr_target_urls` in `config/sources.yaml`; targets absent from the index are identified explicitly.

```powershell
python -m knowledge_ingestion crawl --all-risks --include-evidence --resume
python -m knowledge_ingestion extract --provider ollama --relations-first --hrr-only --resume
python -m knowledge_ingestion export --draft
python -m knowledge_ingestion report
```

One risk and its associated reports:

```powershell
python -m knowledge_ingestion crawl --all-risks --include-evidence --risk-id 100 --resume
python -m knowledge_ingestion extract --provider ollama --relations-first --risk-id 100 --resume
```

Full workflow:

```powershell
python -m knowledge_ingestion run --all-risks --include-evidence --relations-first --provider ollama --resume
```

To test the relationship pass on one already cached source, use `--source-id SOURCE_ID --max-chunks 1` with `extract --relations-first --provider ollama`. Extraction always resumes successful checkpoints; `--resume` makes that intent explicit. Crawl `--resume` reuses a downloaded snapshot and reparses it without downloading unchanged cached files again. Omit `--resume` to refresh sources. Downloaded originals are content-versioned so an updated document does not delete its earlier bytes. The CLI returns failure when complete index discovery cannot be verified. It does not bypass unavailable robots policies or access blocks. A robots redirect is followed only on the same host; a final 5xx prevents crawling that host.

The smaller relationship schema asks for named subject/object pairs, predicate, exact quote, evidence status and population/context. Python maps those endpoints into existing entity/claim/relation schemas; no extra paid provider or competing database is used. Quotes must match both selected context and the original extracted page. No medical records are approved automatically. `contributes_to` is conservatively mapped to `may_contribute_to`; `indicated_by` and `may_improve` to `associated_with`, with the original predicate/direction preserved in claim limitations. Symmetric associations may be reordered to the existing table direction. `condition_treatment` uses the existing convention that its target is the countermeasure or investigated intervention for its source condition. A pair without an existing table is retained in rejection diagnostics instead of being reclassified merely to fill a CSV.

HTML risk sections preserve statements, HSRB knowledge and mitigation; original NASA ratings, mission durations and approval notes remain in cached sections with no invented high/medium/low mapping. PDF parsing retains page numbers and heading context; bibliography sections are excluded from extraction. This is heuristic section detection, not guaranteed scientific document understanding.

Local settings:

```dotenv
RELATION_CHUNK_SIZE=1600
RELATION_NUM_PREDICT=1024
HRR_MAX_CHUNKS_PER_DOCUMENT=3
```

The default selects up to three highest-priority chunks per document; **this is sampled extraction, not exhaustive extraction of every paragraph**. Every document is still inventoried/downloaded/parsed. Set `HRR_MAX_CHUNKS_PER_DOCUMENT=0` to extract all eligible non-bibliography chunks. `staging/extraction_status.json` reports selected versus eligible chunks for every processed source. Requests remain serial and the current Ollama model is preserved. Source-associated IDs, location, original text and rejected candidates are preserved in staging.

`report.json` now includes `relationship_diagnostics`: candidate, evidence-verified, entity-resolved, validated and staged counts; rejection reasons; counts by source and NASA risk; HRR coverage/failures; and draft versus approved export counts. Each export manifest includes counts for seen, duplicate, excluded-by-review and missing-dependency relations. Standard tests use a genuine NASA bone-risk excerpt with mocked local output and verify that the expected relation reaches `risk_condition.csv`. Production data comes only from real cached source documents, never those fixtures.

Run from the project directory:

```powershell
python -m knowledge_ingestion crawl --dry-run
python -m knowledge_ingestion crawl --max-depth 2 --max-pages 30
python -m knowledge_ingestion check-llm
python -m knowledge_ingestion extract
python -m knowledge_ingestion extract --max-chunks 1
python -m knowledge_ingestion review
python -m knowledge_ingestion export --draft
python -m knowledge_ingestion export --approved-only
python -m knowledge_ingestion report
python -m knowledge_ingestion run --max-depth 1 --max-pages 12
python -m pytest -q
```

`check-llm` checks local server reachability, installed model and a small structured JSON request. `extract` performs the same preflight check before processing documents. `run` crawls, extracts, exports draft CSVs and writes `report.json`. Missing servers/models produce explicit errors; no provider switch occurs. `extract` reuses cached documents, so changing providers does not require another crawl. Failed chunks can be retried by running `extract` again. An extraction failure produces a JSON diagnostic under `staging/errors/`.

If medical CSVs are empty, inspect `staging/extraction_status.json`. It records the current run time, project root, model, successful/failed/skipped chunk counts and current error. `extract --max-chunks 1` tests one pending chunk. Extraction stops if the local server becomes unavailable or a configured cloud provider reaches quota, and exits with a nonzero status. Export warns when no medical entities are staged; it cannot turn failed LLM requests into records. Old Gemini quota errors remain as historical diagnostics in `report.json`; the CLI displays the current extraction status separately.

## Local inference tuning and resume

Local output is validated per record: malformed rows and invalid entity references are rejected and preserved in staging with reasons and original output. Valid independent rows continue through the unchanged exact-evidence checks. References are never guessed or repaired; duplicate IDs are rejected together with dependent rows. Invalid JSON, invalid document metadata and truncated output still fail the chunk. Reports separate validation rejections from missing-evidence rejections.

Calls are serial. Each request sends a small sentence-aware text chunk and the existing extraction schema, with temperature 0, seed 0, configurable timeout, context size and output cap. Logs show source/chunk progress and durations. Small local models may omit facts or misinterpret research: syntactically valid JSON is not proof of medical accuracy. Exact quotes are still checked in Python and human review is still required.

Defaults use 2400 characters of source text, 8192 context tokens and at most 2048 output tokens. These are conservative starting settings, not a hardware guarantee or exact tokenizer calculation. Context also holds the schema and prompt. Smaller context windows can fail the estimated budget check; reduce source/output size or choose a context your RAM/VRAM can support. If output is truncated, reduce `EXTRACTION_CHUNK_SIZE` first or increase `OLLAMA_NUM_PREDICT` with enough remaining context. A timeout can require a longer `OLLAMA_TIMEOUT_SECONDS`, smaller model or smaller chunks. The schema retains every existing field; no automatic repair call invents missing data.

Successful structured results are cached atomically in `cache/extractions/`. Keys include input content hash, provider, model, schema version/hash, prompt version/hash and inference options. Source-linked staging checkpoints remain separate. Restarting with unchanged settings skips completed staging and reuses cached results; a changed model/prompt/schema creates a new version without deleting earlier work. Completed legacy Gemini extractions are reused when they validate under the current schema, have exact evidence and still match the current cached source. Reviewed copies remain authoritative for export. Invalid legacy files remain on disk for inspection rather than being deleted. Chunk records retain source ID/URL, original text, page, section and character location. Never run concurrent writers.

`--root PATH` and `--config PATH` are global options and go before the command. Configure URLs, allowed domains, depth, page limit and per-host delay in `config/sources.yaml`. Dry run is network-free and lists normalized seed URLs within the configured page budget; subpage discovery requires an actual crawl. Limits count attempted unique URLs, including failures.

Review displays an entire chunk's entities, claims, source identity and exact quotes. Approve or reject the displayed batch, skip it, quit, or provide an edited JSON file matching `raw_extraction`. Edits pass Pydantic and evidence verification again, and remain pending until reviewed. The original extraction remains unchanged under `staging/extracted`; decisions are stored in `staging/reviewed`.

Clinical authorization is an independent action for the responsible medical reviewer, after extraction approval:

```powershell
python -m knowledge_ingestion authorize-protocol PROTOCOL_ID --reviewer "Responsible medical reviewer"
python -m knowledge_ingestion export --approved-only
```

The command displays the candidate and requires the reviewer to explicitly type `AUTHORIZE CLINICAL USE`. It records their supplied identity and UTC timestamp. This local tool records an attestation; it does not authenticate medical credentials. Extraction review never invokes this command. Mission inventory always starts empty and is not inferred from articles.

## Architecture and provenance

1. `crawler/` reads the five configured URLs, checks robots.txt, bounds discovery to article links on allowlisted domains, scores links by health relevance, and records fetch successes and failures. Each redirect is checked against robots and domain rules before following. It respects configured delay and robots crawl delay, retries transport and transient HTTP failures, and does not bypass blocks. Before expanding the crawl, review applicable site terms; robots checks do not replace terms review.
2. `parsers/` removes navigation from HTML using BeautifulSoup and parses PDF pages with PyMuPDF. `cache/` retains raw response bodies and extracted JSON. Content hashes identify duplicate documents. Overlapping chunks preserve source ID, page number and character offsets.
3. `extraction/` constrains model output with Pydantic: typed entities, claims, studied populations, monitoring and interventions. Research classification remains distinct from operational guidance. Unsupported attributes remain null; treatment approval cannot be emitted by the model. Source instructions are treated as untrusted content.
4. `validation/` checks exact excerpts against the relevant cached chunk after whitespace normalization. Records with missing excerpts or unverified endpoints are rejected and logged in staging. Entity attributes also receive evidence-linked `described_by` claims. Exact matching establishes provenance, not scientific validity or semantic entailment: reviewers must check every field against its quote.
5. `normalization/` persists deterministic IDs based on entity type and normalized name. Only exact matches and explicitly reviewed aliases merge concepts. Extracted aliases are stored for review but do not automatically merge entities. Uncertain synonyms stay separate. Evidence, claim and relation IDs use stable hashes; conflicting statements remain separate claims.
6. `pipeline.py` builds staged rows, applies review state, filters dependencies and writes UTF-8 CSVs through temporary files and atomic replacement. Each CSV is atomic; the whole directory is not a transactional snapshot. Run export and ingestion serially and let export finish before loading runtime queries.
7. `queries/` reads approved exports by default and attaches claims, evidence and sources. Draft exports are rejected as a runtime root.

## CSV schemas

The complete column definitions live in `knowledge_ingestion/storage/__init__.py` (`SCHEMAS`). All requested tables are generated under both `DB/draft/` and `DB/approved/`, preserving the requested subdirectories. Blank CSV cells represent null; no missing numeric ranges, doses, or frequencies are invented.

| Tables | Structure |
| --- | --- |
| `entities/` | Nine entity tables, typed stable primary ID, canonical name, documented attributes, review status |
| `relations/` | Nine typed edge tables, relation ID, source/target IDs, predicate, claim ID, review status |
| `evidence/evidence` | Source ID and URL, chunk/page/character location, exact quote, extraction method, verification and review statuses |
| `evidence/knowledge_claims` | Subject/predicate/object, claim text, source/evidence foreign keys, evidence status, population, environment, limitations, review status |
| `metadata/` | Source fetch manifest and classification; source-type, risk-category and treatment-type vocabularies |
| `monitoring/` | Biomarker/condition/environment references, documented method and frequency, limitations, source/evidence IDs |
| `protocols/` | Candidate actions with documented conditions, dose, frequency and duration; separately authorized clinical records |
| `inventory/` | Empty mission-specific quantity, expiry, storage and availability template |
| `aliases/` | One alias per row with entity/type/source foreign keys and review status |

IDs are scalar foreign keys; no cells contain lists of unrelated IDs. Descriptive claim text can include a JSON object documenting the entity assertion, while foreign keys remain separate columns. Source metadata is retained even on failed fetches. Approved exports include only reviewed medical rows with available dependencies. Inventory and vocabulary templates are not medical claims.

## Query API

```python
from knowledge_ingestion.queries import KnowledgeBase
kb = KnowledgeBase()  # DB/approved
kb.get_environment_risks(environment_id)
kb.get_condition_details(condition_id)
kb.get_related_biomarkers(condition_id)
kb.get_preventive_actions(condition_id)
kb.get_treatment_evidence(treatment_id)
kb.get_supporting_evidence(claim_id)
kb.search_medical_knowledge("bone")
kb.get_approved_protocols(condition_id)
```

These functions are also exported at module level. Results are dictionaries/lists suitable for JSON encoding. Related actions retain `investigated_for` versus `countermeasure_for` and other predicates; callers must preserve that distinction. They are knowledge retrieval results, not medical recommendations. `get_approved_protocols` additionally requires the separate reviewer authorization fields.

## Validation and recorded run

Offline pytest tests use a local HTML fixture, a locally generated PDF fixture and a mock structured provider. They exercise the real staging/export flow without network access or paid calls; temporary test output never enters production DB.

The initial real-source run attempted 12 URLs and cached 11 HTML documents. Later crawling reached 30 successful URLs. After configuring local Ollama, genuine source-backed entity assertions were staged. The HRR upgrade subsequently demonstrated one validated relationship on the cached NASA bone-risk page and exported it to `DB/draft/relations/condition_treatment.csv`. Full HRR crawling is currently blocked by its robots endpoint redirecting to an HTTP 500 error page. See `HRR_UPGRADE_REPORT.md` for exact counts, verification and limitations. No fixture records or fabricated source content were inserted into production.

Known limits: no OCR for scanned PDFs; heuristic source link prioritization; no fuzzy semantic merges; no automated assessment of medical truth or clinical safety; no concurrent writers. Source classification and study populations depend on model output and review. The hackathon MVP retains a single discovery parent per URL and one source classification from the last exported chunk for each document.

## Populate draft protocol candidates from existing CSVs

```powershell
python -m knowledge_ingestion.protocol_candidates --root .          # Read-only dry run
python -m knowledge_ingestion.protocol_candidates --root . --apply  # Stage pending candidates and export draft
```

This offline command uses the explicit selection in `config/protocol_candidates.json`, validates existing relation/claim/evidence/source joins and original source chunks, and copies only documented wording. It does not call an LLM, crawl, approve research or authorize treatment. Generated staging records survive subsequent draft exports. All unrelated draft tables and approved exports are checked for preservation. Existing reviewed overrides are respected.

See `PROTOCOL_CANDIDATES_REPORT.md` and `PROTOCOL_CANDIDATES_REPORT.json` for the nine included practices, 21 excluded relationships, source quotations, pending status and missing fields. These candidates do not bypass the recommendation agent's approved-protocol and governance requirements.
