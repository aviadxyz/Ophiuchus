# Draft protocol candidate population

The draft candidate-protocol table now contains **9 pending candidates**, derived from the existing CSV knowledge records. Of 30 condition-treatment relationships examined, **21 were excluded**. The complete provenance audit is in `PROTOCOL_CANDIDATES_REPORT.json`.

These are literature-derived candidate records for review, not approved care instructions. Exact-match evidence establishes where text came from; it does not validate medical truth, the extracted condition association, or individual applicability.

## Included practices

| Documented practice | Protocol ID | Qualification preserved |
|---|---|---|
| Team-building exercises | `protocol_d66679d9bb707e52af94` | Pre-mission practice |
| Training in high-/low-pressure environments | `protocol_cb33d7de4d12833a59af` | Pre-mission training |
| Resistive exercise | `protocol_ba6f6133aeb353fe3f75` | Microgravity context; bone-scan timing is not assigned to exercise |
| Oxygen breathing before a spacewalk | `protocol_805036b8c4327dec7e05` | No concentration, dose, duration or administration permission supplied |
| Exercise during a mission | `protocol_4a0ac4cd039b20a57999` | General documented mission practice |
| Resistance training and aerobic exercise | `protocol_0e36a7999e9570c2f4bb` | Cited ISS practice and reported timing, not a personalized schedule |
| Keeping a journal | `protocol_18933cb62234938546bb` | General self-care; not an approved anxiety treatment |
| Simulator training | `protocol_93fb50df7e4b6d35e8cd` | Reported prelaunch training average, not a required clinical duration |
| LED light-cycle simulation | `protocol_73dd2a0c0981099ec8c1` | No intensity, spectrum or exposure schedule supplied |

The CSV's `indication` contains source wording rather than a newly written clinical instruction. Only explicitly documented field spans are copied. Undocumented contraindications, dosages and other details remain blank. A blank contraindication field never means that an intervention is safe for everyone.

Condition associations are preserved from the existing pending relationships and still need semantic review. In particular, a source describing journaling as self-care does not establish treatment efficacy for the associated anxiety entity. Broad exercise and specific exercise records remain distinct because they have different existing condition/evidence references.

## Excluded records

The audit covers all 21 exclusions individually. These include all six `investigated_for` relationships, plus research/development statements mislabeled as countermeasures, broad program goals, article headings, source text that does not substantiate the named intervention, and engineering/device capabilities.

Investigational diet interventions, suit pressure technologies, vitamin supplementation, medication research and simulated-radiation studies were not promoted into candidate clinical actions. No missing medical instructions were filled from an LLM or general knowledge.

## Reproduce and review

From `DB layer`, using the existing Python environment:

```powershell
& '..\Recommendation_agent\.venv\Scripts\python.exe' -m knowledge_ingestion.protocol_candidates --root .
& '..\Recommendation_agent\.venv\Scripts\python.exe' -m knowledge_ingestion.protocol_candidates --root . --apply
```

The first command is a dry run; the second writes pending staging batches, invokes the existing draft exporter, and writes the JSON audit. The curated selection is `config/protocol_candidates.json`. Changes in its source evidence invalidate that candidate until the selection is explicitly revisited. New relationships are excluded by default until curated.

The command first rehearses export in a temporary staging copy, checks all unrelated draft files, preserves existing candidates, and verifies a second CSV export. It aborts before live mutation if unrelated export drift is found. Existing generated files and review overrides are preserved rather than silently overwritten. Run without concurrent ingestion/review writers.

Generated staging records use the existing extraction/intervention schema and can be displayed by the existing batch-review tooling. Human extraction review remains separate from clinical authorization; source/entity/evidence dependencies must also be reviewed for approved exports. No review command or clinical-authorization command was run during population.

The recommendation agent still requires an applicable approved protocol, reviewed supporting records and configured eligibility/risk rules. This population task changes none of those safeguards. Both approved-protocol CSVs remain empty; draft candidates alone cannot yield an approved medical recommendation.

## Verification

The 22 new tests passed, alongside all 88 existing ingestion tests and 37 recommendation-agent tests. A dedicated integration test supplies a matching synthetic policy and confirms that pending draft candidates are still excluded from the recommendation agent's approved-action path. Repeating real population retained nine rows and created no additional staging batches. Only the draft candidate CSV and its export-count manifest changed among exported database files.
