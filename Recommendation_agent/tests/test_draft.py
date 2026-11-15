from health_agent.demo import fixture, write_csv, make_request
from health_agent.knowledge import KnowledgeTools, DB_LAYER
from health_agent.storage import HealthStore
from health_agent.agent import PreventiveHealthAgent

def test_draft_research_keeps_review_status_and_cannot_authorize(tmp_path):
    root = tmp_path / 'draft'
    governance = fixture(root)
    for path in root.rglob('*.csv'):
        path.write_text(path.read_text().replace('approved', 'pending'))
    knowledge = KnowledgeTools(root, governance, demo=True)
    result = knowledge.search_medical_knowledge('sleep_duration')
    assert result['entities'] and result['relationships'] and result['claims']
    assert result['entities'][0]['review_status'] == 'pending'
    assert result['research_only'] and not result['clinical_action_authorized']
    assert knowledge.get_supporting_evidence(evidence_id='DEMO_EVIDENCE') == []
    assert knowledge.retrieve_protocol([], {}, {})['protocols'] == []

def test_actual_draft_default_and_assessment_label(tmp_path):
    knowledge = KnowledgeTools()
    assert knowledge.root == (DB_LAYER / 'DB' / 'draft').resolve()
    result = knowledge.search_medical_knowledge('sleep')
    assert result['entities'] or result['claims']
    agent = PreventiveHealthAgent(HealthStore(tmp_path/'health.sqlite3'), knowledge)
    assessment = agent.assess(make_request(), {'DEMO_ASTRONAUT'})
    assert not assessment.recommendations
    assert assessment.research_knowledge
    assert any('Draft CSV' in item for item in assessment.limitations)
