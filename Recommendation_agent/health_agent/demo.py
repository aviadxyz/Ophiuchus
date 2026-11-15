"""Synthetic approval fixtures are generated ONLY in a temporary demo directory."""
import csv
import json
import tempfile
from datetime import timedelta
from pathlib import Path
from .models import AssessmentRequest, LLMSelection, now
from .storage import HealthStore
from .knowledge import KnowledgeTools
from .agent import PreventiveHealthAgent

class DemoModel:
    model = 'synthetic-selection-stub'
    def select(self, candidates, findings):
        return LLMSelection(protocol_ids=[c['protocol_id'] for c in candidates[:5]])

def write_csv(root, table, rows):
    path = Path(root) / (table + '.csv')
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

def fixture(root, count=1, category='monitoring', severity='yellow'):
    """All numeric criteria and approvals here are fictional, never clinical guidance."""
    root = Path(root)
    approved_at = '2026-01-01T00:00:00+00:00'
    source = {'source_id': 'DEMO_SOURCE', 'title': 'NASA Human Research Program (educational link only)',
              'source_url': 'https://www.nasa.gov/hrp/', 'review_status': 'approved'}
    write_csv(root, 'metadata/sources', [source])
    write_csv(root, 'evidence/evidence', [{'evidence_id': 'DEMO_EVIDENCE', 'source_id': 'DEMO_SOURCE',
        'evidence_text': 'SYNTHETIC fixture: the linked NASA program is educational context only, not support for this fictional rule or protocol.',
        'page_number': '', 'section': 'Demo disclaimer', 'review_status': 'approved'}])
    write_csv(root, 'evidence/knowledge_claims', [{'claim_id': 'DEMO_CLAIM', 'evidence_id': 'DEMO_EVIDENCE',
        'source_id': 'DEMO_SOURCE', 'claim_text': 'Synthetic sleep_duration monitoring demonstration only.',
        'subject_entity_id': 'DEMO_SLEEP', 'object_entity_id': 'DEMO_RISK', 'evidence_status': 'synthetic',
        'study_population': 'Synthetic astronaut', 'limitations': 'No clinical validity; no NASA protocol approval.', 'review_status': 'approved'}])
    write_csv(root, 'entities/biomarkers', [{'biomarker_id': 'DEMO_SLEEP', 'canonical_name': 'sleep_duration', 'review_status': 'approved'}])
    write_csv(root, 'relations/condition_biomarker', [{'relation_id': 'DEMO_RELATION', 'source_entity_id': 'DEMO_SLEEP',
        'target_entity_id': 'DEMO_RISK', 'relationship_type': 'synthetic_monitoring', 'claim_id': 'DEMO_CLAIM', 'review_status': 'approved'}])
    policies, records = [], []
    for i in range(count):
        pid = f'DEMO_PROTOCOL_{i}'
        policies.append(dict(protocol_id=pid, title=f'Synthetic monitoring action {i}', allowed_action=f'DEMO ONLY: review simulated measurement panel {i}.',
            category=category, risk_ids=['DEMO_RISK'], environment_ids=['DEMO_STATION'], required_profile={'synthetic': True},
            contraindications=['DEMO_RESTRICTION'], restrictions_reviewed=True, required_monitoring='Synthetic measurement review',
            escalation_conditions='Use the configured synthetic escalation path only.', authorization_required=category in ('medication','supplement'),
            authorized_by='FICTIONAL_DEMO_REVIEWER', authorized_at=approved_at, review_status='approved', expected_benefit_rank=0))
        records.append(dict(protocol_id=pid, related_condition_id='DEMO_RISK', treatment_id='DEMO_TREATMENT',
            indication='Synthetic risk match', required_conditions='governance:' + pid, contraindications='governance:' + pid,
            frequency='', dosage='', duration='', source_id='DEMO_SOURCE', evidence_id='DEMO_EVIDENCE',
            review_status='approved', authorized_by='FICTIONAL_DEMO_REVIEWER', authorized_at=approved_at))
    if records:
        write_csv(root, 'protocols/approved_protocols', records)
    rule = dict(rule_id='DEMO_RULE', risk_id='DEMO_RISK', risk_type='Synthetic sleep observation', metric='sleep_duration',
        field='deviation', operator='lt', threshold=-1, minimum_samples=1, severity=severity, evidence_ids=['DEMO_EVIDENCE'],
        environment_id='DEMO_STATION', escalation_protocol_id='DEMO_PROTOCOL_0' if severity == 'red' else None,
        authorized_by='FICTIONAL_DEMO_REVIEWER', authorized_at=approved_at, review_status='approved')
    return {'version': 'synthetic-demo-v1', 'demo_only': True, 'rules': [rule], 'protocol_policies': policies}

def make_request(request_id='demo-1'):
    at = now()
    return AssessmentRequest(astronaut_id='DEMO_ASTRONAUT', request_id=request_id,
        measurements=[dict(measurement_id='demo-current-sleep', astronaut_id='DEMO_ASTRONAUT', metric='sleep_duration', value=5.8,
                           unit='hours', timestamp=at.isoformat(), source='synthetic-device')],
        symptoms=[], mission_context={'flight_day': 128, 'environment_id': 'DEMO_STATION', 'mission_id': 'DEMO_MISSION'})

def build_demo(directory, count=1, category='monitoring', severity='yellow', llm=None):
    directory = Path(directory)
    governance = fixture(directory / 'knowledge', count, category, severity)
    store = HealthStore(directory / 'demo.sqlite3')
    store.provision('DEMO_ASTRONAUT', {'synthetic': True, 'restrictions': [], 'restrictions_complete': True,
        'mission_id': 'DEMO_MISSION', 'environment_id': 'DEMO_STATION'}, {'sleep_duration': {'value': 7.2, 'unit': 'hours'}})
    # Trusted synthetic history. Real input enters through validate_input().
    with store.connect() as db:
        for day, value in [(3, 7.0), (2, 6.5), (1, 6.0)]:
            raw = dict(measurement_id=f'demo-history-{day}', astronaut_id='DEMO_ASTRONAUT', metric='sleep_duration', value=value,
                       unit='hours', timestamp=(now()-timedelta(days=day)).isoformat(), source='synthetic-device')
            db.execute('INSERT OR IGNORE INTO health_measurements VALUES (?,?,?,?,?)', ('DEMO_ASTRONAUT', raw['measurement_id'], raw['timestamp'], 'sleep_duration', json.dumps(raw)))
    return PreventiveHealthAgent(store, KnowledgeTools(directory / 'knowledge', governance, demo=True), llm or DemoModel(), protocol_mode='approved')

def main():
    with tempfile.TemporaryDirectory(prefix='orbital-health-demo-') as directory:
        agent = build_demo(directory)
        request = make_request()
        result = agent.assess(request, {'DEMO_ASTRONAUT'})
        assert agent.assess(request, {'DEMO_ASTRONAUT'}) == result
        print(result.model_dump_json(indent=2))

if __name__ == '__main__':
    main()
