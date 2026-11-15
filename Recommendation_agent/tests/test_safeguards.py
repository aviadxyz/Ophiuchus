from health_agent.demo import build_demo, make_request

def test_current_symptoms_can_block_protocol(tmp_path):
    agent = build_demo(tmp_path)
    request = make_request()
    request.symptoms = ['DEMO_RESTRICTION']
    assert not agent.assess(request, {'DEMO_ASTRONAUT'}).recommendations

def test_client_cannot_supply_trusted_environment(tmp_path):
    agent = build_demo(tmp_path)
    agent.store.provision('DEMO_ASTRONAUT', {'synthetic':True, 'restrictions':[], 'restrictions_complete':True})
    result = agent.assess(make_request(), {'DEMO_ASTRONAUT'})
    assert result.risk_level == 'undetermined' and not result.recommendations

def test_unresolved_source_prevents_action_and_risk_rule(tmp_path):
    agent = build_demo(tmp_path)
    (agent.knowledge.root/'metadata/sources.csv').unlink()
    result = agent.assess(make_request(), {'DEMO_ASTRONAUT'})
    assert not result.recommendations and result.risk_level == 'undetermined'

def test_malformed_llm_output(tmp_path):
    class Malformed:
        model = 'malformed'
        def select(self, candidates, findings):
            return {'protocol_ids':['DEMO_PROTOCOL_0'], 'invented_dose':'unsafe'}
    result = build_demo(tmp_path, llm=Malformed()).assess(make_request(), {'DEMO_ASTRONAUT'})
    assert result.assessment_status == 'incomplete' and not result.recommendations
