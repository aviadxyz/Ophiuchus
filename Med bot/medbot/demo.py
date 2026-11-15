"""Synthetic, offline end-to-end conversations; no real records or approvals."""
import json
import tempfile
from pathlib import Path
from .adapters import HealthTools
from .agent import MedBot
from .memory import ConversationStore
from .models import ChatRequest, Classification, GeneratedReply, ConsentUpdate
from health_agent.demo import build_demo, make_request


class SyntheticModel:
    """Deterministic demonstration stub, not the production Ollama provider."""
    def classify(self, payload):
        text = payload['message'].lower()
        if 'sleep' in text:
            return Classification(intent='health_data_explanation', mood='fatigued', confidence='low', needs_health=True, metrics=['sleep_duration'])
        return Classification(intent='mental_health_support', mood='lonely', confidence='moderate')

    def respond(self, payload):
        if payload['classification']['needs_health']:
            return GeneratedReply(reply='We can look at the recorded sleep observations together. They describe a pattern without establishing its cause.')
        if payload['recent_messages']:
            return GeneratedReply(reply='You mentioned missing your family earlier. What part of today has felt hardest?')
        return GeneratedReply(reply='Being far from family sounds difficult. Would you like to tell me what you miss most?')


def main():
    with tempfile.TemporaryDirectory(prefix='orbital-medbot-demo-') as directory:
        root = Path(directory)
        health = build_demo(root/'synthetic-health')
        health.assess(make_request(), {'DEMO_ASTRONAUT'})
        bot = MedBot(ConversationStore(root/'private-chat.sqlite3'),
                     HealthTools(store=health.store, knowledge=health.knowledge), SyntheticModel())
        sid = None
        turns = [
            ChatRequest(request_id='demo-1', message='I miss my family and feel lonely.', self_reported_mood='lonely'),
            ChatRequest(request_id='demo-2', message='It has been especially hard today.'),
            ChatRequest(request_id='demo-3', message='Can we review my sleep?', consent=ConsentUpdate(personal_health=True)),
            ChatRequest(request_id='demo-4', message='I might hurt myself.'),
        ]
        for request in turns:
            request = request.model_copy(update={'session_id':sid})
            response = bot.chat('DEMO_ASTRONAUT', request)
            sid = response.session_id
            print(json.dumps({'synthetic_demo':True, 'model':'synthetic-stub', 'message':request.message,
                              'response':response.model_dump(mode='json')}, indent=2))
        with bot.memory.connect() as db:
            assert db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0] == 0
            assert db.execute('SELECT COUNT(*) FROM moods').fetchone()[0] == 0


if __name__ == '__main__':
    main()
