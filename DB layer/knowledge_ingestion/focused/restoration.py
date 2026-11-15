"""Restore only this task's unsupported pilot appends; preserve original data/audits."""
import base64
import csv
import io
import json
from knowledge_ingestion.storage import read_json
from .safety import contained, digest, write_json, write_bytes, read_rows


def recover_restorations(root):
    root=contained(root)
    for journal in (root/'staging/focused/restorations').glob('*.json'):
        data=read_json(journal)
        if data['status']=='committed':continue
        for plan in data['files']:
            path=contained(root/plan['path'])
            current=path.read_bytes()
            if digest(current)==plan['after_sha256']:continue
            if digest(current)!=plan['before_sha256']:
                raise ValueError('Task restoration conflicts with another writer; manual review required')
            write_bytes(path,base64.b64decode(plan['after_base64']))
        data['status']='committed'
        write_json(journal,data)


def quarantine_task_pilots(root, job_ids):
    root=contained(root)
    baseline=read_json(root/'reports/focused_enrichment/baseline.json')
    removals={}
    for jid in job_ids:
        batch=read_json(root/'staging/focused/batches'/f'{jid}.json')
        for table,rows in batch['tables'].items():
            for row in rows:
                key=next(iter(row))
                removals.setdefault(table,set()).add(row[key])
    all_removed=set().union(*removals.values())
    for path in (root/'DB/draft').rglob('*.csv'):
        table=path.relative_to(root/'DB/draft').with_suffix('').as_posix()
        for row in read_rows(path):
            identifier=next(iter(row.values()))
            if identifier in removals.get(table,set()):continue
            if any(value in all_removed for field,value in row.items() if field.endswith('_id') and field!=next(iter(row))):
                raise ValueError('A surviving record depends on a pilot row; restoration requires review')
    plans=[]
    for table,ids in removals.items():
        name='DB/draft/'+table+'.csv'
        original=baseline['csv'][name]
        if ids & set(original['ids']):
            raise ValueError('Refusing to remove any pre-task record')
        path=contained(root/name)
        current=path.read_bytes()
        prefix=base64.b64decode(original['original_base64'])
        if not current.startswith(prefix):
            raise ValueError('Original pre-task CSV byte prefix changed; restoration stopped')
        rows=read_rows(path)
        fields=original['columns']
        tail=[r for r in rows[original['row_count']:] if r[fields[0]] not in ids]
        stream=io.StringIO(newline='')
        writer=csv.DictWriter(stream,fieldnames=fields,lineterminator='\r\n');writer.writerows(tail)
        after=prefix+stream.getvalue().encode('utf-8')
        plans.append({'path':name,'before_sha256':digest(current),'after_sha256':digest(after),
                      'after_base64':base64.b64encode(after).decode(),'removed_task_only_ids':sorted(ids)})
    registry={'job_ids':sorted(job_ids),'reason':'Unsupported early pilot category/scope metadata; only task-added CSV rows restored.',
              'original_data_preserved':True,'staging_and_raw_outputs_retained':True,
              'removed_task_only_rows':{table:sorted(ids) for table,ids in removals.items()}}
    write_json(root/'staging/focused/quarantine.json',registry)
    path=root/'staging/focused/restorations/unsupported_pilot_annotations.json'
    write_json(path,{'status':'prepared','files':plans,'quarantine':registry})
    recover_restorations(root)
    return registry


def committed_rows_survive_restoration(root, plan):
    """A restored prefix may differ, but every unaffected transaction row must survive."""
    journal=read_json(root/'staging/focused/restorations/unsupported_pilot_annotations.json',{})
    if journal.get('status')!='committed':return False
    old_after=base64.b64decode(plan['after_base64'])
    before=old_after[:plan['before_length']]
    if not before:return False
    header=next(csv.reader(io.StringIO(before.decode('utf-8-sig'))))
    appended=list(csv.DictReader(io.StringIO(old_after[plan['before_length']:].decode('utf-8')),fieldnames=header))
    current={r[header[0]]:r for r in read_rows(root/plan['path'])}
    return all(current.get(r[header[0]])==r for r in appended)
