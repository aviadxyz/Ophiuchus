import json
import os
from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from health_agent.models import AssessmentRequest, Measurement, LLMSelection, now
from health_agent.analysis import validate_input, analyze_trends
from health_agent.knowledge import KnowledgeTools
from health_agent.storage import HealthStore
from health_agent.agent import PreventiveHealthAgent, LocalOllama
from health_agent.api import create_app
from health_agent.demo import build_demo, make_request, write_csv

ALLOWED = {'DEMO_ASTRONAUT'}

def test_valid_and_zero():
    r = make_request()
    r.measurements[0].update(value=0)
    v = validate_input(r.astronaut_id, r.measurements)
    assert v.status == 'valid' and v.normalized[0].value == 0

@pytest.mark.parametrize('change', [dict(value=None), dict(value=float('nan')), dict(value=-1), dict(unit='kg'), dict(metric='unknown'), dict(timestamp='bad'), dict(astronaut_id='other'), dict(timestamp=now()+timedelta(days=1)), dict(timestamp=now()-timedelta(days=2)), dict(quality=0)])
def test_invalid(change):
    r = make_request()
    r.measurements[0].update(change)
    assert validate_input(r.astronaut_id, r.measurements).status == 'invalid'

def test_unit_conversion():
    r = make_request()
    r.measurements[0].update(value=360, unit='minutes')
    assert validate_input(r.astronaut_id, r.measurements).normalized[0].value == 6

def test_missing_baseline_no_thresholds(tmp_path):
    agent = PreventiveHealthAgent(HealthStore(tmp_path/'health.sqlite3'), KnowledgeTools())
    result = agent.assess(make_request(), ALLOWED)
    assert result.recommendations == [] and result.risk_level == 'undetermined'
    assert result.findings[0].baseline_value is None

def test_trends(tmp_path):
    agent = build_demo(tmp_path)
    result = agent.assess(make_request(), ALLOWED)
    finding = result.findings[0]
    assert finding.deviation == pytest.approx(-1.4)
    assert finding.trend == 'decreasing'
    assert finding.slope_per_day < 0
    assert finding.moving_average == pytest.approx(6.325)
    assert result.risk_level == 'yellow'

def test_knowledge_and_traceability(tmp_path):
    agent = build_demo(tmp_path)
    k = agent.knowledge.search_medical_knowledge('sleep_duration')
    assert k['entities'] and k['relationships'] and k['claims']
    assert not k['clinical_action_authorized']
    for key in ('claim_id', 'evidence_id', 'relation_id', 'protocol_id'):
        value = {'claim_id':'DEMO_CLAIM','evidence_id':'DEMO_EVIDENCE','relation_id':'DEMO_RELATION','protocol_id':'DEMO_PROTOCOL_0'}[key]
        assert agent.knowledge.get_supporting_evidence(**{key:value})[0]['source_url'].startswith('https://www.nasa.gov/')
    assert agent.knowledge.get_supporting_evidence(evidence_id='invented') == []

@pytest.mark.parametrize('count,expected', [(0,0),(1,1),(7,5)])
def test_limits_and_approved_protocols(tmp_path, count, expected):
    agent = build_demo(tmp_path, count=count)
    result = agent.assess(make_request(), ALLOWED)
    assert len(result.recommendations) == expected
    assert all(r.protocol_id and r.evidence_ids and r.supporting_metric_ids for r in result.recommendations)

def test_unapproved_rejected(tmp_path):
    agent = build_demo(tmp_path)
    path = agent.knowledge.root/'protocols/approved_protocols.csv'
    path.write_text(path.read_text().replace(',approved,', ',pending,'))
    assert agent.assess(make_request(), ALLOWED).recommendations == []

def test_contraindication(tmp_path):
    agent = build_demo(tmp_path)
    agent.store.provision('DEMO_ASTRONAUT', {'synthetic': True, 'restrictions_complete': True, 'restrictions':['DEMO_RESTRICTION']})
    assert agent.assess(make_request(), ALLOWED).recommendations == []

def test_missing_restrictions(tmp_path):
    agent = build_demo(tmp_path)
    agent.store.provision('DEMO_ASTRONAUT', {'synthetic': True})
    assert agent.assess(make_request(), ALLOWED).recommendations == []

def test_missing_inventory(tmp_path):
    agent = build_demo(tmp_path, category='medication')
    assert agent.assess(make_request(), ALLOWED).recommendations == []

def test_inventory_requires_all_safeguards(tmp_path):
    agent = build_demo(tmp_path, category='supplement')
    write_csv(agent.knowledge.root, 'entities/treatments', [dict(treatment_id='DEMO_TREATMENT', canonical_name='Synthetic substance', medication_or_supplement='supplement', review_status='approved')])
    write_csv(agent.knowledge.root, 'inventory/mission_inventory', [dict(inventory_id='DEMO_INVENTORY', treatment_id='DEMO_TREATMENT', quantity='5', unit='demo', expiration_date='2099-01-01', mission_id='DEMO_MISSION', availability_status='available')])
    agent.knowledge.governance['inventory_policies'] = {'DEMO_INVENTORY': dict(approved=True, authorized_by='FICTIONAL', authorized_at='2026-01-01', restrictions_reviewed=True, required_profile={'synthetic':True}, contraindications=[])}
    profile = agent.store.get_health_history('DEMO_ASTRONAUT', ALLOWED)['profile']
    profile['clinician_authorized_protocol_ids'] = ['DEMO_PROTOCOL_0']
    profile['medication_review_complete'] = True
    agent.store.provision('DEMO_ASTRONAUT', profile)
    assert len(agent.assess(make_request(), ALLOWED).recommendations) == 1

class BrokenModel:
    model = 'broken-mock'
    def select(self, candidates, findings):
        raise ConnectionError('Ollama down')

def test_red_ignores_model_failure(tmp_path):
    agent = build_demo(tmp_path, category='escalation', severity='red', llm=BrokenModel())
    result = agent.assess(make_request(), ALLOWED)
    assert result.escalation_required and result.recommendations[0].status == 'escalation'
    assert result.escalation_status == 'pending_human_action'

def test_red_without_protocol_remains_urgent(tmp_path):
    agent = build_demo(tmp_path, count=0, severity='red')
    result = agent.assess(make_request(), ALLOWED)
    assert result.escalation_required and result.escalation_status == 'blocked_missing_approved_workflow'

def test_ollama_outage_preserves_findings(tmp_path):
    result = build_demo(tmp_path, llm=BrokenModel()).assess(make_request(), ALLOWED)
    assert result.assessment_status == 'incomplete' and result.findings and not result.recommendations

def test_malicious_model_rejected(tmp_path):
    class Malicious:
        model = 'mock'
        def select(self, candidates, findings):
            return {'protocol_ids':['invented']}
    result = build_demo(tmp_path, llm=Malicious()).assess(make_request(), ALLOWED)
    assert not result.recommendations and result.assessment_status == 'incomplete'

def test_duplicate_actions_removed(tmp_path):
    agent = build_demo(tmp_path, count=2)
    policies = agent.knowledge.policies
    agent.knowledge.policies[1] = policies[1].model_copy(update={'allowed_action': policies[0].allowed_action})
    assert len(agent.assess(make_request(), ALLOWED).recommendations) == 1

def test_idempotency_and_astronaut_isolation(tmp_path):
    agent = build_demo(tmp_path)
    request = make_request()
    first = agent.assess(request, ALLOWED)
    assert agent.assess(request, ALLOWED) == first
    with agent.store.connect() as db:
        assert db.execute('SELECT COUNT(*) FROM risk_assessments').fetchone()[0] == 1
        assert db.execute('SELECT COUNT(*) FROM recommendations').fetchone()[0] == 1
    assert not agent.store.get_health_history('OTHER', {'OTHER'})['previous_assessments']
    with pytest.raises(PermissionError):
        agent.store.get_health_history('DEMO_ASTRONAUT', {'OTHER'})
    changed = request.model_copy(deep=True)
    changed.measurements[0]['value'] = 4
    with pytest.raises(ValueError):
        agent.assess(changed, ALLOWED)

def test_api_contract_and_access(tmp_path):
    agent = build_demo(tmp_path)
    client = TestClient(create_app(agent, {'secret': ['DEMO_ASTRONAUT'], 'other': ['OTHER']}))
    header = {'Authorization':'Bearer secret'}
    request = make_request().model_dump(mode='json')
    assert client.post('/api/health/assess', json=request).status_code == 401
    result = client.post('/api/health/assess', json=request, headers=header)
    assert result.status_code == 200, result.text
    data = result.json()
    assert len(data['recommendations']) == 1 and data['recommendations'][0]['priority'] == 1
    assert client.get('/api/astronauts/DEMO_ASTRONAUT/recommendations', headers=header).json() == data
    assert client.get('/api/astronauts/DEMO_ASTRONAUT/health-history', headers=header).status_code == 200
    rid = data['recommendations'][0]['recommendation_id']
    assert client.get(f'/api/recommendations/{rid}/evidence', headers=header).json()['evidence']
    other = {'Authorization':'Bearer other'}
    for url in ['/api/astronauts/DEMO_ASTRONAUT/recommendations', '/api/astronauts/DEMO_ASTRONAUT/health-history', f'/api/recommendations/{rid}/evidence']:
        assert client.get(url, headers=other).status_code == 403
    assert client.post('/api/health/assess', json=request, headers=other).status_code == 403
    assert client.get('/api/astronauts/DEMO_ASTRONAUT/health-history?days=0', headers=header).status_code == 422

def test_demo_cannot_load_as_real(tmp_path):
    agent = build_demo(tmp_path)
    with pytest.raises(ValueError):
        KnowledgeTools(agent.knowledge.root, agent.knowledge.governance)

@pytest.mark.skipif(os.getenv('RUN_OLLAMA_TEST') != '1', reason='Opt-in installed local Ollama integration')
def test_real_ollama():
    result = LocalOllama().select([{'protocol_id':'SYNTHETIC_ONLY', 'allowed_action':'Synthetic UI monitoring demonstration.'}], [])
    assert set(result.protocol_ids) <= {'SYNTHETIC_ONLY'}
