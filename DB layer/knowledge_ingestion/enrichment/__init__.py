"""Resumable, source-grounded enrichment of existing entities. No cloud calls."""
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
import re
import time

from knowledge_ingestion.enrichment.merge import merge_entity, missing, value_key
from knowledge_ingestion.enrichment.schema import PROMPT, PROMPT_VERSION, SCHEMA_VERSION, request_schema, parse_candidates, validate_candidate
from knowledge_ingestion.normalization import normalize_name
from knowledge_ingestion.parsers import chunks, normalize_text
from knowledge_ingestion.storage import ENTITY_FIELDS, atomic_json, read_json, stable_id

LOG = logging.getLogger(__name__)


def now():
    return datetime.now(timezone.utc).isoformat()


def catalog_from_staging(root):
    from knowledge_ingestion.pipeline import batches
    catalog, origins, hints, conflicts = {}, defaultdict(set), defaultdict(lambda: defaultdict(set)), []
    aliases = defaultdict(set)
    for _, batch in batches(root):
        for table, rows in batch['tables'].items():
            if not table.startswith('entities/'):
                continue
            kind = table.split('/')[1]
            id_field = ENTITY_FIELDS[kind].split()[0]
            for row in rows:
                if row.get('review_status') == 'rejected':
                    continue
                eid = row[id_field]
                if eid not in catalog:
                    catalog[eid] = {'entity_type': kind, 'row': dict(row)}
                else:
                    merge_entity(table, catalog[eid]['row'], row, conflicts)
                origins[eid].add(batch['source_id'])
        evidence = {e['evidence_id']: e for e in batch['tables'].get('evidence/evidence', []) if e.get('review_status') != 'rejected'}
        for claim in batch['tables'].get('evidence/knowledge_claims', []):
            if claim.get('review_status') == 'rejected' or claim.get('evidence_id') not in evidence:
                continue
            for eid in (claim['subject_entity_id'], claim.get('object_entity_id')):
                if eid:
                    hints[eid][batch['source_id']].add(evidence[claim['evidence_id']]['evidence_text'])
        for alias in batch['tables'].get('aliases/aliases', []):
            if alias.get('review_status') == 'approved':
                aliases[alias['entity_id']].add(alias['alias'])
    for key, eid in read_json(root/'staging/entity_registry.json', {}).items():
        kind, _, alias = key.partition(':')
        if eid in catalog and kind == catalog[eid]['entity_type']:
            aliases[eid].add(alias)
    for eid, entity in catalog.items():
        aliases[eid].add(entity['row']['canonical_name'])
        entity['aliases'] = sorted(aliases[eid])
        entity['source_ids'] = sorted(origins[eid])
        entity['hints'] = {sid: sorted(quotes) for sid, quotes in hints[eid].items()}
        entity['missing_fields'] = [f for f in ENTITY_FIELDS[entity['entity_type']].split()[2:] if missing(f, entity['row'].get(f))]
    return catalog, conflicts


def enrichment_chunks(doc):
    size = int(os.getenv('ENRICHMENT_CHUNK_SIZE', '1600'))
    if size < 320:
        raise ValueError('ENRICHMENT_CHUNK_SIZE must be at least 320')
    sections = doc.get('sections') or [{'text': p['text'], 'page_number': p.get('page_number'), 'section': None, 'extractable': True} for p in doc['pages']]
    seen = set()
    for section in sections:
        if not section.get('extractable', True) or len(section['text']) < 8:
            continue
        page = {'text': section['text'], 'page_number': section.get('page_number'), 'section': section.get('section')}
        for chunk in chunks({**doc, 'pages': [page]}, size=size, overlap=160):
            key = (chunk['page_number'], chunk['section'], chunk['text'])
            if key not in seen:
                seen.add(key)
                chunk['text_location'] = f"section {chunk['section']}; {chunk['text_location']}"
                yield chunk


def build_jobs(root, catalog, provider, entity_id=None, entity_type=None, source_id=None):
    from knowledge_ingestion.extraction.selection import document_exclusion, document_priority
    selected = {eid: e for eid, e in catalog.items() if e['missing_fields'] and (entity_id is None or eid == entity_id) and (entity_type is None or e['entity_type'] == entity_type)}
    if entity_id and entity_id not in catalog:
        raise ValueError(f'Unknown entity ID: {entity_id}')
    sources = read_json(root/'staging/sources/manifest.json', {})
    priorities = {'treatments': 0, 'biomarkers': 1, 'conditions': 2, 'environments': 3, 'risk_factors': 4}
    jobs = []
    for sid, source in sources.items():
        if source_id and sid != source_id:
            continue
        if source.get('fetch_status') != 'success' or not source.get('cache_path') or source.get('duplicate_of') or document_exclusion(source):
            continue
        doc = read_json(root/source['cache_path'])
        page_text = ' '.join(p['text'] for p in doc['pages'])
        source_hash = hashlib.sha256(page_text.encode()).hexdigest()
        for chunk in enrichment_chunks(doc):
            text = normalize_name(chunk['text'])
            grouped = defaultdict(list)
            for eid, entity in selected.items():
                mentions = any(re.search(r'(?<!\w)'+re.escape(normalize_name(alias))+r'(?!\w)',text) for alias in entity['aliases'] if alias.strip())
                linked_quote = any(normalize_text(q) in normalize_text(chunk['text']) for q in entity['hints'].get(sid, []))
                if mentions or linked_quote:
                    grouped[entity['entity_type']].append({'entity_id': eid, 'canonical_name': entity['row']['canonical_name'], 'fields': entity['missing_fields'], 'associated_source': sid in entity['source_ids']})
            for kind, targets in grouped.items():
                targets.sort(key=lambda t: (not t['associated_source'], t['entity_id']))
                for start in range(0, len(targets), 5):
                    group = targets[start:start+5]
                    schema = request_schema(group)
                    identity = {'source_id': sid, 'source_content_hash': source_hash,
                                'input_content_hash': hashlib.sha256(chunk['text'].encode()).hexdigest(),
                                'chunk_id': chunk['chunk_id'], 'section': chunk.get('section'), 'targets': group,
                                'model': provider.model, 'settings': provider.cache_settings(),
                                'output_limit': min(provider.settings.num_predict, 1024),
                                'prompt_version': PROMPT_VERSION, 'schema_version': SCHEMA_VERSION,
                                'prompt_hash': hashlib.sha256(PROMPT.encode()).hexdigest(),
                                'schema_hash': hashlib.sha256(json.dumps(schema, sort_keys=True).encode()).hexdigest()}
                    job = {'job_id': stable_id('enrichment_job', identity), 'identity': identity,
                           'source_id': sid, 'source_url': source['source_url'], 'entity_type': kind,
                           'targets': group, 'chunk': chunk, 'original_page_text': ' '.join(p['text'] for p in doc['pages'] if p.get('page_number') == chunk.get('page_number'))}
                    job['priority'] = (priorities.get(kind, 5), not any(t['associated_source'] for t in group), document_priority(source), sid, chunk['text_location'], start)
                    jobs.append(job)
    return sorted(jobs, key=lambda j: j['priority'])


def candidate_record(candidate, job):
    eid = stable_id('evidence', job['source_id'], job['chunk']['chunk_id'], candidate.evidence_text, 'entity_enrichment')
    cid = stable_id('attribute_claim', candidate.entity_id, candidate.field, candidate.value, job['source_id'], eid)
    return {**candidate.model_dump(), 'candidate_id': cid, 'evidence_id': eid, 'job_id': job['job_id'],
            'source_id': job['source_id'], 'source_url': job['source_url'], 'entity_type': job['entity_type'],
            'chunk': job['chunk'], 'review_status': 'pending', 'created_at': now()}


def enrich(root, max_requests=10, provider=None, entity_id=None, entity_type=None, source_id=None):
    """None means an explicitly requested full run. Other limits count actual model calls."""
    from knowledge_ingestion.extraction.ollama_provider import OllamaExtractor, OllamaUnavailable
    root = root.resolve()
    if max_requests is not None and max_requests < 1:
        raise ValueError('max_requests must be positive')
    status = {'started_at': now(), 'status': 'running', 'requests_attempted': 0, 'requests_succeeded': 0,
              'requests_failed': 0, 'jobs_skipped': 0, 'cache_hits': 0, 'fields_proposed': 0,
              'fields_accepted': 0, 'fields_rejected': 0, 'remaining_jobs': 0}
    def finish():
        if status['status'] == 'running':
            status['status'] = 'partial_failure' if status['requests_failed'] else 'completed'
        status['finished_at'] = now()
        atomic_json(root/'staging/enrichment/status.json', status)
        return enrichment_report(root, status=status)
    atomic_json(root/'staging/enrichment/status.json', status)
    try:
        provider = provider or OllamaExtractor()  # Explicitly local, independent of Gemini settings.
        catalog, conflicts = catalog_from_staging(root)
        status['model'] = provider.model
        jobs = build_jobs(root, catalog, provider, entity_id, entity_type, source_id)
        status['jobs_total'] = len(jobs)
        status['remaining_jobs'] = sum(read_json(root/'staging/enrichment/jobs'/f"{j['job_id']}.json", {}).get('status') != 'completed' for j in jobs)
        atomic_json(root/'staging/enrichment/inventory.json', {'generated_at': now(), 'catalog_entities': len(catalog), 'baseline_conflicts': conflicts,
                    'filters':{'entity_id':entity_id,'entity_type':entity_type,'source_id':source_id},
                    'jobs': [{'job_id': j['job_id'], 'source_id': j['source_id'], 'entity_type': j['entity_type'], 'targets': j['targets']} for j in jobs]})
        if status['remaining_jobs'] and hasattr(provider, 'health_check'):
            provider.health_check()
    except Exception as exc:
        status.update(status='failed', error=str(exc)); return finish()
    for job in jobs:
        path = root/'staging/enrichment/jobs'/f"{job['job_id']}.json"
        if read_json(path, {}).get('status') == 'completed':
            status['jobs_skipped'] += 1
            continue
        if max_requests is not None and status['requests_attempted'] >= max_requests:
            status['status'] = 'pilot_complete' if not status['requests_failed'] else 'partial_failure'
            break
        started = time.monotonic()
        LOG.info('Enrichment job=%s type=%s targets=%d source=%s (request %d/%s)', job['job_id'], job['entity_type'], len(job['targets']), job['source_url'], status['requests_attempted']+1, max_requests or 'all')
        raw = None
        try:
            cache_path = root/'cache/enrichment'/f"{job['job_id']}.json"
            cached = read_json(cache_path)
            if cached:
                raw = cached['original_model_output']; status['cache_hits'] += 1
            else:
                status['requests_attempted'] += 1
                atomic_json(root/'staging/enrichment/status.json', status)
                raw = provider.extract_attributes(job['chunk']['text'], job['targets'])
            accepted, rejected, proposed = parse_candidates(raw, job, catalog)
            atomic_json(cache_path, {'identity': job['identity'], 'original_model_output': raw})
            ids = []
            for candidate in accepted:
                record = candidate_record(candidate, job); ids.append(record['candidate_id'])
                destination = root/'staging/enrichment/candidates'/f"{record['candidate_id']}.json"
                if not destination.exists(): atomic_json(destination, record)
            atomic_json(path, {'status': 'completed', 'job': job, 'original_model_output': raw, 'candidate_ids': sorted(set(ids)), 'rejected': rejected, 'proposed': proposed, 'completed_at': now()})
            status['requests_succeeded'] += 1; status['fields_proposed'] += proposed
            status['fields_accepted'] += len(set(ids)); status['fields_rejected'] += len(rejected)
            status['remaining_jobs'] -= 1
        except Exception as exc:
            status['requests_failed'] += 1; status['error'] = str(exc)
            atomic_json(path, {'status': 'failed', 'job': job, 'original_model_output': raw, 'error': str(exc), 'failed_at': now()})
            LOG.error('Enrichment job failed: %s', exc)
            if isinstance(exc, OllamaUnavailable):
                status['status'] = 'partial_failure'; break
        finally:
            LOG.info('Enrichment job duration=%.2fs', time.monotonic()-started)
        atomic_json(root/'staging/enrichment/status.json', status)
    return finish()


def effective_candidates(root):
    for path in sorted((root/'staging/enrichment/candidates').glob('*.json')):
        yield read_json(root/'staging/enrichment/reviewed'/path.name, read_json(path))


def candidate_tables(record):
    chunk = record['chunk']; review = record['review_status']
    evidence = {'evidence_id': record['evidence_id'], 'source_id': record['source_id'], 'source_url': record['source_url'],
                'chunk_id': chunk['chunk_id'], 'page_number': chunk.get('page_number'), 'section': chunk.get('section'),
                'text_location': chunk['text_location'], 'evidence_text': record['evidence_text'],
                'extraction_method': 'ollama_entity_enrichment', 'verification_status': 'exact_match', 'review_status': review}
    claim = {'claim_id': record['candidate_id'], 'subject_entity_id': record['entity_id'], 'predicate': 'has_attribute', 'object_entity_id': None,
             'claim_text': json.dumps({'field': record['field'], 'value': record['value']}, ensure_ascii=False),
             'source_id': record['source_id'], 'evidence_id': record['evidence_id'], 'evidence_status': 'unknown',
             'study_population': 'unknown', 'study_environment': None,
             'limitations': 'Extractive attribute assertion; exact provenance verification is not proof of semantic or medical validity.', 'review_status': review}
    return evidence, claim


def overlay_enrichment(root, tables, draft):
    """Add field-level assertions; only uniquely supported missing values reach entity cells."""
    audit = {'candidates_included': 0, 'cells_filled': 0, 'cells_filled_by_table': {}, 'conflicts': [], 'excluded_by_review': 0,'invalid_staged_records':[]}
    catalog,_=catalog_from_staging(root)
    job_cache={}
    grouped = defaultdict(list)
    for record in effective_candidates(root):
        if record['review_status'] == 'rejected' or (not draft and record['review_status'] != 'approved'):
            audit['excluded_by_review'] += 1; continue
        table = 'entities/'+record['entity_type']; eid = record['entity_id']
        if eid not in tables.get(table, {}): continue  # Base entity approval is an independent prerequisite.
        try:
            if record['job_id'] not in job_cache:
                job_cache[record['job_id']]=read_json(root/'staging/enrichment/jobs'/f"{record['job_id']}.json")['job']
            job=job_cache[record['job_id']]
            candidate=validate_candidate({k:record[k] for k in ('entity_id','field','value','evidence_text')},job,catalog)
            if candidate is None: raise ValueError('Missing-value placeholder is not an attribute addition')
            expected=candidate_record(candidate,job)
            for key in ('source_id','source_url','entity_type','chunk','evidence_id','candidate_id'):
                if record[key]!=expected[key]: raise ValueError('Staged provenance/identity mismatch: '+key)
        except (ValueError,KeyError,TypeError) as exc:
            audit['invalid_staged_records'].append({'candidate_id':record.get('candidate_id'),'reason':str(exc)})
            continue
        evidence, claim = candidate_tables(record)
        tables['evidence/evidence'].setdefault(evidence['evidence_id'], evidence)
        tables['evidence/knowledge_claims'].setdefault(claim['claim_id'], claim)
        audit['candidates_included'] += 1
        grouped[(table, eid, record['field'])].append(record)
    for (table, eid, field), records in grouped.items():
        row = tables[table][eid]
        # Approved field choices take precedence over pending alternatives, but
        # never overwrite existing base data. Multiple approved values conflict.
        approved = [r for r in records if r['review_status'] == 'approved']
        choices = approved or records
        values = {json.dumps(value_key(field, r['value']), sort_keys=True) for r in choices}
        if not missing(field, row.get(field)):
            if any(value_key(field, row[field]) != value_key(field, r['value']) for r in choices):
                audit['conflicts'].append({'entity_id': eid, 'field': field, 'reason': 'existing_value_preserved', 'candidate_ids': [r['candidate_id'] for r in choices]})
            continue
        if len(values) != 1:
            audit['conflicts'].append({'entity_id': eid, 'field': field, 'reason': 'conflicting_additions', 'candidate_ids': [r['candidate_id'] for r in choices]})
            continue
        row[field] = choices[0]['value']
        if not approved: row['review_status'] = 'pending'
        audit['cells_filled'] += 1
        audit['cells_filled_by_table'][table] = audit['cells_filled_by_table'].get(table, 0)+1
    return audit


def enrichment_report(root, status=None):
    status = status or read_json(root/'staging/enrichment/status.json', {})
    records = list(effective_candidates(root))
    jobs = [read_json(p) for p in (root/'staging/enrichment/jobs').glob('*.json')]
    searched = {(t['entity_id'], field) for j in jobs if j['status'] == 'completed' for t in j['job']['targets'] for field in t['fields']}
    catalog, conflicts = catalog_from_staging(root)
    missing_fields = {(eid, field) for eid, e in catalog.items() for field in e['missing_fields']}
    valid_records=[];invalid_records=[];job_index={j['job']['job_id']:j['job'] for j in jobs}
    for record in records:
        if record['review_status']=='rejected': continue
        try:
            candidate=validate_candidate({k:record[k] for k in ('entity_id','field','value','evidence_text')},job_index[record['job_id']],catalog)
            if candidate is None: raise ValueError('Missing-value placeholder')
            valid_records.append(record)
        except (ValueError,KeyError,TypeError) as exc:
            invalid_records.append({'candidate_id':record.get('candidate_id'),'entity_id':record.get('entity_id'),'field':record.get('field'),'reason':str(exc)})
    supported = {(r['entity_id'], r['field']) for r in valid_records}
    rejected_fields={(r['record'].get('entity_id'),r['record'].get('field')) for j in jobs for r in j.get('rejected',[]) if isinstance(r.get('record'),dict) and isinstance(r['record'].get('entity_id'),str) and isinstance(r['record'].get('field'),str)}
    rejected_fields.update((r['entity_id'],r['field']) for r in records if r['review_status']=='rejected')
    rejected_fields.update((r['entity_id'],r['field']) for r in invalid_records)
    inventory=read_json(root/'staging/enrichment/inventory.json',{})
    active_ids={j['job_id'] for j in inventory.get('jobs',[])}
    completed_ids={j['job']['job_id'] for j in jobs if j['status']=='completed'}
    result = {'latest_run': status, 'candidate_records': len(records), 'source_backed_candidates':len(valid_records),'invalid_staged_records':invalid_records,'pending': sum(r['review_status'] == 'pending' for r in valid_records),
              'rejected_records': sum(r['review_status'] == 'rejected' for r in records),
              'rejection_reasons': dict(Counter(r['reason'] for j in jobs for r in j.get('rejected', []))),
              'revalidation_rejection_reasons':dict(Counter(r['reason'] for r in invalid_records)),
              'current_queue':{'jobs_total':len(active_ids),'completed_jobs_reused':len(active_ids & completed_ids),'remaining_jobs':len(active_ids-completed_ids),'filters':inventory.get('filters',{})},
              'completed_jobs': sum(j['status'] == 'completed' for j in jobs), 'failed_jobs': sum(j['status'] == 'failed' for j in jobs),
              'fields_not_searched': len(missing_fields-searched), 'fields_not_found_in_examined_passages': len((searched & missing_fields)-supported-rejected_fields),
              'fields_with_rejected_suggestions':len(rejected_fields & missing_fields),'fields_with_supported_candidates':len(supported),
              'baseline_conflicts': conflicts,
              'draft_export': read_json(root/'DB/draft/export_manifest.json', {}).get('enrichment_audit', {})}
    atomic_json(root/'enrichment_report.json', result)
    return result
