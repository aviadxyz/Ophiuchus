"""Prefix-preserving CSV persistence with resumable, immutable transaction payloads."""
import base64
import csv
import io
import json
from pathlib import Path
from knowledge_ingestion.normalization import normalize_name
from knowledge_ingestion.storage import SCHEMAS, stable_id, read_json
from .safety import contained, digest, read_rows, write_json, write_bytes, writer_lock

RELATION_COLUMNS = 'relation_id source_entity_id target_entity_id relationship_type claim_id review_status'
FOCUSED_SCHEMAS = {**SCHEMAS,
    'relations/risk_biomarker':RELATION_COLUMNS,
    'relations/risk_microbiome':RELATION_COLUMNS}


class AdditiveCatalog:
    def __init__(self, root):
        self.root = contained(root)
        self.tables = {table:read_rows(self.root/'DB/draft'/(table+'.csv')) for table in FOCUSED_SCHEMAS}
        self.new = {}
        self.mapping = {}
        self.reused = set()
        self.duplicates = 0
        for table, rows in self.tables.items():
            if not table.startswith('entities/'):
                continue
            kind = table.split('/')[1]
            key = FOCUSED_SCHEMAS[table].split()[0]
            for row in rows:
                if row.get('review_status') == 'rejected':
                    continue
                self.mapping.setdefault((kind, normalize_name(row['canonical_name'])), set()).add(row[key])
        for alias in self.tables['aliases/aliases']:
            if alias.get('review_status') == 'approved':
                self.mapping.setdefault((alias['entity_type'], normalize_name(alias['alias'])), set()).add(alias['entity_id'])

    def add(self, table, row):
        fields = FOCUSED_SCHEMAS[table].split()
        clean = {field:('' if row.get(field) is None else str(row.get(field, ''))) for field in fields}
        identifier = fields[0]
        if table.startswith('relations/'):
            signature = tuple(clean[key] for key in ('source_entity_id','target_entity_id','relationship_type'))
            duplicate = any(tuple(r[key] for key in ('source_entity_id','target_entity_id','relationship_type')) == signature for r in self.tables[table])
        else:
            duplicate = any(r[identifier] == clean[identifier] for r in self.tables[table])
        if duplicate:
            self.duplicates += 1
            return False
        if clean.get('review_status') != 'pending':
            raise ValueError('New focused records must remain pending')
        self.tables[table].append(clean)
        self.new.setdefault(table, []).append(clean)
        return True

    def entity(self, kind, name, attributes=None):
        key = (kind, normalize_name(name))
        matches = self.mapping.get(key, set())
        if len(matches) > 1:
            raise ValueError('ambiguous_existing_entity_name')
        if matches:
            identifier = next(iter(matches))
            self.reused.add((kind, identifier))
            return identifier
        identifier = stable_id(kind, normalize_name(name))
        table = 'entities/'+kind
        id_field = FOCUSED_SCHEMAS[table].split()[0]
        # Missing attributes on an existing entity are deliberately NOT filled.
        self.add(table, {id_field:identifier, 'canonical_name':name, 'review_status':'pending', **(attributes or {})})
        self.mapping[key] = {identifier}
        return identifier

    def evidence(self, source, job, quote):
        for row in self.tables['evidence/evidence']:
            if row.get('review_status') != 'rejected' and row['source_id'] == source['source_id'] and normalize_name(row['evidence_text']) == normalize_name(quote) and str(row.get('page_number') or '') == str(job['page_number'] or ''):
                self.duplicates += 1
                return row['evidence_id']
        eid = stable_id('evidence', source['source_id'], job['chunk_id'], quote)
        self.add('evidence/evidence', dict(evidence_id=eid, source_id=source['source_id'], source_url=source['source_url'],
            chunk_id=job['chunk_id'], page_number=job['page_number'], section=job['section'], text_location=job['text_location'],
            evidence_text=quote, extraction_method='ollama_focused_'+job['focus'], verification_status='exact_match', review_status='pending'))
        return eid

    def claim(self, subject, predicate, obj, text, source, eid, population, environment, limitations):
        for row in self.tables['evidence/knowledge_claims']:
            if all(row.get(key, '') == (value or '') for key,value in (
                ('subject_entity_id',subject), ('predicate',predicate), ('object_entity_id',obj),
                ('claim_text',text), ('source_id',source['source_id']), ('evidence_id',eid))):
                self.duplicates += 1
                return row['claim_id']
        cid = stable_id('claim', subject, predicate, obj or '', text, source['source_id'], eid)
        self.add('evidence/knowledge_claims', dict(claim_id=cid, subject_entity_id=subject, predicate=predicate,
            object_entity_id=obj, claim_text=text, source_id=source['source_id'], evidence_id=eid, evidence_status='unknown',
            study_population=population, study_environment=environment, limitations=limitations, review_status='pending'))
        return cid


def validate_references(tables):
    entities = {r[FOCUSED_SCHEMAS[table].split()[0]] for table,rows in tables.items() if table.startswith('entities/') for r in rows}
    evidence = {r['evidence_id']:r for r in tables.get('evidence/evidence', [])}
    sources = {r['source_id'] for r in tables.get('metadata/sources', [])}
    claims = {r['claim_id']:r for r in tables.get('evidence/knowledge_claims', [])}
    for row in evidence.values():
        if row['source_id'] not in sources:
            raise ValueError('Evidence source reference is unresolved')
    for row in claims.values():
        if row['subject_entity_id'] not in entities or (row.get('object_entity_id') and row['object_entity_id'] not in entities) or row['evidence_id'] not in evidence:
            raise ValueError('Claim reference is unresolved')
    for table, rows in tables.items():
        if table.startswith('relations/'):
            for row in rows:
                if row['source_entity_id'] not in entities or row['target_entity_id'] not in entities or row['claim_id'] not in claims:
                    raise ValueError('Relationship reference is unresolved')


def append_tables(root, additions, transaction_key):
    root = contained(root)
    transaction = contained(root/'staging/focused/transactions'/f'{transaction_key}.json')
    if transaction.exists():
        return resume_transaction(root, transaction)
    catalog = AdditiveCatalog(root)
    for table, rows in additions.items():
        if table not in FOCUSED_SCHEMAS or table.startswith(('protocols/', 'inventory/', 'metadata/')):
            raise ValueError('Focused append cannot modify this table: '+table)
        for row in rows:
            catalog.add(table, row)
    # Validate new records against all old rows without changing any old record.
    # Old unrelated data-quality defects are reported separately, not repaired.
    new_claims = catalog.new.get('evidence/knowledge_claims', [])
    new_evidence = catalog.new.get('evidence/evidence', [])
    entity_ids = {r[FOCUSED_SCHEMAS[t].split()[0]] for t,rs in catalog.tables.items() if t.startswith('entities/') for r in rs}
    source_ids = {r['source_id'] for r in catalog.tables['metadata/sources']}
    evidence_ids = {r['evidence_id'] for r in catalog.tables['evidence/evidence']}
    claim_ids = {r['claim_id'] for r in catalog.tables['evidence/knowledge_claims']}
    for row in new_evidence:
        if row['source_id'] not in source_ids:
            raise ValueError('New evidence has an unresolved source')
    for row in new_claims:
        if row['subject_entity_id'] not in entity_ids or (row.get('object_entity_id') and row['object_entity_id'] not in entity_ids) or row['evidence_id'] not in evidence_ids:
            raise ValueError('New claim has unresolved references')
    for table, records in catalog.new.items():
        if table.startswith('relations/'):
            for row in records:
                if row['source_entity_id'] not in entity_ids or row['target_entity_id'] not in entity_ids or row['claim_id'] not in claim_ids:
                    raise ValueError('New relation has unresolved references')
    plans = []
    for table, records in catalog.new.items():
        target = contained(root/'DB/draft'/(table+'.csv'))
        before = target.read_bytes() if target.exists() else b''
        fields = FOCUSED_SCHEMAS[table].split()
        if before:
            header = next(csv.reader(io.StringIO(before.decode('utf-8-sig'))))
            if header != fields:
                raise ValueError('Existing CSV header must not change: '+table)
        stream = io.StringIO(newline='')
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\r\n')
        if not before:
            writer.writeheader()
        writer.writerows(records)
        separator = b'\r\n' if before and not before.endswith((b'\n', b'\r')) else b''
        after = before + separator + stream.getvalue().encode('utf-8')
        plans.append(dict(path=str(target.relative_to(root)), before_sha256=digest(before), before_length=len(before),
                          after_sha256=digest(after), after_base64=base64.b64encode(after).decode(), rows=len(records), table=table))
    write_json(transaction, {'status':'prepared','transaction_key':transaction_key,'files':plans})
    return resume_transaction(root, transaction)


def resume_transaction(root, transaction):
    root, transaction = contained(root), contained(transaction)
    data = read_json(transaction)
    if data.get('status') == 'committed':
        quarantine=read_json(root/'staging/focused/quarantine.json',{})
        if data['transaction_key'] in quarantine.get('job_ids',[]):
            raise ValueError('Quarantined task-only transaction cannot be replayed')
        for plan in data['files']:
            target = contained(root/plan['path'])
            if not target.is_relative_to(root/'DB/draft') or not target.read_bytes().startswith(base64.b64decode(plan['after_base64'])):
                from .restoration import committed_rows_survive_restoration
                if not committed_rows_survive_restoration(root,plan):
                    raise ValueError('Committed append prefix was modified; manual review required')
        return {p['table']:p['rows'] for p in data['files']}
    for plan in data['files']:
        target = contained(root/plan['path'])
        if not target.is_relative_to(root/'DB/draft'):
            raise ValueError('Transaction target must be a draft CSV')
        current = target.read_bytes() if target.exists() else b''
        if digest(current) == plan['after_sha256']:
            continue
        if digest(current) != plan['before_sha256']:
            raise ValueError('CSV changed during a pending transaction; manual review required')
        after = base64.b64decode(plan['after_base64'])
        if not after.startswith(current) or digest(after) != plan['after_sha256']:
            raise ValueError('Transaction would modify an existing byte prefix')
        write_bytes(target, after)
    data['status'] = 'committed'
    write_json(transaction, data)
    return {p['table']:p['rows'] for p in data['files']}


def recover(root):
    root = contained(root)
    from .restoration import recover_restorations
    recover_restorations(root)
    for path in sorted((root/'staging/focused/transactions').glob('*.json')):
        data = read_json(path)
        if data.get('status') != 'committed':
            resume_transaction(root, path)


def preserve_draft_export(root):
    """After focused enrichment, future draft exports append instead of rebuilding."""
    with writer_lock(root):
        return _preserve_draft_export(root)


def _preserve_draft_export(root):
    from knowledge_ingestion.pipeline import batches
    root = contained(root)
    recover(root)
    catalog = AdditiveCatalog(root)
    for _, batch in batches(root):
        for table, rows in batch['tables'].items():
            if table.startswith(('protocols/', 'inventory/', 'metadata/')):
                continue
            for row in rows:
                if row.get('review_status') == 'pending':
                    catalog.add(table, row)
    for path in sorted((root/'staging/focused/batches').glob('*.json')):
        if path.stem in read_json(root/'staging/focused/quarantine.json',{}).get('job_ids',[]):
            continue
        for table, rows in read_json(path)['tables'].items():
            for row in rows:
                catalog.add(table, row)
    # Existing reviewed/existing-ID rows remain byte-identical. This mode never
    # updates existing review flags; clinical export remains a separate operation.
    if catalog.new:
        key = stable_id('additive_export', catalog.new)
        append_tables(root, catalog.new, key)
    return root/'DB/draft'
