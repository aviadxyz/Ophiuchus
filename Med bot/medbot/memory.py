"""Private chat/mood store; never writes into the astronaut health database."""
from contextlib import contextmanager
from copy import deepcopy
from datetime import timedelta
import json
from pathlib import Path
import sqlite3
from threading import RLock
from uuid import uuid4
from .models import Consent, MoodCheckin, utcnow


class SessionNotFound(LookupError):
    pass


class ConversationStore:
    def __init__(self, path, clock=utcnow):
        self.path, self.clock = Path(path), clock
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = RLock()
        self.sessions = {}
        self.initial_requests = {}
        with self.connect() as db:
            db.executescript('''
                PRAGMA secure_delete=ON;
                CREATE TABLE IF NOT EXISTS consents (astronaut TEXT PRIMARY KEY, payload TEXT);
                CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, astronaut TEXT, touched TEXT, payload TEXT);
                CREATE TABLE IF NOT EXISTS moods (id TEXT PRIMARY KEY, astronaut TEXT, request_id TEXT, at TEXT, payload TEXT, UNIQUE(astronaut,request_id));
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        try:
            db.execute('PRAGMA secure_delete=ON')
            with db:
                yield db
        finally:
            db.close()

    def purge(self):
        with self.lock:
            cutoff = self.clock() - timedelta(minutes=30)
            self.sessions = {key: value for key, value in self.sessions.items() if value['touched'] > cutoff.isoformat()}
            for session in self.sessions.values():
                self._trim(session)
            self.initial_requests = {key:value for key,value in self.initial_requests.items() if value in self.sessions}
            with self.connect() as db:
                persistent_cutoff = (self.clock()-timedelta(days=30)).isoformat()
                db.execute('DELETE FROM sessions WHERE touched<=?', (persistent_cutoff,))
                db.execute('DELETE FROM moods WHERE at<=?', (persistent_cutoff,))
                for sid, payload in db.execute('SELECT id,payload FROM sessions').fetchall():
                    value = json.loads(payload)
                    if self._trim(value):
                        db.execute('UPDATE sessions SET payload=? WHERE id=?', (json.dumps(value), sid))

    def _trim(self, session):
        cutoff = (self.clock()-timedelta(days=30)).isoformat()
        original = len(session['messages']) + len(session['responses'])
        session['messages'] = [m for m in session['messages'] if m['at'] > cutoff]
        session['responses'] = {key:value for key,value in session['responses'].items()
                                if value['response'].get('generated_at', session['touched']) > cutoff}
        return original != len(session['messages']) + len(session['responses'])

    def session_for_request(self, astronaut, request_id):
        """Make retries of a first message reuse its server-issued session."""
        with self.lock:
            self.purge()
            key = (astronaut, request_id)
            if key in self.initial_requests:
                return self.initial_requests[key]
            with self.connect() as db:
                rows = db.execute('SELECT id,payload FROM sessions WHERE astronaut=?', (astronaut,)).fetchall()
            for sid, payload in rows:
                if request_id in json.loads(payload)['responses']:
                    self.initial_requests[key] = sid
                    return sid
            sid = self.get_conversation_context(astronaut)['session_id']
            self.initial_requests[key] = sid
            return sid

    def consent(self, astronaut):
        with self.connect() as db:
            row = db.execute('SELECT payload FROM consents WHERE astronaut=?', (astronaut,)).fetchone()
        return Consent.model_validate_json(row[0]) if row else Consent()

    def update_consent(self, astronaut, update):
        with self.lock:
            previous = self.consent(astronaut)
            value = previous.model_copy(update=update.model_dump(exclude_none=True))
            with self.connect() as db:
                db.execute('INSERT OR REPLACE INTO consents VALUES (?,?)', (astronaut, value.model_dump_json()))
                if not value.save_conversations:
                    db.execute('DELETE FROM sessions WHERE astronaut=?', (astronaut,))
                if not value.mood_history:
                    db.execute('DELETE FROM moods WHERE astronaut=?', (astronaut,))
            if previous.save_conversations and not value.save_conversations:
                for session in self.sessions.values():
                    if session['astronaut'] == astronaut:
                        for message in session['messages']:
                            message['retain'] = False
                        for response in session['responses'].values():
                            response['retain'] = False
                        session['saved_preferences'] = {}
            if previous.personal_health and not value.personal_health:
                for session in self.sessions.values():
                    if session['astronaut'] == astronaut:
                        session['messages'] = [m for m in session['messages'] if not m['health_used']]
                        session['responses'] = {}
                # A saved reply may contain health-tool values. Remove saved sessions
                # rather than leaking them after personal-data consent withdrawal.
                with self.connect() as db:
                    db.execute('DELETE FROM sessions WHERE astronaut=?', (astronaut,))
            return value

    def get_conversation_context(self, astronaut, session_id=None, limit=12):
        if not 1 <= limit <= 50:
            raise ValueError('Context limit must be 1–50')
        with self.lock:
            self.purge()
            if session_id is None:
                if len(self.sessions) >= 1000 or sum(s['astronaut'] == astronaut for s in self.sessions.values()) >= 100:
                    raise ValueError('Temporary session capacity reached')
                session_id = str(uuid4())
                self.sessions[session_id] = dict(id=session_id, astronaut=astronaut, touched=self.clock().isoformat(), messages=[], responses={}, preferences={})
            session = self.sessions.get(session_id)
            if session is None:
                with self.connect() as db:
                    row = db.execute('SELECT astronaut,payload FROM sessions WHERE id=?', (session_id,)).fetchone()
                if not row:
                    raise SessionNotFound('Session missing or expired')
                if row[0] != astronaut:
                    raise PermissionError('Session access denied')
                session = json.loads(row[1])
                self.sessions[session_id] = session
            if session['astronaut'] != astronaut:
                raise PermissionError('Session access denied')
            session['touched'] = self.clock().isoformat()
            consent = self.consent(astronaut)
            messages = [m for m in session['messages'] if consent.personal_health or not m['health_used']]
            return dict(session_id=session_id, recent_messages=deepcopy(messages[-limit:]),
                        preferences=deepcopy(session['preferences']), consent=consent.model_dump())

    def cached_response(self, astronaut, session_id, request_id, fingerprint):
        self.get_conversation_context(astronaut, session_id)
        with self.lock:
            entry = self.sessions[session_id]['responses'].get(request_id)
            if entry and entry['fingerprint'] != fingerprint:
                raise ValueError('request_id already used with different input')
            return deepcopy(entry['response']) if entry else None

    def safety_revision(self, astronaut, session_id, urgent=False):
        with self.lock:
            self.get_conversation_context(astronaut, session_id)
            session = self.sessions[session_id]
            session['safety_revision'] = session.get('safety_revision', 0) + int(urgent)
            return session['safety_revision']

    def save_conversation_context(self, astronaut, session_id, message, response, request_id, fingerprint, health_used=False, confirmed_mood=None, retain=None):
        with self.lock:
            self.get_conversation_context(astronaut, session_id)
            session = self.sessions[session_id]
            at = self.clock().isoformat()
            can_save = self.consent(astronaut).save_conversations
            retain = can_save if retain is None else retain and can_save
            session['messages'].extend([
                dict(role='user', content=message, at=at, health_used=health_used, retain=retain),
                dict(role='assistant', content=response['reply'], at=at, health_used=health_used, retain=retain)])
            session['messages'] = session['messages'][-50:]
            session['responses'][request_id] = dict(fingerprint=fingerprint, response=response, retain=retain)
            # Bound both transient and saved context; no unbounded per-session log.
            session['responses'] = dict(list(session['responses'].items())[-25:])
            if confirmed_mood:
                session['preferences']['self_reported_mood'] = confirmed_mood
                if retain:
                    session.setdefault('saved_preferences', {})['self_reported_mood'] = confirmed_mood
            if can_save:
                saved = deepcopy(session)
                saved['messages'] = [m for m in saved['messages'] if m.get('retain', False)]
                saved['responses'] = {key:value for key,value in saved['responses'].items() if value.get('retain', False)}
                saved['preferences'] = saved.get('saved_preferences', {})
                with self.connect() as db:
                    db.execute('INSERT OR REPLACE INTO sessions VALUES (?,?,?,?)', (session_id, astronaut, at, json.dumps(saved)))

    def record_mood_checkin(self, astronaut, checkin: MoodCheckin):
        with self.lock:
            self.purge()
            if not self.consent(astronaut).mood_history:
                raise PermissionError('Mood history consent is required')
            if not self.clock()-timedelta(days=30) <= checkin.timestamp <= self.clock():
                raise ValueError('Mood timestamp must be within the last 30 days')
            payload = checkin.model_dump(mode='json')
            # Normalize UTC for correct ordering and retention across timezones.
            from datetime import timezone
            payload['timestamp'] = checkin.timestamp.astimezone(timezone.utc).isoformat()
            with self.connect() as db:
                old = db.execute('SELECT id,payload FROM moods WHERE astronaut=? AND request_id=?', (astronaut, checkin.request_id)).fetchone()
                if old:
                    previous = json.loads(old[1])
                    comparable = dict(payload)
                    original = dict(previous)
                    if 'timestamp' not in checkin.model_fields_set:
                        comparable.pop('timestamp', None)
                        original.pop('timestamp', None)
                    if original != comparable:
                        raise ValueError('request_id already used with different check-in')
                    return {'id': old[0], **previous, 'source': 'self_report'}
                mood_id = str(uuid4())
                db.execute('INSERT INTO moods VALUES (?,?,?,?,?)', (mood_id, astronaut, checkin.request_id, payload['timestamp'], json.dumps(payload)))
            return {'id': mood_id, **payload, 'source': 'self_report'}

    def get_mood_history(self, astronaut, days=30):
        self.purge()
        if not 1 <= days <= 30:
            raise ValueError('Mood history window must be 1–30 days')
        if not self.consent(astronaut).mood_history:
            raise PermissionError('Mood history consent is required')
        with self.connect() as db:
            rows = db.execute('SELECT id,payload FROM moods WHERE astronaut=? AND at>=? ORDER BY at DESC LIMIT 100', (astronaut, (self.clock()-timedelta(days=days)).isoformat())).fetchall()
        return [{'id': row[0], **json.loads(row[1]), 'source': 'self_report'} for row in rows]

    def delete_session(self, astronaut, session_id):
        with self.lock:
            self.get_conversation_context(astronaut, session_id)
            self.sessions.pop(session_id, None)
            with self.connect() as db:
                db.execute('DELETE FROM sessions WHERE id=? AND astronaut=?', (session_id, astronaut))

    def delete_mood_history(self, astronaut):
        with self.lock, self.connect() as db:
            db.execute('DELETE FROM moods WHERE astronaut=?', (astronaut,))

    def delete_all(self, astronaut):
        with self.lock:
            self.sessions = {key: value for key, value in self.sessions.items() if value['astronaut'] != astronaut}
            with self.connect() as db:
                for table in ('sessions', 'moods', 'consents'):
                    db.execute(f'DELETE FROM {table} WHERE astronaut=?', (astronaut,))
