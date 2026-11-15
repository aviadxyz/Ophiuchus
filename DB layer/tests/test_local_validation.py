import json
import pytest
from pydantic import ValidationError
from knowledge_ingestion.extraction.local_validation import validate_local_output
from knowledge_ingestion.extraction import Extraction
from knowledge_ingestion.pipeline import materialize
from knowledge_ingestion.normalization import EntityResolver

def payload():
    quote='Microgravity is associated with bone loss.'
    return {'source_type':'hazard_overview','entities':[
        {'local_id':'r','entity_type':'risk_factors','canonical_name':'Microgravity','evidence_text':quote},
        {'local_id':'c','entity_type':'conditions','canonical_name':'Bone loss','evidence_text':quote}],
        'claims':[{'subject':'r','object':'c','predicate':'associated_with','claim_text':quote,'evidence_text':quote}],
        'monitoring':[{'biomarker':'r','condition':'c','evidence_text':quote}]}

def test_bad_monitoring_does_not_discard_valid_claims():
    result,rejected=validate_local_output(json.dumps(payload()))
    assert len(result.entities)==2 and len(result.claims)==1
    assert result.monitoring==[]
    assert rejected[0]['group']=='monitoring'
    assert rejected[0]['reason']=='invalid_entity_reference'
    assert rejected[0]['record']['biomarker']=='r'
    assert Extraction.model_validate(result)==result

def test_duplicate_ids_and_dangling_claims_rejected():
    raw=payload(); raw['entities'].append(raw['entities'][0].copy())
    result,rejected=validate_local_output(json.dumps(raw))
    assert [e.local_id for e in result.entities]==['c']
    assert result.claims==[] and result.monitoring==[]
    assert sum(r['reason']=='duplicate_entity_local_id' for r in rejected)==2

def test_bad_row_shape_and_top_level_stays_strict():
    raw=payload(); raw['entities'].append({'invented_field':True})
    result,rejected=validate_local_output(json.dumps(raw))
    assert len(result.entities)==2
    assert any(r['reason']=='invalid_structured_record' for r in rejected)
    raw['source_type']='invented'
    with pytest.raises(ValidationError): validate_local_output(json.dumps(raw))
    raw=payload(); raw['monitoring']='invalid list'
    with pytest.raises(ValidationError): validate_local_output(json.dumps(raw))

def test_partial_acceptance_still_checks_exact_evidence(tmp_path):
    raw=payload(); raw['claims'][0]['evidence_text']='This is a fabricated quotation.'
    result,rejected=validate_local_output(json.dumps(raw))
    batch=materialize(result,{'source_id':'s','source_url':'https://nasa.gov/test'},
        {'chunk_id':'ch','page_number':None,'section':None,'text_location':'characters 0:41','text':raw['entities'][0]['evidence_text']},EntityResolver(tmp_path/'ids.json'))
    assert 'relations/risk_condition' not in batch['tables']
    assert any(r['reason']=='missing_exact_evidence' for r in batch['rejected'])
