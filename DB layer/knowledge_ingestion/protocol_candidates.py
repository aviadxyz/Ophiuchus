"""Offline, curated draft candidates. No inference, review approval or clinical authorization.

Run `python -m knowledge_ingestion.protocol_candidates --root .` for a dry run;
add --apply to stage candidates and use the existing draft exporter.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
from urllib.parse import urlsplit

from knowledge_ingestion.extraction import Extraction, Intervention
from knowledge_ingestion.pipeline import batches, export
from knowledge_ingestion.storage import SCHEMAS, atomic_json, atomic_bytes, read_json, stable_id
from knowledge_ingestion.validation import verify_evidence

TABLE = 'protocols/candidate_protocols'
GENERATOR = 'draft-protocol-candidates-v1'
DOCUMENTED_FIELDS = ('indication', 'required_conditions', 'contraindications', 'dosage', 'frequency', 'duration')
LIMITATIONS = [
    'Pending research-derived candidate only; no clinical authorization or individualized recommendation.',
    'Condition association is copied from an unreviewed relationship, not independently established as a diagnosis or treatment indication.',
    'Blank fields mean undocumented, not no contraindications or unrestricted applicability.',
]


def rows(root, table):
    path = root/'DB/draft'/(table+'.csv')
    if not path.exists():
        return []
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != SCHEMAS[table].split():
            raise ValueError('Unexpected draft schema: ' + table)
        return list(reader)


def index(root, table):
    key = SCHEMAS[table].split()[0]
    result = {}
    for row in rows(root, table):
        if not row[key] or row[key] in result:
            raise ValueError('Missing or duplicate identifier in ' + table)
        result[row[key]] = row
    return result


def _validate(relation, selection, catalog, origins, manifest):
    if relation['relationship_type'] != 'countermeasure_for':
        raise ValueError('Investigational or unsupported relationship type')
    condition = catalog['conditions'].get(relation['source_entity_id'])
    treatment = catalog['treatments'].get(relation['target_entity_id'])
    claim = catalog['claims'].get(relation['claim_id'])
    if not condition or not treatment or not claim:
        raise ValueError('Missing condition, treatment or claim reference')
    if (claim['subject_entity_id'], claim['object_entity_id'], claim['predicate']) != (relation['source_entity_id'], relation['target_entity_id'], relation['relationship_type']):
        raise ValueError('Claim endpoints or predicate do not match relationship')
    evidence = catalog['evidence'].get(claim['evidence_id'])
    source = catalog['sources'].get(claim['source_id'])
    if not evidence or not source or evidence['source_id'] != source['source_id']:
        raise ValueError('Missing or inconsistent evidence/source reference')
    for record in (relation, condition, treatment, claim, evidence, source):
        if record.get('review_status') not in ('pending', 'approved'):
            raise ValueError('Dependency has rejected or unknown review status')
    if claim.get('evidence_status') == 'investigational' or treatment.get('evidence_status') == 'investigational':
        raise ValueError('Dependency is explicitly investigational')
    if evidence['verification_status'] != 'exact_match':
        raise ValueError('Evidence lacks exact-match verification')
    if source.get('fetch_status') != 'success':
        raise ValueError('Source was not successfully fetched')
    if not source.get('source_url') or source['source_url'] != evidence['source_url'] or urlsplit(source['source_url']).scheme not in ('https', 'http'):
        raise ValueError('Missing or inconsistent source URL')
    if not manifest.get(source['source_id']) or manifest[source['source_id']].get('source_url') != source['source_url']:
        raise ValueError('Source is missing or inconsistent in the staging manifest')
    quote = evidence['evidence_text']
    if quote != selection['expected_evidence']:
        raise ValueError('Evidence changed; explicit curation must be revisited')
    origin = next((batch for batch in origins.get((source['source_id'], evidence['chunk_id']), [])
                   if verify_evidence(quote, batch['chunk']['text'])), None)
    if not origin:
        raise ValueError('Supporting quote cannot be verified in an existing source chunk')
    fields = dict(selection.get('fields', {}))
    if set(fields) - set(DOCUMENTED_FIELDS):
        raise ValueError('Unsupported candidate field')
    fields.setdefault('indication', quote)
    for field, value in fields.items():
        if not isinstance(value, str) or not value or value not in quote:
            raise ValueError('Candidate field is not a verbatim evidence span: ' + field)
    return condition, treatment, claim, evidence, source, origin, fields


def build_candidates(root, specification=None):
    root = Path(root).resolve()
    specification = specification or read_json(root/'config/protocol_candidates.json')
    if not specification or not specification.get('version'):
        raise ValueError('Versioned candidate curation is required')
    selections = {}
    for selection in specification['candidates']:
        identifier = selection['relation_id']
        if identifier in selections:
            raise ValueError('Duplicate curated relation ID')
        selections[identifier] = selection
    catalog = {name:index(root, table) for name, table in (
        ('conditions','entities/conditions'), ('treatments','entities/treatments'),
        ('claims','evidence/knowledge_claims'), ('evidence','evidence/evidence'), ('sources','metadata/sources'))}
    manifest = read_json(root/'staging/sources/manifest.json', {})
    origins = {}
    for _, batch in batches(root):
        if batch.get('candidate_generation', {}).get('generator') == GENERATOR:
            continue
        chunk = batch.get('chunk', {})
        origins.setdefault((batch['source_id'], chunk.get('chunk_id')), []).append(batch)
    generated, accepted, excluded, seen = [], [], [], set()
    existing_by_content = {
        (row['related_condition_id'], row['treatment_id'], row['evidence_id'], tuple(row[field] for field in DOCUMENTED_FIELDS)):row
        for row in rows(root, TABLE)
    }
    relations = rows(root, 'relations/condition_treatment')
    relation_ids = {r['relation_id'] for r in relations}
    for relation in relations:
        identifier = relation['relation_id']
        selection = selections.get(identifier)
        base = {'relation_id':identifier, 'claim_id':relation['claim_id'],
                'related_condition_id':relation['source_entity_id'], 'treatment_id':relation['target_entity_id']}
        if relation['relationship_type'] == 'investigated_for':
            excluded.append({**base, 'reason':'Investigational-only relationship; excluded by selected scope.'})
            continue
        if not selection:
            excluded.append({**base, 'reason':specification.get('exclusions', {}).get(identifier, 'Not in the explicitly curated concrete-practice selection.')})
            continue
        try:
            condition, treatment, claim, evidence, source, origin, fields = _validate(relation, selection, catalog, origins, manifest)
        except (ValueError, KeyError) as error:
            excluded.append({**base, 'reason':str(error)})
            continue
        intervention = Intervention(condition=relation['source_entity_id'], treatment=relation['target_entity_id'],
                                    evidence_text=evidence['evidence_text'], **fields)
        protocol_id = stable_id('protocol', evidence['evidence_id'], intervention.model_dump_json())
        candidate = dict(protocol_id=protocol_id, related_condition_id=relation['source_entity_id'], treatment_id=relation['target_entity_id'],
            **{key:fields.get(key, '') for key in DOCUMENTED_FIELDS}, source_id=source['source_id'], evidence_id=evidence['evidence_id'], review_status='pending')
        duplicate_key = (candidate['related_condition_id'], candidate['treatment_id'], candidate['evidence_id'],
                         tuple(candidate[field] for field in DOCUMENTED_FIELDS))
        if duplicate_key in seen:
            excluded.append({**base, 'reason':'Duplicate candidate with identical endpoints, evidence and documented fields.'})
            continue
        seen.add(duplicate_key)
        existing_candidate = existing_by_content.get(duplicate_key)
        reuse_existing = existing_candidate is not None and existing_candidate['protocol_id'] != protocol_id
        if reuse_existing:
            protocol_id = existing_candidate['protocol_id']
        # Existing scalar IDs are local references here too, so the raw extraction
        # can be displayed/edited through the existing batch review schema.
        raw = Extraction(source_type=source['source_type'], source_limitations=' '.join(LIMITATIONS), entities=[
            dict(local_id=condition['condition_id'], entity_type='conditions', canonical_name=condition['canonical_name'], evidence_text=evidence['evidence_text']),
            dict(local_id=treatment['treatment_id'], entity_type='treatments', canonical_name=treatment['canonical_name'], evidence_text=evidence['evidence_text']),
        ], interventions=[intervention])
        batch = dict(source_id=source['source_id'], source_type=source['source_type'], chunk=origin['chunk'],
            source_limitations=' '.join(LIMITATIONS), raw_extraction=raw.model_dump(), tables={TABLE:[candidate]}, rejected=[],
            candidate_generation={'generator':GENERATOR, 'curation_version':specification['version'],
                                  'relation_id':identifier, 'claim_id':claim['claim_id']},
            extraction_metadata={'mode':'curated_candidate_derivation', 'generator':GENERATOR})
        if not reuse_existing:
            generated.append((f'protocol_candidate_{protocol_id}.json', batch))
        accepted.append({**base, 'protocol_id':protocol_id, 'condition_name':condition['canonical_name'],
            'treatment_name':treatment['canonical_name'], 'evidence_id':evidence['evidence_id'],
            'source_id':source['source_id'], 'source_title':source['title'], 'source_url':source['source_url'],
            'source_review_status':source['review_status'], 'evidence_review_status':evidence['review_status'],
            'supporting_excerpt':evidence['evidence_text'], 'fields':{key:candidate[key] for key in DOCUMENTED_FIELDS},
            'missing_fields':[key for key in DOCUMENTED_FIELDS if not candidate[key]],
            'limitations':LIMITATIONS + selection.get('limitations', [])})
    for identifier in sorted(set(selections)-relation_ids):
        excluded.append({'relation_id':identifier, 'reason':'Curated relationship is missing from draft.'})
    # Attach provenance to every exclusion without inventing a source when missing.
    for item in excluded:
        claim = catalog['claims'].get(item.get('claim_id'), {})
        evidence = catalog['evidence'].get(claim.get('evidence_id'), {})
        source = catalog['sources'].get(claim.get('source_id'), {})
        item.update(evidence_id=evidence.get('evidence_id'), supporting_excerpt=evidence.get('evidence_text'),
                    source_id=source.get('source_id'), source_url=source.get('source_url'))
    return generated, {'generator':GENERATOR, 'curation_version':specification['version'],
        'generated_at':datetime.now(timezone.utc).isoformat(), 'clinical_authorization':False,
        'relations_examined':len(relations), 'accepted_count':len(accepted), 'excluded_count':len(excluded),
        'accepted':accepted, 'excluded':excluded}


def snapshot(directory):
    return {path.relative_to(directory).as_posix():path.read_bytes() for path in directory.rglob('*') if path.is_file()}


def _stage(root, generated, created=None):
    created = created if created is not None else []
    # Validate all collisions before writing any generated file.
    for name, batch in generated:
        path = root/'staging/extracted'/name
        if path.exists():
            if read_json(path) != batch:
                raise ValueError('Existing generated batch differs; preserved for explicit review: ' + name)
    for name, batch in generated:
        path = root/'staging/extracted'/name
        if not path.exists():
            atomic_json(path, batch)
            created.append(path)
    return created


def populate(root, apply=False, specification=None):
    root = Path(root).resolve()
    generated, audit = build_candidates(root, specification)
    if not apply:
        return {**audit, 'mode':'dry_run'}
    before = snapshot(root/'DB/draft')
    protected = snapshot(root/'DB/approved')
    authorizations = root/'staging/clinical_authorizations.json'
    authorization_bytes = authorizations.read_bytes() if authorizations.exists() else None
    existing = {r['protocol_id']:r for r in rows(root, TABLE)}
    # Rehearse the existing exporter on a staging copy before touching live data.
    with tempfile.TemporaryDirectory(prefix='protocol-candidates-preview-') as directory:
        preview = Path(directory)
        shutil.copytree(root/'staging', preview/'staging')
        _stage(preview, generated)
        export(preview, draft=True)
        expected = snapshot(preview/'DB/draft')
        allowed_changes = {TABLE+'.csv', 'export_manifest.json'}
        changed = sorted(name for name in set(before)|set(expected) if before.get(name) != expected.get(name))
        unrelated = set(changed)-allowed_changes
        if unrelated:
            raise ValueError('Draft export would change unrelated tables; no live files changed: ' + ', '.join(sorted(unrelated)))
        exported = {r['protocol_id']:r for r in rows(preview, TABLE)}
        if any(exported.get(identifier) != record for identifier, record in existing.items()):
            raise ValueError('Draft export would remove or change existing candidates; no live files changed')
        # A reviewed override is preserved by the normal exporter, never overwritten.
        for item in audit['accepted']:
            actual = exported.get(item['protocol_id'])
            item['exported_review_status'] = actual['review_status'] if actual else 'excluded_by_existing_review'
        # Verify a second export is stable before committing to the real root.
        export(preview, draft=True)
        repeated = snapshot(preview/'DB/draft')
        if any(expected[name] != repeated.get(name) for name in expected if name.endswith('.csv')):
            raise ValueError('Draft CSV export is not repeatable; no live files changed')
    # Detect concurrent writers between the read and commit phases.
    if snapshot(root/'DB/draft') != before:
        raise ValueError('Draft changed during preparation; retry with no concurrent writers')
    created = []
    try:
        _stage(root, generated, created)
        export(root, draft=True)
        after = snapshot(root/'DB/draft')
        if any(after.get(name) != expected.get(name) for name in set(after)|set(expected) if name != 'export_manifest.json'):
            raise ValueError('Live draft output differs from validated preview')
        if snapshot(root/'DB/approved') != protected or (authorizations.read_bytes() if authorizations.exists() else None) != authorization_bytes:
            raise ValueError('Protected clinical records changed during population')
    except Exception:
        for name, content in before.items():
            atomic_bytes(root/'DB/draft'/name, content)
        for path in created:
            # Paths are created locally by _stage from stable generated IDs only.
            if path.parent == root/'staging/extracted' and path.name.startswith('protocol_candidate_protocol_'):
                path.unlink(missing_ok=True)
        raise
    audit.update(mode='applied', csv_changes=[name for name in changed if name.endswith('.csv')],
                 unrelated_tables_unchanged=True, approved_exports_unchanged=True, repeat_export_verified=True,
                 created_staging_batches=len(created), input_csv_sha256={name:hashlib.sha256(content).hexdigest() for name,content in before.items() if name.endswith('.csv')})
    atomic_json(root/'PROTOCOL_CANDIDATES_REPORT.json', audit)
    return audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='.')
    parser.add_argument('--apply', action='store_true', help='Stage pending candidates and export draft; default is dry run')
    args = parser.parse_args()
    result = populate(Path(args.root), apply=args.apply)
    print(json.dumps({key:result[key] for key in ('mode','accepted_count','excluded_count','clinical_authorization')}, indent=2))


if __name__ == '__main__':
    main()
