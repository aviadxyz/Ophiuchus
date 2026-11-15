# Initial ingestion report

Provider update: subsequent extraction now uses Gemini (`GEMINI_API_KEY` and optional `GEMINI_MODEL`). The initial run details below are historical and have not been replaced with a new API run.

Run date: November 14, 2026. Command: `python -m knowledge_ingestion run --max-depth 1 --max-pages 12`.

| Metric | Result |
| --- | ---: |
| Unique URLs attempted | 12 |
| Successfully fetched and parsed documents | 11 |
| Failed URLs | 1 |
| Documents processed by LLM | 0 |
| Medical entities extracted | 0 |
| Medical relations extracted | 0 |
| Claims awaiting review | 0 |
| Records rejected for missing evidence | 0 |

The five official seed URLs were attempted. All three NASA seeds and the CSA science article succeeded, along with seven discovered NASA pages. Raw response bodies and normalized article text are cached under `cache/`. The precise URL list and outcomes are in `DB/draft/metadata/sources.csv` and `staging/sources/manifest.json`.

The CSA radiation source failed with `[WinError 10054] An existing connection was forcibly closed by the remote host`. Its contents were not substituted. It remains recorded as failed.

`OPENAI_API_KEY` was unavailable. Consequently, the real LLM extraction step could not run. The draft database contains populated source metadata, controlled source/treatment vocabularies, and all medical CSV headers; it contains no fabricated medical rows. The approved database contains no reviewed medical knowledge. Inventory is empty. After configuring a key, run `python -m knowledge_ingestion extract` and `python -m knowledge_ingestion export --draft` to process the cached documents.

Validation: **10 offline pytest tests passed**, including a mocked end-to-end extraction, review-state exports, repeat ingestion, quote rejection, references, conflicting statements, HTML/PDF parsing, URL/robots/redirect controls, monitoring null fields, and separate clinical protocol authorization. Test artifacts were written only in pytest temporary directories.

Python 3.13.2 was available; Python 3.12 was not installed, so execution on 3.12 was not verified. Paid OpenAI extraction was not verified. Exact quote verification establishes source provenance and still requires human assessment of whether each quote supports the extracted assertion.
