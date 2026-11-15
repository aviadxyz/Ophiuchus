import json
from knowledge_ingestion.pipeline import batches, materialize
from knowledge_ingestion.storage import atomic_json, read_json
from knowledge_ingestion.extraction import Extraction
from knowledge_ingestion.normalization import EntityResolver

def authorize_protocol(root,protocol_id,reviewer):
    """Explicit responsible medical reviewer action, never called during extraction review."""
    from datetime import datetime, timezone
    if not reviewer.strip(): raise ValueError('Responsible medical reviewer identity is required')
    for _,batch in batches(root):
        for row in batch['tables'].get('protocols/candidate_protocols',[]):
            if row['protocol_id']==protocol_id and row['review_status']=='approved':
                print(json.dumps(row,indent=2))
                phrase=input('Responsible medical reviewer: type AUTHORIZE CLINICAL USE to authorize this protocol: ')
                if phrase!='AUTHORIZE CLINICAL USE': return False
                path=root/'staging/clinical_authorizations.json'
                registry=read_json(path,{})
                registry[protocol_id]={**row,'authorized_by':reviewer,'authorized_at':datetime.now(timezone.utc).isoformat()}
                atomic_json(path,registry); return True
    raise ValueError('Protocol must exist and have approved extraction review first')

def review(root):
    for path,batch in batches(root):
        if all(r.get('review_status')!='pending' for rows in batch['tables'].values() for r in rows): continue
        print(json.dumps(batch,indent=2,ensure_ascii=False))
        print('Review ALL entity fields, population, limitations and quotes. Approval records extraction accuracy only.')
        action=input('[a]pprove batch / [r]eject batch / [s]kip / [e]dit / [q]uit: ').strip().lower()
        if action=='q': break
        if action=='e':
            print('Create a JSON file matching raw_extraction (see displayed batch). It will be revalidated against the cached chunk.')
            edit_path=input('Edited extraction JSON path: ').strip()
            result=Extraction.model_validate(read_json(edit_path))
            source=read_json(root/'staging/sources/manifest.json')[batch['source_id']]
            batch=materialize(result,source,batch['chunk'],EntityResolver(root/'staging/entity_registry.json'))
            atomic_json(root/'staging/reviewed'/path.name,batch)
            print('Saved edits as pending. Run review again to approve.'); continue
        if action not in ('a','r'): continue
        for rows in batch['tables'].values():
            for row in rows: row['review_status']='approved' if action=='a' else 'rejected'
        atomic_json(root/'staging/reviewed'/path.name,batch)
