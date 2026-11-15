"""Field-level review. Approval never authorizes a clinical protocol."""
import json
from knowledge_ingestion.enrichment import catalog_from_staging,effective_candidates,candidate_record,enrichment_report,now
from knowledge_ingestion.enrichment.schema import validate_candidate
from knowledge_ingestion.storage import read_json,atomic_json


def save_review(root,record,action,edited=None):
    if action not in ('approved','rejected','edit'):
        raise ValueError('Invalid review action')
    catalog,_=catalog_from_staging(root)
    stored_job=read_json(root/'staging/enrichment/jobs'/f"{record['job_id']}.json")
    if not stored_job: raise ValueError('Original enrichment job is unavailable')
    job=stored_job['job']
    fields=('entity_id','field','value','evidence_text')
    original={field:record[field] for field in fields}
    if action=='edit':
        validated=validate_candidate(edited,job,catalog)
        if validated is None: raise ValueError('An edit must contain a supported non-null value; reject instead to remove it')
        reviewed=candidate_record(validated,job)
    else:
        if action=='approved': validate_candidate(original,job,catalog)
        reviewed={**record,'review_status':action}
    origin=record.get('origin_candidate_id',record['candidate_id'])
    reviewed['origin_candidate_id']=origin
    reviewed['reviewed_at']=now()
    atomic_json(root/'staging/enrichment/reviewed'/f'{origin}.json',reviewed)
    return reviewed


def review_enrichment(root):
    catalog,_=catalog_from_staging(root)
    for record in effective_candidates(root):
        if record['review_status']!='pending': continue
        entity=catalog.get(record['entity_id'])
        if not entity: continue
        display={key:record[key] for key in ('candidate_id','entity_id','field','value','evidence_text','source_url')}
        display.update(canonical_name=entity['row']['canonical_name'],existing_value=entity['row'].get(record['field']),
                       page_number=record['chunk'].get('page_number'),section=record['chunk'].get('section'),text_location=record['chunk']['text_location'])
        print(json.dumps(display,indent=2,ensure_ascii=False))
        print('Approve only faithful source capture. This does not authorize clinical use. Competing values remain separate claims.')
        action=input('[a]pprove / [r]eject / [s]kip / [e]dit / [q]uit: ').strip().lower()
        if action=='q': break
        try:
            if action in ('a','r'): save_review(root,record,'approved' if action=='a' else 'rejected')
            elif action=='e':
                path=input('JSON file containing entity_id, field, value, evidence_text: ').strip()
                save_review(root,record,'edit',read_json(path))
                print('Validated edit saved as pending; run review again to approve.')
        except (ValueError,TypeError,KeyError) as exc:
            print('Review not saved: '+str(exc))
    enrichment_report(root)
