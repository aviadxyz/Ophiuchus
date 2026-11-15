import json
from types import SimpleNamespace
import pytest
from medbot.llm import OllamaModel
from medbot.models import Classification


class Provider:
    settings = SimpleNamespace(num_predict=2048, num_ctx=8192)

    def __init__(self, content):
        self.content, self.calls = content, []

    def _chat(self, messages, schema, num_predict=None):
        self.calls.append((messages, schema, num_predict))
        return self.content


def test_required_complete_structured_schema_and_bounded_generation():
    payload = Classification(intent='mental_health_support', mood='lonely').model_dump()
    model = OllamaModel()
    provider = Provider(json.dumps(payload))
    model.provider = provider
    assert model.classify({'message':'Synthetic test'}).intent == 'mental_health_support'
    _, schema, limit = provider.calls[0]
    assert set(schema['required']) == set(schema['properties'])
    assert all('default' not in f for f in schema['properties'].values())
    assert limit == 512


def test_omitted_classification_fields_rejected():
    model = OllamaModel()
    model.provider = Provider('{"mood":"sad"}')
    with pytest.raises(ValueError, match='omitted'):
        model.classify({'message':'Synthetic test'})


def test_oversized_context_is_rejected_before_request():
    model = OllamaModel()
    model.provider = Provider('{}')
    with pytest.raises(ValueError, match='budget'):
        model.classify({'message':'x'*30000})
    assert not model.provider.calls
