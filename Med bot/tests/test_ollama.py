import os
import pytest
from medbot.llm import OllamaModel


@pytest.mark.skipif(os.getenv('RUN_OLLAMA_TEST') != '1', reason='Optional installed local Ollama smoke test')
def test_installed_local_model():
    model = OllamaModel()
    result = model.classify({'message':'I feel lonely today.', 'recent_messages':[], 'reply_mode':'standard'})
    assert result.intent in ('mental_health_support', 'emotional_check_in', 'medical_and_emotional')
    reply = model.respond({'message':'I feel lonely today.', 'classification':result.model_dump(),
                           'sources':[], 'actions':[], 'observations':[], 'reply_mode':'standard'})
    assert reply.reply and not reply.source_ids and not reply.action_ids
