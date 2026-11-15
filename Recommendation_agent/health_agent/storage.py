import hashlib
import json
import sqlite3
from contextlib import contextmanager
from datetime import timedelta
from pathlib import Path
from .models import Assessment, AssessmentRequest, now

def stable_id(kind, *parts):
    return kind + '_' + hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()[:24]

class HealthStore:
    """Operational data only; connections and transactions are scoped to each call."""
    def __init__(self, path):
        self.path = str(path)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS astronauts (id TEXT PRIMARY KEY, profile TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS personal_baselines (astronaut_id TEXT, metric TEXT, value REAL, unit TEXT, PRIMARY KEY(astronaut_id, metric));
            CREATE TABLE IF NOT EXISTS health_measurements (astronaut_id TEXT, id TEXT, timestamp TEXT, metric TEXT, payload TEXT, PRIMARY KEY(astronaut_id,id));
            CREATE TABLE IF NOT EXISTS risk_assessments (id TEXT PRIMARY KEY, astronaut_id TEXT, request_id TEXT, fingerprint TEXT, timestamp TEXT, payload TEXT, UNIQUE(astronaut_id,request_id));
            CREATE TABLE IF NOT EXISTS recommendations (id TEXT PRIMARY KEY, assessment_id TEXT, astronaut_id TEXT, payload TEXT);
            CREATE TABLE IF NOT EXISTS symptoms (assessment_id TEXT PRIMARY KEY, astronaut_id TEXT, timestamp TEXT, payload TEXT);
            CREATE TABLE IF NOT EXISTS mission_context (assessment_id TEXT PRIMARY KEY, astronaut_id TEXT, timestamp TEXT, payload TEXT);
            CREATE TABLE IF NOT EXISTS assessment_evidence (assessment_id TEXT, evidence_id TEXT, payload TEXT, PRIMARY KEY(assessment_id,evidence_id));
            CREATE INDEX IF NOT EXISTS measurement_history ON health_measurements(astronaut_id,timestamp);
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def provision(self, astronaut_id, profile, baselines=None):
        """Trusted administrative operation, deliberately not exposed as a public route."""
        with self.connect() as db:
            db.execute('INSERT OR REPLACE INTO astronauts VALUES (?,?)', (astronaut_id, json.dumps(profile)))
            for metric, baseline in (baselines or {}).items():
                db.execute('INSERT OR REPLACE INTO personal_baselines VALUES (?,?,?,?)',
                           (astronaut_id, metric, baseline['value'], baseline['unit']))

    @staticmethod
    def authorize(astronaut_id, allowed):
        if astronaut_id not in allowed:
            raise PermissionError('Astronaut access denied')

    def get_health_history(self, astronaut_id: str, allowed: set[str], metrics: list[str] | None = None, days: int = 30) -> dict:
        self.authorize(astronaut_id, allowed)
        if not 1 <= days <= 3650:
            raise ValueError('History window must be 1–3650 days')
        cutoff = (now() - timedelta(days=days)).isoformat()
        with self.connect() as db:
            profile = db.execute('SELECT profile FROM astronauts WHERE id=?', (astronaut_id,)).fetchone()
            baseline = {r['metric']: {'value': r['value'], 'unit': r['unit']} for r in db.execute('SELECT * FROM personal_baselines WHERE astronaut_id=?', (astronaut_id,)) if not metrics or r['metric'] in metrics}
            measurements = [json.loads(r['payload']) for r in db.execute('SELECT * FROM health_measurements WHERE astronaut_id=? AND timestamp>=? ORDER BY timestamp', (astronaut_id, cutoff)) if not metrics or r['metric'] in metrics]
            assessments = [json.loads(r['payload']) for r in db.execute('SELECT payload FROM risk_assessments WHERE astronaut_id=? AND timestamp>=? ORDER BY timestamp', (astronaut_id, cutoff))]
            contexts = db.execute('SELECT payload FROM mission_context WHERE astronaut_id=? ORDER BY timestamp DESC LIMIT 1', (astronaut_id,)).fetchone()
            symptoms = [json.loads(r['payload']) for r in db.execute('SELECT payload FROM symptoms WHERE astronaut_id=? AND timestamp>=?', (astronaut_id, cutoff))]
        return dict(profile=json.loads(profile[0]) if profile else {}, baseline=baseline,
                    baseline_status='available' if baseline else 'missing', recent_measurements=measurements,
                    historical_trends=[f for a in assessments for f in a['findings']], recent_symptoms=symptoms,
                    previous_alerts=[r for a in assessments for r in a['risks'] if r['escalation_required']],
                    previous_assessments=assessments, previous_recommendations=[r for a in assessments for r in a['recommendations']],
                    mission_context=json.loads(contexts[0]) if contexts else {})

    def cached(self, request):
        with self.connect() as db:
            row = db.execute('SELECT * FROM risk_assessments WHERE astronaut_id=? AND request_id=?', (request.astronaut_id, request.request_id)).fetchone()
        if row and row['fingerprint'] != stable_id('request', request.model_dump(mode='json')):
            raise ValueError('request_id already used with different input')
        return Assessment.model_validate_json(row['payload']) if row else None

    def persist_health_event(self, request: AssessmentRequest, assessment: Assessment, evidence: list[dict], allowed: set[str]) -> Assessment:
        self.authorize(request.astronaut_id, allowed)
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            cached = self.cached(request)
            if cached:
                return cached
            for m in assessment.validation.normalized:
                payload = m.model_dump_json()
                old = db.execute('SELECT payload FROM health_measurements WHERE astronaut_id=? AND id=?', (m.astronaut_id, m.measurement_id)).fetchone()
                if old and old[0] != payload:
                    raise ValueError('Measurement ID reused with different data')
                db.execute('INSERT OR IGNORE INTO health_measurements VALUES (?,?,?,?,?)', (m.astronaut_id, m.measurement_id, m.timestamp.isoformat(), m.metric, payload))
            db.execute('INSERT INTO risk_assessments VALUES (?,?,?,?,?,?)', (assessment.assessment_id, request.astronaut_id, request.request_id, stable_id('request', request.model_dump(mode='json')), assessment.generated_at.isoformat(), assessment.model_dump_json()))
            for r in assessment.recommendations:
                db.execute('INSERT INTO recommendations VALUES (?,?,?,?)', (r.recommendation_id, assessment.assessment_id, request.astronaut_id, r.model_dump_json()))
            db.execute('INSERT INTO symptoms VALUES (?,?,?,?)', (assessment.assessment_id, request.astronaut_id, assessment.generated_at.isoformat(), json.dumps(request.symptoms)))
            db.execute('INSERT INTO mission_context VALUES (?,?,?,?)', (assessment.assessment_id, request.astronaut_id, assessment.generated_at.isoformat(), json.dumps(request.mission_context)))
            for item in evidence:
                db.execute('INSERT OR IGNORE INTO assessment_evidence VALUES (?,?,?)', (assessment.assessment_id, item['evidence_id'], json.dumps(item)))
        return assessment

    def latest(self, astronaut_id, allowed):
        self.authorize(astronaut_id, allowed)
        with self.connect() as db:
            row = db.execute('SELECT payload FROM risk_assessments WHERE astronaut_id=? ORDER BY timestamp DESC LIMIT 1', (astronaut_id,)).fetchone()
        return Assessment.model_validate_json(row[0]) if row else None

    def recommendation_evidence(self, recommendation_id, allowed):
        with self.connect() as db:
            row = db.execute('SELECT * FROM recommendations WHERE id=?', (recommendation_id,)).fetchone()
            if not row:
                return None
            self.authorize(row['astronaut_id'], allowed)
            ids = json.loads(row['payload'])['evidence_ids']
            return [json.loads(e['payload']) for e in db.execute('SELECT * FROM assessment_evidence WHERE assessment_id=?', (row['assessment_id'],)) if e['evidence_id'] in ids]
