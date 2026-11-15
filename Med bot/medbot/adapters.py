"""Reuse the existing health subsystem without editing it or copying its logic."""
from contextlib import contextmanager
import json
from pathlib import Path
import sqlite3
import sys
from urllib.parse import urlsplit
import httpx

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'Recommendation_agent'))
from health_agent.storage import HealthStore
from health_agent.analysis import analyze_trends, assess_risk, UNITS
from health_agent.models import Measurement, AssessmentRequest
from health_agent.knowledge import KnowledgeTools
from .models import Source, SuggestedAction


class ReadOnlyHealthStore(HealthStore):
    def __init__(self, path):
        self.path = str(Path(path).resolve())

    @contextmanager
    def connect(self):
        # Reuse existing queries, never create/migrate/write the external database.
        db = sqlite3.connect(Path(self.path).as_uri() + '?mode=ro', uri=True, timeout=5)
        db.row_factory = sqlite3.Row
        try:
            yield db
        finally:
            db.close()


def source_from_record(row, research_only=False):
    url = row.get('source_url', '')
    if urlsplit(url).scheme not in ('http', 'https') or not urlsplit(url).hostname:
        return None
    return Source(id=row['evidence_id'], title=row.get('source_title', 'Source'), url=url,
                  excerpt=row.get('supporting_excerpt', '')[:1000],
                  review_status=row.get('review_status', 'unknown'), research_only=research_only,
                  limitations=row.get('limitations', []))


class HealthTools:
    def __init__(self, health_path=None, knowledge=None, store=None, assessment_url=None, assessment_token=None):
        self.store = store or ReadOnlyHealthStore(health_path or REPO/'Recommendation_agent/data/health.sqlite3')
        self.knowledge = knowledge or KnowledgeTools()
        self.assessment_url = assessment_url
        self.assessment_token = assessment_token
        if assessment_url:
            parsed = urlsplit(assessment_url)
            if parsed.scheme not in ('http', 'https') or parsed.hostname not in ('localhost', '127.0.0.1', '::1') or parsed.username or parsed.password:
                raise ValueError('Assessment service must be a loopback HTTP(S) URL')

    def get_health_history(self, astronaut, metrics=None, days=30):
        try:
            history = self.store.get_health_history(astronaut, {astronaut}, metrics, days)
        except (sqlite3.OperationalError, FileNotFoundError):
            return {'available': False, 'reason': 'Operational health history is unavailable.'}
        metrics = [m for m in (metrics or []) if m in UNITS]
        latest = {}
        for raw in history['recent_measurements']:
            reading = Measurement.model_validate(raw)
            if not metrics or reading.metric in metrics:
                latest[reading.metric] = reading
        findings = analyze_trends(list(latest.values()), history)
        mission = {'mission_id': history['profile'].get('mission_id'), 'environment_id': history['profile'].get('environment_id')}
        risks = assess_risk(findings, self.knowledge.rules, mission, self.knowledge.get_supporting_evidence)
        return {'available': True, 'history': history, 'findings': findings, 'risks': risks,
                'latest': latest, 'mission': mission}

    def latest_recommendations(self, astronaut):
        try:
            assessment = self.store.latest(astronaut, {astronaut})
        except (sqlite3.OperationalError, FileNotFoundError):
            return None, []
        sources = []
        if assessment:
            for recommendation in assessment.recommendations:
                for row in self.store.recommendation_evidence(recommendation.recommendation_id, {astronaut}) or []:
                    source = source_from_record(row)
                    if source:
                        sources.append(source)
        return assessment, sources

    def search(self, terms):
        sources = {}
        for term in terms[:4]:
            term = term.strip()[:120]
            if not term:
                continue
            result = self.knowledge.search_medical_knowledge(term)
            records = []
            for relationship in result['relationships'][:8]:
                records.extend(relationship['evidence'])
            for claim in result['claims'][:8]:
                for evidence in claim['evidence']:
                    records.extend(self.knowledge.get_supporting_evidence(evidence_id=evidence['evidence_id'], research_only=True))
            for row in records:
                source = source_from_record(row, research_only=self.knowledge.draft_mode)
                if source:
                    sources[source.id] = source
        return list(sources.values())[:8]

    def search_behavioral_health_knowledge(self, terms):
        # Reuse the query adapter, including original review flags and source IDs.
        return self.search(terms or ['isolation', 'confinement', 'behavioral health'])

    def get_approved_support_options(self, personal):
        if not personal.get('available'):
            return []
        history = personal['history']
        protocols = self.knowledge.retrieve_protocol(personal['risks'], history['profile'], personal['mission'])
        return [SuggestedAction(id=p['policy'].protocol_id, protocol_id=p['policy'].protocol_id,
                                description=p['policy'].allowed_action, status='approved_action')
                for p in protocols['protocols'] if p['policy'].category in ('monitoring', 'preventive')][:5]

    def request_assessment(self, astronaut, request_id, personal):
        if not self.assessment_url or not self.assessment_token:
            return {'status': 'not_configured'}
        if not personal.get('available') or not personal['latest']:
            return {'status': 'missing_measurements'}
        # Existing service performs all validation, authorization and persistence.
        request = AssessmentRequest(astronaut_id=astronaut, request_id='medbot:' + request_id,
            measurements=[m.model_dump(mode='json') for m in personal['latest'].values()], mission_context={})
        try:
            with httpx.Client(timeout=20, trust_env=False, follow_redirects=False) as client:
                response = client.post(self.assessment_url, json=request.model_dump(mode='json'),
                                       headers={'Authorization': 'Bearer ' + self.assessment_token})
                response.raise_for_status()
            from health_agent.models import Assessment
            assessment = Assessment.model_validate(response.json())
            if assessment.astronaut_id != astronaut:
                raise ValueError('Assessment identity mismatch')
            return {'status': 'completed', 'assessment': assessment}
        except (httpx.HTTPError, ValueError):
            return {'status': 'unavailable'}


def request_crew_support(request):
    # No network/contact integration is implemented in this repository.
    return {'status': 'not_configured', 'contacted': False,
            'message': 'No crew-support integration is configured. No message has been sent.'}
