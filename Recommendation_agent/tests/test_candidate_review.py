import json
from copy import deepcopy
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from health_agent.agent import PreventiveHealthAgent
from health_agent.knowledge import KnowledgeTools
from health_agent.storage import HealthStore
from health_agent.models import AssessmentRequest, LLMSelection, now
from health_agent.demo import write_csv as _write_csv, build_demo
from health_agent.candidates import CandidateRetriever
from health_agent.api import create_app
from health_agent.candidate_demo import build_example


def write_csv(root, table, data):
    if data:
        _write_csv(root, table, data)


class Selection:
    model = 'synthetic-model'
    def __init__(self):
        self.calls = []
    def select(self, candidates, findings):
        self.calls.append(candidates)
        return LLMSelection(protocol_ids=[c['protocol_id'] for c in candidates[:5]])


def request():
    return AssessmentRequest(astronaut_id='demo', request_id='r1', measurements=[dict(
        measurement_id='m1', astronaut_id='demo', metric='sleep_duration', value=5.8, unit='hours',
        timestamp=now().isoformat(), source='synthetic-device')])


def seed(root, count=1):
    root = Path(root)
    write_csv(root, 'entities/conditions', [dict(condition_id='c1', canonical_name='Synthetic condition', review_status='pending')])
    write_csv(root, 'entities/treatments', [dict(treatment_id=f't{i}', canonical_name=f'Synthetic practice {i}',
        medication_or_supplement='', treatment_type='', evidence_status='unknown', review_status='pending') for i in range(count)])
    write_csv(root, 'entities/environments', [dict(environment_id='env', canonical_name='Synthetic station', review_status='pending')])
    write_csv(root, 'entities/biomarkers', [dict(biomarker_id='b1', canonical_name='Synthetic sleep biomarker', review_status='pending')])
    write_csv(root, 'evidence/evidence', [dict(evidence_id='e1', source_id='s1', source_url='https://example.test/research',
        evidence_text='Synthetic research describes a practice.', verification_status='exact_match', review_status='pending')])
    write_csv(root, 'metadata/sources', [dict(source_id='s1', title='Synthetic research source', source_url='https://example.test/research', fetch_status='success', review_status='pending')])
    write_csv(root, 'evidence/knowledge_claims', [dict(claim_id=f'claim{i}', subject_entity_id='c1', object_entity_id=f't{i}',
        predicate='countermeasure_for', source_id='s1', evidence_id='e1', claim_text='Synthetic research describes a practice.',
        evidence_status='unknown', study_population='synthetic', limitations='Synthetic fixture', review_status='pending') for i in range(count)])
    write_csv(root, 'relations/condition_treatment', [dict(relation_id=f'relation{i}', source_entity_id='c1', target_entity_id=f't{i}',
        relationship_type='countermeasure_for', claim_id=f'claim{i}', review_status='pending') for i in range(count)])
    if count:
        write_csv(root, 'protocols/candidate_protocols', [dict(protocol_id=f'p{i}', related_condition_id='c1', treatment_id=f't{i}',
            indication='Synthetic research describes a practice.', required_conditions='during mission', contraindications='',
            dosage='DO NOT EXPOSE', frequency='DO NOT EXPOSE', duration='DO NOT EXPOSE', source_id='s1', evidence_id='e1', review_status='pending') for i in range(count)])
    return dict(version='synthetic-context-v1', metric_biomarker_ids={}, protocols={f'p{i}':dict(expected_evidence_id='e1',
        required_conditions='during mission', required_profile={'mission_phase':'in_mission'}, environment_ids=['env']) for i in range(count)})


def build(tmp_path, count=1):
    config = seed(tmp_path/'draft', count)
    store = HealthStore(tmp_path/'health.sqlite3')
    store.provision('demo', dict(synthetic=True, mission_id='mission', environment_id='env',
                                 mission_phase='in_mission', condition_ids=['c1']))
    model = Selection()
    agent = PreventiveHealthAgent(store, KnowledgeTools(tmp_path/'draft'), model,
                                 protocol_mode='candidate_review', candidate_config=config)
    return agent, model


def change(agent, table, update):
    data = agent.knowledge.rows(table)
    update(data)
    write_csv(agent.knowledge.root, table, data)


def profile(agent, **updates):
    previous = agent.store.get_health_history('demo', {'demo'})['profile']
    agent.store.provision('demo', {**previous, **updates})


def test_recorded_condition_review_only_persisted_traceability(tmp_path):
    agent, model = build(tmp_path)
    req = request()
    result = agent.assess(req, {'demo'})
    assert len(result.recommendations) == 1 and result.protocol_mode == 'candidate_review'
    r = result.recommendations[0]
    assert r.status == 'requires_review' and r.requires_medical_approval
    assert r.severity == 'undetermined' and result.risk_level == 'undetermined'
    assert result.assessment_status == 'medical_review_required'
    assert r.protocol_origin == 'draft_candidate' and r.protocol_review_status == 'pending'
    assert r.matching_condition_ids == ['c1'] and r.matching_relation_ids == ['relation0']
    assert r.supporting_metric_ids == [] and r.related_risk_ids == []
    assert r.frequency_label is None and r.recheck_time is None
    assert 'DO NOT EXPOSE' not in r.model_dump_json()
    assert 'DO NOT EXPOSE' not in json.dumps(model.calls)
    evidence = agent.store.recommendation_evidence(r.recommendation_id, {'demo'})
    assert evidence[0]['research_only'] and evidence[0]['review_status'] == 'pending'
    assert evidence[0]['source_url'] == 'https://example.test/research'
    assert agent.assess(req, {'demo'}) == result
    assert agent.store.latest('demo', {'demo'}) == result
    with agent.store.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM recommendations').fetchone()[0] == 1


@pytest.mark.parametrize('update', [dict(condition_ids=[]), dict(condition_ids=['unknown']), dict(condition_ids='c1'),
    dict(mission_id=None), dict(environment_id='unknown'), dict(mission_phase='preflight')])
def test_missing_personal_or_mission_match_returns_zero(tmp_path, update):
    agent, model = build(tmp_path)
    profile(agent, **update)
    result = agent.assess(request(), {'demo'})
    assert result.recommendations == [] and model.calls == []


def test_client_cannot_set_trusted_conditions_or_mission_context(tmp_path):
    agent, model = build(tmp_path)
    profile(agent, condition_ids=[], mission_phase='preflight')
    req = request()
    req.mission_context = dict(condition_ids=['c1'], mission_phase='in_mission', environment_id='env')
    assert agent.assess(req, {'demo'}).recommendations == []


@pytest.mark.parametrize('table,field,value', [
    ('protocols/candidate_protocols','review_status','rejected'),
    ('entities/conditions','review_status','rejected'),
    ('entities/treatments','review_status','rejected'),
    ('relations/condition_treatment','review_status','rejected'),
    ('evidence/knowledge_claims','review_status','rejected'),
    ('evidence/evidence','review_status','rejected'),
    ('metadata/sources','review_status','rejected'),
    ('metadata/sources','source_url','javascript:invalid'),
    ('protocols/candidate_protocols','evidence_id','missing'),
    ('protocols/candidate_protocols','required_conditions','Changed unsupported conditions'),
    ('protocols/candidate_protocols','indication','Invented clinical claim'),
    ('evidence/evidence','verification_status','unknown'),
    ('evidence/knowledge_claims','object_entity_id','missing'),
    ('evidence/knowledge_claims','evidence_status','investigational'),
    ('protocols/candidate_protocols','contraindications','Undecoded restrictions'),
    ('entities/treatments','medication_or_supplement','supplement'),
    ('entities/treatments','treatment_type','medication'),
])
def test_inconsistent_rejected_or_medication_candidates_excluded(tmp_path, table, field, value):
    agent, model = build(tmp_path)
    change(agent, table, lambda rows:rows[0].update({field:value}))
    assert agent.assess(request(), {'demo'}).recommendations == []


def add_biomarker_link(agent):
    data = agent.knowledge.rows('evidence/knowledge_claims')
    data.append(dict(claim_id='bioclaim', subject_entity_id='c1', object_entity_id='b1', predicate='monitored_by',
        source_id='s1', evidence_id='e1', claim_text='Synthetic research describes a practice.', evidence_status='unknown',
        study_population='synthetic', limitations='Synthetic fixture', review_status='pending'))
    write_csv(agent.knowledge.root, 'evidence/knowledge_claims', data)
    write_csv(agent.knowledge.root, 'relations/condition_biomarker', [dict(relation_id='biorelation', source_entity_id='c1',
        target_entity_id='b1', relationship_type='monitored_by', claim_id='bioclaim', review_status='pending')])


def test_measurement_path_requires_explicit_mapping_and_actual_csv_link(tmp_path):
    agent, model = build(tmp_path)
    profile(agent, condition_ids=[])
    agent.candidate_retriever.config.metric_biomarker_ids = {'sleep_duration':['b1']}
    req = request()
    first = agent.assess(req, {'demo'})
    assert not first.recommendations
    add_biomarker_link(agent)
    req.request_id = 'r2'
    result = agent.assess(req, {'demo'})
    r = result.recommendations[0]
    assert r.supporting_metric_ids == ['m1'] and 'biorelation' in r.matching_relation_ids
    assert r.severity == 'undetermined' and result.risk_level == 'undetermined'


def test_actual_csv_link_without_explicit_metric_mapping_is_not_enough(tmp_path):
    agent, model = build(tmp_path)
    profile(agent, condition_ids=[])
    add_biomarker_link(agent)
    assert agent.assess(request(), {'demo'}).recommendations == []


@pytest.mark.parametrize('count,expected', [(0,0), (1,1), (7,5)])
def test_candidate_limits(tmp_path, count, expected):
    agent, model = build(tmp_path, count)
    assert len(agent.assess(request(), {'demo'}).recommendations) == expected


def test_duplicate_treatment_records_are_removed(tmp_path):
    agent, model = build(tmp_path)
    data = agent.knowledge.rows('protocols/candidate_protocols')
    data.append({**data[0], 'protocol_id':'p-other'})
    write_csv(agent.knowledge.root, 'protocols/candidate_protocols', data)
    agent.candidate_retriever.config.protocols['p-other'] = agent.candidate_retriever.config.protocols['p0']
    assert len(agent.assess(request(), {'demo'}).recommendations) == 1


@pytest.mark.parametrize('output', [{'protocol_ids':['invented']}, {'protocol_ids':['p0','p0']}, {'not_valid':[]}])
def test_invalid_model_selection_returns_incomplete(tmp_path, output):
    agent, model = build(tmp_path)
    model.select = lambda *a:output
    result = agent.assess(request(), {'demo'})
    assert result.assessment_status == 'incomplete' and result.recommendations == [] and result.findings


def test_ollama_outage_preserves_findings_without_fabricating_cards(tmp_path):
    agent, model = build(tmp_path)
    model.select = lambda *a:(_ for _ in ()).throw(ConnectionError())
    result = agent.assess(request(), {'demo'})
    assert result.assessment_status == 'incomplete' and not result.recommendations


def test_invalid_input_does_not_render_candidates(tmp_path):
    agent, model = build(tmp_path)
    req = request()
    req.measurements[0]['unit'] = 'invalid'
    result = agent.assess(req, {'demo'})
    assert result.assessment_status == 'invalid_input' and result.recommendations == []


def test_approved_escalation_takes_precedence_even_in_candidate_mode(tmp_path):
    class Broken:
        model = 'offline'
        def select(self, *args):
            pytest.fail('Model must not delay approved urgent escalation')
    demo = build_demo(tmp_path/'old', category='escalation', severity='red', llm=Broken())
    demo.protocol_mode = 'candidate_review'
    from health_agent.demo import make_request
    result = demo.assess(make_request(), {'DEMO_ASTRONAUT'})
    assert result.escalation_required and result.recommendations[0].status == 'escalation'
    assert result.recommendations[0].protocol_origin == 'approved_protocol'


def test_agent_and_api_defaults_use_candidate_review(tmp_path, monkeypatch):
    agent, model = build(tmp_path)
    other = PreventiveHealthAgent(agent.store, agent.knowledge, model, candidate_config=agent.candidate_retriever.config.model_dump())
    assert other.protocol_mode == 'candidate_review'
    assert other.assess(request(), {'demo'}).recommendations[0].status == 'requires_review'
    monkeypatch.setenv('HEALTH_DB_PATH', str(tmp_path/'api.sqlite3'))
    monkeypatch.delenv('HEALTH_PROTOCOL_MODE', raising=False)
    monkeypatch.delenv('HEALTH_KNOWLEDGE_MODE', raising=False)
    monkeypatch.delenv('HEALTH_GOVERNANCE_FILE', raising=False)
    from health_agent import api
    captured = []
    original = api.PreventiveHealthAgent
    def capture(*args, **kwargs):
        instance = original(*args, **kwargs)
        captured.append(instance)
        return instance
    monkeypatch.setattr(api, 'PreventiveHealthAgent', capture)
    create_app(tokens={})
    assert captured[0].protocol_mode == 'candidate_review'
    monkeypatch.setenv('HEALTH_PROTOCOL_MODE', 'approved')
    create_app(tokens={})
    assert captured[-1].protocol_mode == 'approved'


def test_api_review_fields_and_astronaut_auth(tmp_path):
    agent, model = build(tmp_path)
    client = TestClient(create_app(agent, {'demo-token':['demo'], 'other-token':['other']}))
    headers = {'Authorization':'Bearer demo-token'}
    result = client.post('/api/health/assess', json=request().model_dump(mode='json'), headers=headers)
    assert result.status_code == 200
    rec = result.json()['recommendations'][0]
    assert rec['status'] == 'requires_review' and rec['protocol_origin'] == 'draft_candidate'
    sources = client.get(f"/api/recommendations/{rec['recommendation_id']}/evidence", headers=headers).json()['evidence']
    assert sources[0]['research_only']
    assert client.get('/api/astronauts/demo/recommendations', headers={'Authorization':'Bearer other-token'}).status_code == 403


def test_actual_draft_demo_has_one_condition_matched_review_card(tmp_path):
    result = build_example(tmp_path)
    r = result.recommendations[0]
    assert r.protocol_id == 'protocol_73dd2a0c0981099ec8c1'
    assert r.protocol_origin == 'draft_candidate' and r.status == 'requires_review'
    assert r.source_links[0].startswith('https://www.nasa.gov/')


@pytest.mark.parametrize('phase,activity,gravity,excluded', [
    ('in_mission', None, 'microgravity', ['protocol_d66679d9bb707e52af94','protocol_cb33d7de4d12833a59af','protocol_93fb50df7e4b6d35e8cd','protocol_805036b8c4327dec7e05']),
    ('preflight', None, None, ['protocol_4a0ac4cd039b20a57999','protocol_0e36a7999e9570c2f4bb','protocol_ba6f6133aeb353fe3f75','protocol_805036b8c4327dec7e05']),
    ('in_mission', 'spacewalk_preparation', None, ['protocol_ba6f6133aeb353fe3f75']),
])
def test_actual_applicability_map_excludes_wrong_phase_activity_gravity(phase, activity, gravity, excluded):
    knowledge = KnowledgeTools()
    condition_ids = [r['related_condition_id'] for r in knowledge.rows('protocols/candidate_protocols')]
    retriever = CandidateRetriever(knowledge)
    result = retriever.retrieve(dict(condition_ids=condition_ids, mission_id='synthetic',
        environment_id='environments_491ddef256589d2376fe', mission_phase=phase,
        mission_activity=activity, gravity_regime=gravity), [])
    ids = {c.protocol_id for c in result['candidates']}
    assert ids and ids.isdisjoint(excluded)
    if activity == 'spacewalk_preparation':
        assert 'protocol_805036b8c4327dec7e05' in ids


def test_approved_mode_configuration_and_new_fields_are_backward_compatible(tmp_path):
    from health_agent.models import Assessment
    agent, model = build(tmp_path)
    data = agent.assess(request(), {'demo'}).model_dump(mode='json')
    data.pop('protocol_mode')
    for rec in data['recommendations']:
        for key in ('protocol_origin','protocol_review_status','matching_condition_ids','matching_relation_ids','applicability_limitations'):
            rec.pop(key)
    # Old saved JSON can still be loaded; new fields have conservative legacy defaults.
    restored = Assessment.model_validate(data)
    assert restored.protocol_mode == 'approved'
    assert restored.recommendations[0].status == 'requires_review'


def test_invalid_protocol_mode_and_incompatible_research_mode_fail_early(tmp_path, monkeypatch):
    monkeypatch.setenv('HEALTH_DB_PATH', str(tmp_path/'unused.sqlite3'))
    monkeypatch.setenv('HEALTH_PROTOCOL_MODE', 'unsupported')
    with pytest.raises(ValueError, match='HEALTH_PROTOCOL_MODE'):
        create_app(tokens={})
    monkeypatch.setenv('HEALTH_PROTOCOL_MODE', 'candidate_review')
    monkeypatch.setenv('HEALTH_KNOWLEDGE_MODE', 'approved')
    with pytest.raises(ValueError, match='requires'):
        create_app(tokens={})
    assert not (tmp_path/'unused.sqlite3').exists()


def test_existing_saved_assessment_is_not_rewritten_on_mode_change(tmp_path):
    agent, model = build(tmp_path)
    req = request()
    approved_agent = PreventiveHealthAgent(agent.store, agent.knowledge, model, protocol_mode='approved')
    original = approved_agent.assess(req, {'demo'})
    assert original.protocol_mode == 'approved' and not original.recommendations
    assert agent.assess(req, {'demo'}) == original
    req.request_id = 'new-review-assessment'
    revised = agent.assess(req, {'demo'})
    assert revised.protocol_mode == 'candidate_review' and len(revised.recommendations) == 1
