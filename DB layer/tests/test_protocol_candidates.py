from copy import deepcopy
import csv
from pathlib import Path
import pytest
from knowledge_ingestion.storage import SCHEMAS, atomic_json, read_json, write_csv
from knowledge_ingestion.pipeline import export
from knowledge_ingestion.protocol_candidates import build_candidates, populate, snapshot, TABLE
from knowledge_ingestion.queries import KnowledgeBase

QUOTE = 'Synthetic crew practice synthetic exercise during a simulated mission.'


def record(table, **values):
    return {key:values.get(key, '') for key in SCHEMAS[table].split()}


@pytest.fixture
def scenario(tmp_path):
    source = record('metadata/sources', source_id='s', source_url='https://example.test/source', title='Synthetic source',
                    source_type='research_summary', fetch_status='success', review_status='pending')
    tables = {
        'entities/conditions':[record('entities/conditions', condition_id='c', canonical_name='Synthetic condition', review_status='pending')],
        'entities/treatments':[record('entities/treatments', treatment_id='t', canonical_name='Synthetic exercise', review_status='pending')],
        'evidence/evidence':[record('evidence/evidence', evidence_id='e', source_id='s', source_url=source['source_url'],
                                   chunk_id='chunk', evidence_text=QUOTE, verification_status='exact_match', review_status='pending')],
        'evidence/knowledge_claims':[record('evidence/knowledge_claims', claim_id='claim', subject_entity_id='c', object_entity_id='t',
                                           predicate='countermeasure_for', claim_text=QUOTE, source_id='s', evidence_id='e', review_status='pending')],
        'relations/condition_treatment':[record('relations/condition_treatment', relation_id='r', source_entity_id='c',
                                               target_entity_id='t', relationship_type='countermeasure_for', claim_id='claim', review_status='pending')],
    }
    atomic_json(tmp_path/'staging/sources/manifest.json', {'s':source})
    atomic_json(tmp_path/'staging/extracted/base.json', {'source_id':'s', 'source_type':'research_summary',
        'chunk':{'chunk_id':'chunk','text':QUOTE,'page_number':None,'section':'Synthetic','text_location':'Synthetic fixture'},
        'tables':tables, 'raw_extraction':{}, 'rejected':[]})
    spec = {'version':'synthetic-test-v1', 'candidates':[{'relation_id':'r','expected_evidence':QUOTE,
              'fields':{'required_conditions':'during a simulated mission'}}]}
    export(tmp_path, draft=True)
    export(tmp_path, draft=False)
    return tmp_path, spec


def change_csv(root, table, mutate):
    from knowledge_ingestion.protocol_candidates import rows
    data = rows(root, table)
    mutate(data)
    write_csv(root/'DB/draft'/(table+'.csv'), SCHEMAS[table].split(), data)


def test_documented_fields_pending_and_traceable(scenario):
    root, spec = scenario
    generated, audit = build_candidates(root, spec)
    assert audit['accepted_count'] == 1
    candidate = generated[0][1]['tables'][TABLE][0]
    assert candidate['review_status'] == 'pending'
    assert candidate['indication'] == QUOTE
    assert candidate['required_conditions'] == 'during a simulated mission'
    assert candidate['dosage'] == candidate['frequency'] == candidate['duration'] == candidate['contraindications'] == ''
    assert (candidate['related_condition_id'], candidate['treatment_id'], candidate['evidence_id'], candidate['source_id']) == ('c','t','e','s')
    assert not audit['clinical_authorization']
    from knowledge_ingestion.extraction import Extraction
    assert Extraction.model_validate(generated[0][1]['raw_extraction']).interventions


def test_dry_run_does_not_mutate(scenario):
    root, spec = scenario
    before = snapshot(root)
    result = populate(root, specification=spec)
    assert result['mode'] == 'dry_run'
    assert snapshot(root) == before


def test_export_repeatability_and_approved_isolation(scenario):
    root, spec = scenario
    before = snapshot(root/'DB/draft')
    protected = snapshot(root/'DB/approved')
    first = populate(root, apply=True, specification=spec)
    assert first['created_staging_batches'] == 1 and first['repeat_export_verified']
    assert first['csv_changes'] == [TABLE+'.csv']
    after = snapshot(root/'DB/draft')
    second = populate(root, apply=True, specification=spec)
    assert second['created_staging_batches'] == 0
    assert snapshot(root/'DB/approved') == protected
    assert all(content == after[name] for name,content in before.items() if name.endswith('.csv') and name != TABLE+'.csv')
    export(root, draft=True)
    repeated = snapshot(root/'DB/draft')
    assert all(repeated[name] == content for name,content in after.items() if name.endswith('.csv'))
    export(root, draft=False)
    assert not KnowledgeBase(root/'DB/approved').get_approved_protocols('c')
    from knowledge_ingestion.protocol_candidates import rows
    assert len(rows(root, TABLE)) == 1


@pytest.mark.parametrize('table,field,value,reason', [
    ('relations/condition_treatment','target_entity_id','missing','Missing condition'),
    ('relations/condition_treatment','claim_id','missing','Missing condition'),
    ('evidence/knowledge_claims','object_entity_id','missing','Claim endpoints'),
    ('evidence/knowledge_claims','evidence_id','missing','Missing or inconsistent'),
    ('evidence/evidence','source_id','wrong','Missing or inconsistent'),
    ('evidence/evidence','verification_status','unknown','exact-match'),
    ('evidence/evidence','review_status','rejected','review status'),
    ('metadata/sources','fetch_status','failed','successfully fetched'),
    ('evidence/knowledge_claims','evidence_status','investigational','investigational'),
    ('metadata/sources','source_url','','source URL'),
    ('evidence/evidence','evidence_text','Changed excerpt','Evidence changed'),
])
def test_broken_unsupported_or_rejected_dependencies_excluded(scenario, table, field, value, reason):
    root, spec = scenario
    change_csv(root, table, lambda data:data[0].update({field:value}))
    generated, audit = build_candidates(root, spec)
    assert not generated and reason in audit['excluded'][0]['reason']


def test_investigational_relationship_never_candidate(scenario):
    root, spec = scenario
    change_csv(root, 'relations/condition_treatment', lambda data:data[0].update(relationship_type='investigated_for'))
    generated, audit = build_candidates(root, spec)
    assert not generated and 'Investigational-only' in audit['excluded'][0]['reason']


def test_unknown_relation_not_automatically_promoted(scenario):
    root, spec = scenario
    spec['candidates'] = []
    generated, audit = build_candidates(root, spec)
    assert not generated and 'explicitly curated' in audit['excluded'][0]['reason']


def test_unsupported_field_text_not_inferred(scenario):
    root, spec = scenario
    spec['candidates'][0]['fields']['frequency'] = 'twice daily'
    generated, audit = build_candidates(root, spec)
    assert not generated and 'verbatim' in audit['excluded'][0]['reason']


def test_duplicate_relationships_deduplicated(scenario):
    root, spec = scenario
    def duplicate(data):
        data.append({**data[0], 'relation_id':'r-duplicate'})
    change_csv(root, 'relations/condition_treatment', duplicate)
    spec['candidates'].append({**deepcopy(spec['candidates'][0]), 'relation_id':'r-duplicate'})
    generated, audit = build_candidates(root, spec)
    assert len(generated) == 1 and 'Duplicate candidate' in audit['excluded'][0]['reason']


def test_unrelated_export_drift_aborts_without_changes(scenario):
    root, spec = scenario
    change_csv(root, 'entities/conditions', lambda data:data[0].update(description='Manually changed draft value'))
    before = snapshot(root)
    with pytest.raises(ValueError, match='unrelated tables'):
        populate(root, apply=True, specification=spec)
    assert snapshot(root) == before


def test_review_decisions_are_not_overwritten(scenario):
    root, spec = scenario
    populate(root, apply=True, specification=spec)
    path = next((root/'staging/extracted').glob('protocol_candidate_*.json'))
    reviewed = read_json(path)
    reviewed['tables'][TABLE][0]['review_status'] = 'rejected'
    atomic_json(root/'staging/reviewed'/path.name, reviewed)
    export(root, draft=True)
    result = populate(root, apply=True, specification=spec)
    assert result['accepted'][0]['exported_review_status'] == 'excluded_by_existing_review'
    assert read_json(root/'staging/reviewed'/path.name) == reviewed


def test_modified_generated_batch_not_overwritten(scenario):
    root, spec = scenario
    populate(root, apply=True, specification=spec)
    path = next((root/'staging/extracted').glob('protocol_candidate_*.json'))
    changed = read_json(path)
    changed['source_limitations'] = 'Human edit to preserve'
    atomic_json(path, changed)
    before = snapshot(root)
    with pytest.raises(ValueError, match='preserved for explicit review'):
        populate(root, apply=True, specification=spec)
    assert snapshot(root) == before


def test_pending_candidates_cannot_enter_recommendation_approved_action_path(scenario):
    import sys
    from types import SimpleNamespace
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]/'Recommendation_agent'))
    from health_agent.knowledge import KnowledgeTools
    root, spec = scenario
    populate(root, apply=True, specification=spec)
    from knowledge_ingestion.protocol_candidates import rows
    candidate = rows(root, TABLE)[0]
    policy = dict(protocol_id=candidate['protocol_id'], title='Synthetic support', allowed_action='Synthetic monitoring only',
        category='monitoring', risk_ids=['c'], environment_ids=['sim'], required_profile={}, contraindications=[],
        restrictions_reviewed=True, required_monitoring='Synthetic monitoring', escalation_conditions='Synthetic only',
        authorization_required=False, authorized_by='FICTIONAL_REVIEWER', authorized_at='2026-01-01T00:00:00+00:00', review_status='approved')
    tools = KnowledgeTools(root/'DB/draft', {'version':'synthetic-test', 'rules':[], 'protocol_policies':[policy]})
    tools.clinical_kb = KnowledgeBase(root/'DB/approved')
    result = tools.retrieve_protocol([SimpleNamespace(risk_id='c', severity='yellow')],
        {'restrictions':[], 'restrictions_complete':True}, {'environment_id':'sim'})
    assert result['protocols'] == []
    assert candidate['review_status'] == 'pending'
