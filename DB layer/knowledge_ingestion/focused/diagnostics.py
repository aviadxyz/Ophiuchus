"""Scope and append-only verification; never repairs or rewrites old data."""
import base64
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess
from .safety import contained, read_rows, write_json
from .validation import validate_record


def verify_and_report(root):
    root = contained(root)
    baseline = json.loads((root/'reports/focused_enrichment/baseline.json').read_text(encoding='utf-8'))
    checks = {'existing_csv_prefixes_preserved':True,'approved_and_snapshots_unchanged':True,
              'existing_ids_order_statuses_preserved':True,'no_existing_files_deleted':True,'outside_sources_unchanged':True}
    failures, added = [], {}
    for name, before in baseline['csv'].items():
        path = root/name
        original = base64.b64decode(before['original_base64'])
        if not path.exists() or not path.read_bytes().startswith(original):
            checks['existing_csv_prefixes_preserved'] = False
            failures.append({'path':name,'reason':'existing CSV byte prefix changed or missing'})
            continue
        if ('/approved/' in name or '/snapshots/' in name) and path.read_bytes() != original:
            checks['approved_and_snapshots_unchanged'] = False
            failures.append({'path':name,'reason':'protected approved/snapshot CSV changed'})
        current = read_rows(path)
        if current:
            key = before['columns'][0]
            if [r[key] for r in current[:before['row_count']]] != before['ids']:
                checks['existing_ids_order_statuses_preserved'] = False
        if name.startswith('DB/draft/') and len(current) > before['row_count']:
            added[name] = len(current)-before['row_count']
    for path in (root/'DB/draft').rglob('*.csv'):
        name = path.relative_to(root).as_posix()
        if name not in baseline['csv']:
            added[name] = len(read_rows(path))
    missing = [name for name in baseline['existing_paths'] if not (root/name).is_file()]
    if missing:
        checks['no_existing_files_deleted'] = False
        failures.append({'reason':'existing files missing','paths':missing})
    for name, digest in baseline['outside_source_hashes'].items():
        path = root.parent/name
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            checks['outside_sources_unchanged'] = False
            failures.append({'path':name,'reason':'outside source changed'})
    repo = root.parent
    names = subprocess.check_output(['git','-c','safe.directory='+repo.as_posix(),'ls-files','--cached','--others','--exclude-standard','-z'],cwd=repo).decode().split('\0')
    new_outside = [name for name in names if name and not name.startswith('DB layer/') and name not in baseline['outside_source_hashes']]
    if new_outside:
        checks['outside_sources_unchanged'] = False
        failures.append({'reason':'new outside source files','paths':new_outside})
    checkpoints = [json.loads(p.read_text(encoding='utf-8')) for p in (root/'staging/focused/checkpoints').glob('*.json')]
    counts = {}
    for focus in ('monitoring','microbiome'):
        selected = [j for j in checkpoints if j['focus'] == focus]
        counts[focus] = dict(sources_processed=len({j['source_id'] for j in selected}),chunks_processed=len(selected),
            candidate_records=sum(j.get('candidates',0) for j in selected),valid_records=sum(j.get('valid_records',0) for j in selected),
            evidence_verification_failures=sum('evidence' in r.get('reason','') or 'verbatim' in r.get('reason','') for j in selected for r in j.get('rejected',[])),
            rejected_reasons=dict(Counter(r.get('reason','unknown') for j in selected for r in j.get('rejected',[]))),
            errors=[{'job_id':j['job_id'],'error':j.get('error')} for j in selected if j['status'] != 'committed'],
            reused_entities=sorted({tuple(e) for j in selected for e in j.get('reused_entities',[])}))
    pending = {}
    for name in added:
        path = root/name
        rows = read_rows(path)
        old_count = baseline['csv'].get(name,{}).get('row_count',0)
        if any(r.get('review_status') != 'pending' for r in rows[old_count:]):
            failures.append({'path':name,'reason':'new record lacks pending review status'})
        pending[name] = len(rows)-old_count
    existing_quality_issues = []
    anatomy = {'heart','brain','bones','blood vessels'}
    for name,before in baseline['csv'].items():
        if name == 'DB/draft/entities/biomarkers.csv':
            for row in read_rows(root/name)[:before['row_count']]:
                value = row['canonical_name'].casefold()
                if value in anatomy or 'microbial ecosystem' in value:
                    existing_quality_issues.append({'table':name,'id':row['biomarker_id'],'name':row['canonical_name'],
                        'reason':'Possible pre-existing anatomy/community classified as a measurable biomarker.',
                        'action':'Reported only; original record and review status preserved.'})
    # Revalidate staged payloads with the latest guards without changing their
    # original pending CSV annotations. Preserve and flag pilot data-quality issues.
    quality_issues = []
    for path in (root/'staging/focused/batches').glob('*.json'):
        batch = json.loads(path.read_text(encoding='utf-8'))
        job = {'focus':batch['focused_mode'],'text':batch['chunk']['text'],'original_page_text':batch['chunk']['text']}
        for record in batch['raw_extraction']['records']:
            try:
                validate_record(record,job)
            except ValueError as error:
                quality_issues.append({'job_id':path.stem,'reason':str(error),'record':record,
                    'claim_ids':[r['claim_id'] for r in batch['tables'].get('evidence/knowledge_claims',[])],
                    'action':'Preserved unchanged and pending; professional review required. No automatic reclassification.'})
    quarantine_path=root/'staging/focused/quarantine.json'
    quarantine=json.loads(quarantine_path.read_text(encoding='utf-8')) if quarantine_path.exists() else {}
    quarantined=[issue for issue in quality_issues if issue['job_id'] in quarantine.get('job_ids',[])]
    for issue in quarantined:
        issue['action']='Unsupported task-only pilot CSV appends restored; raw output and staging retained in quarantine. Original records untouched.'
    quality_issues=[issue for issue in quality_issues if issue not in quarantined]
    result = {'db_root':str(root),'checks':checks,'failures':failures,'new_csv_rows':added,'pending_review_rows':pending,
        'monitoring':counts['monitoring'],'microbiome':counts['microbiome'],
        'duplicates_skipped':sum(j.get('duplicates_skipped',0) for j in checkpoints),
        'pending_data_quality_issues':quality_issues,'quarantined_pilot_issues':quarantined,
        'task_only_restoration':quarantine,'preexisting_data_quality_issues':existing_quality_issues,
        'hrr_access':json.loads((root/'reports/focused_enrichment/hrr_access.json').read_text(encoding='utf-8')) if (root/'reports/focused_enrichment/hrr_access.json').exists() else [],
        'new_biomarkers':added.get('DB/draft/entities/biomarkers.csv',0),
        'new_microbiome_entities':added.get('DB/draft/entities/microbiome.csv',0),
        'new_condition_biomarker_relations':added.get('DB/draft/relations/condition_biomarker.csv',0),
        'new_risk_biomarker_relations':added.get('DB/draft/relations/risk_biomarker.csv',0),
        'new_condition_microbiome_relations':added.get('DB/draft/relations/condition_microbiome.csv',0),
        'new_risk_microbiome_relations':added.get('DB/draft/relations/risk_microbiome.csv',0)}
    write_json(root/'reports/focused_enrichment/final.json',result)
    return result
