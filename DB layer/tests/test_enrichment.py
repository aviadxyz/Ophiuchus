import csv
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

from knowledge_ingestion.enrichment import enrich, catalog_from_staging, build_jobs, candidate_record, enrichment_report
from knowledge_ingestion.enrichment.schema import parse_candidates, validate_candidate
from knowledge_ingestion.enrichment.merge import merge_entity
from knowledge_ingestion.enrichment.review import save_review
from knowledge_ingestion.extraction import Extraction
from knowledge_ingestion.normalization import EntityResolver
from knowledge_ingestion.pipeline import materialize, export
from knowledge_ingestion.storage import atomic_json, read_json


TEXT='Vitamin D is a supplement. Vitamin D is taken orally. Vitamin D requires medical supervision.'


class FakeLocal:
    model='mock-local-attributes'
    settings=SimpleNamespace(num_predict=1024)
    calls=0
    def cache_settings(self): return {'temperature':0}
    def health_check(self): return {'status':'ready'}
    def extract_attributes(self,text,targets):
        self.calls+=1
        return json.dumps({'additions':[{'entity_id':targets[0]['entity_id'],'field':'treatment_type','value':'supplement','evidence_text':'Vitamin D is a supplement.'}]})


def seed(root, text=TEXT, approved=False):
    source={'source_id':'source_test','source_url':'https://nasa.gov/test-enrichment','fetch_status':'success','cache_path':'cache/source.json'}
    doc={'source_id':source['source_id'],'source_url':source['source_url'],'pages':[{'page_number':1,'text':text}]}
    chunk={'chunk_id':'original_chunk','page_number':1,'section':'Research','text_location':'characters 0:'+str(len(text)),'text':text}
    result=Extraction.model_validate({'source_type':'research_summary','entities':[{'local_id':'t','entity_type':'treatments','canonical_name':'Vitamin D','evidence_text':text[:120]}]})
    batch=materialize(result,source,chunk,EntityResolver(root/'staging/entity_registry.json'))
    if approved:
        for rows in batch['tables'].values():
            for row in rows: row['review_status']='approved'
    atomic_json(root/'staging/extracted/original.json',batch)
    atomic_json(root/'staging/sources/manifest.json',{'source_test':source})
    atomic_json(root/'cache/source.json',doc)
    catalog,_=catalog_from_staging(root)
    return next(iter(catalog)),source


def csv_rows(root,name,approved=False):
    destination=export(root,draft=not approved)
    with (destination/name).open(encoding='utf-8',newline='') as f: return list(csv.DictReader(f))


def first_job(root,provider=None):
    catalog,_=catalog_from_staging(root)
    return build_jobs(root,catalog,provider or FakeLocal())[0],catalog


def test_end_to_end_draft_claim_evidence_resume(tmp_path):
    eid,_=seed(tmp_path)
    provider=FakeLocal()
    result=enrich(tmp_path,provider=provider,max_requests=10)
    assert result['latest_run']['fields_accepted']==1 and provider.calls==1
    rows=csv_rows(tmp_path,'entities/treatments.csv')
    assert rows[0]['treatment_id']==eid and rows[0]['treatment_type']=='supplement'
    assert rows[0]['route_of_administration']=='' and rows[0]['review_status']=='pending'
    claims=csv_rows(tmp_path,'evidence/knowledge_claims.csv')
    claim=next(c for c in claims if c['predicate']=='has_attribute')
    evidence=csv_rows(tmp_path,'evidence/evidence.csv')
    quote=next(e for e in evidence if e['evidence_id']==claim['evidence_id'])
    assert quote['source_url']=='https://nasa.gov/test-enrichment'
    assert quote['page_number']=='1' and quote['evidence_text']=='Vitamin D is a supplement.'
    second=enrich(tmp_path,provider=provider)
    assert provider.calls==1 and second['latest_run']['jobs_skipped']==1
    assert len(csv_rows(tmp_path,'evidence/knowledge_claims.csv'))==len(claims)


def test_attribute_approval_does_not_approve_base_entity(tmp_path):
    seed(tmp_path); enrich(tmp_path,provider=FakeLocal())
    record=read_json(next((tmp_path/'staging/enrichment/candidates').glob('*.json')))
    save_review(tmp_path,record,'approved')
    assert not csv_rows(tmp_path,'entities/treatments.csv',approved=True)


def test_pending_attribute_does_not_leak_into_approved_export(tmp_path):
    seed(tmp_path,approved=True); enrich(tmp_path,provider=FakeLocal())
    assert csv_rows(tmp_path,'entities/treatments.csv',approved=True)[0]['treatment_type']==''
    assert csv_rows(tmp_path,'entities/treatments.csv')[0]['review_status']=='pending'
    record=read_json(next((tmp_path/'staging/enrichment/candidates').glob('*.json')))
    save_review(tmp_path,record,'approved')
    assert csv_rows(tmp_path,'entities/treatments.csv',approved=True)[0]['treatment_type']=='supplement'


@pytest.mark.parametrize('changes,reason',[
    ({'entity_id':'unknown'},'unknown_entity'),
    ({'field':'canonical_name'},'field_not_requested'),
    ({'field':'body_system'},'field_not_requested'),
    ({'evidence_text':'This quotation is fabricated.'},'missing_chunk_evidence'),
    ({'value':'medication'},'value_not_verbatim_in_evidence'),
    ({'value':False},'text_attribute_requires_nonempty_string'),
])
def test_invalid_candidates_are_rejected_independently(tmp_path,changes,reason):
    eid,_=seed(tmp_path); job,catalog=first_job(tmp_path)
    good={'entity_id':eid,'field':'treatment_type','value':'supplement','evidence_text':'Vitamin D is a supplement.'}
    accepted,rejected,count=parse_candidates(json.dumps({'additions':[good,{**good,**changes}]}),job,catalog)
    assert len(accepted)==1 and count==2
    assert reason in rejected[0]['reason']


def test_null_and_invented_approval_do_not_fill_fields(tmp_path):
    eid,_=seed(tmp_path);job,catalog=first_job(tmp_path)
    raw={'additions':[{'entity_id':eid,'field':'description','value':None,'evidence_text':TEXT},
        {'entity_id':eid,'field':'evidence_status','value':'approved_protocol','evidence_text':TEXT}]}
    accepted,rejected,_=parse_candidates(json.dumps(raw),job,catalog)
    assert not accepted and len(rejected)==1


@pytest.mark.parametrize('phrase,value,valid',[
    ('Vitamin D requires medical supervision.',True,True),
    ('Vitamin D does not require medical supervision.',False,True),
    ('Vitamin D does not require medical supervision.',True,False),
    ('Vitamin D requires medical supervision.',False,False),
    ('It is unclear whether Vitamin D requires medical supervision.',True,False),
    ('Vitamin D is a supplement.',False,False),
])
def test_supervision_requires_explicit_boolean_statement(tmp_path,phrase,value,valid):
    eid,_=seed(tmp_path,text=phrase);job,catalog=first_job(tmp_path)
    record={'entity_id':eid,'field':'requires_medical_supervision','value':value,'evidence_text':phrase}
    if valid: assert validate_candidate(record,job,catalog).value is value
    else:
        with pytest.raises(ValueError): validate_candidate(record,job,catalog)


def test_original_page_match_required(tmp_path):
    eid,_=seed(tmp_path);job,catalog=first_job(tmp_path)
    job['original_page_text']='Another page without the quote.'
    with pytest.raises(ValueError,match='missing_document_evidence'):
        validate_candidate({'entity_id':eid,'field':'treatment_type','value':'supplement','evidence_text':'Vitamin D is a supplement.'},job,catalog)


def test_existing_values_and_false_are_preserved():
    current={'treatment_id':'t','canonical_name':'Test','description':None,'treatment_type':'medication','requires_medical_supervision':False,'review_status':'approved'}
    conflicts=[]
    merge_entity('entities/treatments',current,{'description':'Source description','treatment_type':'supplement','requires_medical_supervision':True,'review_status':'pending'},conflicts)
    assert current['description']=='Source description' and current['treatment_type']=='medication'
    assert current['requires_medical_supervision'] is False and current['review_status']=='pending'
    assert len(conflicts)==2


def test_conflicting_values_leave_blank_until_reviewed_choice(tmp_path):
    text=TEXT+' Vitamin D is described as a medication in this test passage.'
    seed(tmp_path,text=text);enrich(tmp_path,provider=FakeLocal())
    job,catalog=first_job(tmp_path);eid=next(iter(catalog))
    candidate=validate_candidate({'entity_id':eid,'field':'treatment_type','value':'medication','evidence_text':'Vitamin D is described as a medication in this test passage.'},job,catalog)
    record=candidate_record(candidate,job)
    atomic_json(tmp_path/'staging/enrichment/candidates'/f"{record['candidate_id']}.json",record)
    assert csv_rows(tmp_path,'entities/treatments.csv')[0]['treatment_type']==''
    save_review(tmp_path,record,'approved')
    assert csv_rows(tmp_path,'entities/treatments.csv')[0]['treatment_type']=='medication'


def test_review_edit_is_revalidated_and_stays_pending(tmp_path):
    seed(tmp_path);enrich(tmp_path,provider=FakeLocal())
    record=read_json(next((tmp_path/'staging/enrichment/candidates').glob('*.json')))
    edited={k:record[k] for k in ('entity_id','field','value','evidence_text')}
    edited.update(field='route_of_administration',value='orally',evidence_text='Vitamin D is taken orally.')
    result=save_review(tmp_path,record,'edit',edited)
    assert result['review_status']=='pending'
    assert csv_rows(tmp_path,'entities/treatments.csv')[0]['route_of_administration']=='orally'
    edited['value']='intravenous'
    with pytest.raises(ValueError): save_review(tmp_path,record,'edit',edited)


def test_failed_and_interrupted_jobs_resume_without_duplicate_candidates(tmp_path):
    seed(tmp_path)
    provider=FakeLocal()
    def broken(text,targets): raise KeyboardInterrupt()
    provider.extract_attributes=broken
    with pytest.raises(KeyboardInterrupt): enrich(tmp_path,provider=provider)
    result=enrich(tmp_path,provider=FakeLocal())
    assert result['latest_run']['requests_succeeded']==1
    assert len(list((tmp_path/'staging/enrichment/candidates').glob('*.json')))==1


def test_request_limit_and_not_searched_reporting(tmp_path):
    seed(tmp_path,text=TEXT+' '+('Additional source context. '*100)+' '+TEXT)
    result=enrich(tmp_path,provider=FakeLocal(),max_requests=1)
    assert result['latest_run']['requests_attempted']==1
    assert result['latest_run']['remaining_jobs']>0
    assert result['latest_run']['status']=='pilot_complete'
    assert result['fields_not_found_in_examined_passages']>0


def test_cache_invalidated_by_model_and_source(tmp_path):
    seed(tmp_path); first,_=first_job(tmp_path)
    provider=FakeLocal();provider.model='different-model'
    changed,_=first_job(tmp_path,provider)
    assert first['job_id']!=changed['job_id']
    doc=read_json(tmp_path/'cache/source.json');doc['pages'][0]['text']+=' More source facts.'
    atomic_json(tmp_path/'cache/source.json',doc)
    changed,_=first_job(tmp_path)
    assert first['job_id']!=changed['job_id']


def test_existing_later_row_fills_empty_exported_cell(tmp_path):
    seed(tmp_path)
    batch=read_json(tmp_path/'staging/extracted/original.json')
    row=batch['tables']['entities/treatments'][0]
    row['treatment_type']='supplement'
    atomic_json(tmp_path/'staging/extracted/z_later.json',batch)
    assert csv_rows(tmp_path,'entities/treatments.csv')[0]['treatment_type']=='supplement'


def test_missing_value_placeholders_are_omitted(tmp_path):
    eid,_=seed(tmp_path);job,catalog=first_job(tmp_path)
    candidate={'entity_id':eid,'field':'description','value':'not reported','evidence_text':'Vitamin D is a supplement.'}
    assert validate_candidate(candidate,job,catalog) is None


def test_export_revalidates_staged_quotes(tmp_path):
    seed(tmp_path);enrich(tmp_path,provider=FakeLocal())
    path=next((tmp_path/'staging/enrichment/candidates').glob('*.json'))
    record=read_json(path);record['evidence_text']='A fabricated quotation that is not in the page.'
    atomic_json(path,record)
    assert csv_rows(tmp_path,'entities/treatments.csv')[0]['treatment_type']==''
    manifest=read_json(tmp_path/'DB/draft/export_manifest.json')
    assert len(manifest['enrichment_audit']['invalid_staged_records'])==1


def test_malformed_ids_do_not_break_report(tmp_path):
    seed(tmp_path)
    provider=FakeLocal()
    provider.extract_attributes=lambda text,targets: json.dumps({'additions':[{'entity_id':[],'field':{},'value':False,'evidence_text':text}]})
    result=enrich(tmp_path,provider=provider)
    assert result['rejection_reasons']=={'invalid_schema':1}


def test_biomarker_units_methods_frequency_and_device_are_extractive(tmp_path):
    text='Blood pressure is measured with a cuff in mmHg every day.'
    source={'source_id':'s','source_url':'https://nasa.gov/test-measurement','fetch_status':'success','cache_path':'cache/s.json'}
    chunk={'chunk_id':'original','page_number':None,'section':None,'text_location':'characters 0:55','text':text}
    result=Extraction.model_validate({'source_type':'measurement_description','entities':[{'local_id':'b','entity_type':'biomarkers','canonical_name':'Blood pressure','evidence_text':text}]})
    batch=materialize(result,source,chunk,EntityResolver(tmp_path/'staging/entity_registry.json'))
    atomic_json(tmp_path/'staging/extracted/original.json',batch)
    atomic_json(tmp_path/'staging/sources/manifest.json',{'s':source})
    atomic_json(tmp_path/'cache/s.json',{'source_id':'s','source_url':source['source_url'],'pages':[{'page_number':None,'text':text}]})
    values={'unit':'mmHg','measurement_method':'measured with a cuff','measurement_frequency':'every day','monitoring_device':'a cuff'}
    provider=FakeLocal()
    def output(text,targets):
        records=[{'entity_id':targets[0]['entity_id'],'field':field,'value':value,'evidence_text':text} for field,value in values.items()]
        records.extend([{'entity_id':targets[0]['entity_id'],'field':'unit','value':'MMHG','evidence_text':text},
                        {'entity_id':targets[0]['entity_id'],'field':'measurement_frequency','value':'daily','evidence_text':text}])
        return json.dumps({'additions':records})
    provider.extract_attributes=output
    report=enrich(tmp_path,provider=provider)
    assert report['latest_run']['fields_accepted']==4
    assert report['latest_run']['fields_rejected']==2
    row=csv_rows(tmp_path,'entities/biomarkers.csv')[0]
    assert all(row[field]==value for field,value in values.items())
    claims=csv_rows(tmp_path,'evidence/knowledge_claims.csv')
    assert len([c for c in claims if c['predicate']=='has_attribute'])==4


def test_quote_from_another_entity_is_not_an_attribute(tmp_path):
    text=TEXT+' The crew receives training in spacecraft systems.'
    eid,_=seed(tmp_path,text=text);job,catalog=first_job(tmp_path)
    with pytest.raises(ValueError,match='entity_not_anchored_in_evidence'):
        validate_candidate({'entity_id':eid,'field':'treatment_type','value':'training','evidence_text':'The crew receives training in spacecraft systems.'},job,catalog)


def test_attribution_accepts_acronym_plurals_but_not_generic_space_context():
    from knowledge_ingestion.enrichment.schema import entity_anchored_in_quote
    assert entity_anchored_in_quote('Light-emitting diodes, or LEDs, simulate light-dark cycles.',['LED light simulation'])
    assert not entity_anchored_in_quote('A spacecraft for deep space can operate at lower pressures.',['variable pressure space suits'])
