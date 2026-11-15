"""Real draft CSV research + a clearly synthetic personal profile; no approvals."""
import tempfile
from pathlib import Path
from .agent import PreventiveHealthAgent
from .knowledge import KnowledgeTools
from .storage import HealthStore
from .models import AssessmentRequest, LLMSelection, now


class SyntheticSelection:
    model = 'synthetic-review-selection-stub'
    def select(self, candidates, findings):
        return LLMSelection(protocol_ids=[c['protocol_id'] for c in candidates[:5]])


def build_example(directory):
    store = HealthStore(Path(directory)/'synthetic-review.sqlite3')
    store.provision('demo', {
        'synthetic':True, 'mission_id':'SYNTHETIC_MISSION',
        'environment_id':'environments_491ddef256589d2376fe',
        'mission_phase':'in_mission',
        # Illustrative recorded condition ID, not a diagnosis inferred from sleep.
        'condition_ids':['conditions_385f44abcfe940fa01f9'],
    }, {'sleep_duration':{'value':7.2, 'unit':'hours'}})
    agent = PreventiveHealthAgent(store, KnowledgeTools(), SyntheticSelection(), protocol_mode='candidate_review')
    request = AssessmentRequest(astronaut_id='demo', request_id='synthetic-candidate-review-1', measurements=[{
        'measurement_id':'synthetic-sleep-1', 'astronaut_id':'demo', 'metric':'sleep_duration',
        'value':5.8, 'unit':'hours', 'timestamp':now().isoformat(), 'source':'synthetic-device'}])
    result = agent.assess(request, {'demo'})
    assert len(result.recommendations) == 1
    assert result.recommendations[0].status == 'requires_review'
    assert result.recommendations[0].supporting_metric_ids == []
    assert agent.assess(request, {'demo'}) == result
    return result


def main():
    with tempfile.TemporaryDirectory(prefix='orbital-candidate-review-') as directory:
        result = build_example(directory)
        print(result.model_dump_json(indent=2))


if __name__ == '__main__':
    main()
