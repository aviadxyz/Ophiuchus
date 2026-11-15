from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from pydantic import ValidationError
from google import genai
from google.genai import types

from knowledge_ingestion.extraction import Extraction, GeminiProvider, PROMPT


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-key-not-real')
    monkeypatch.setenv('GEMINI_MODEL', 'test-gemini-model')
    client = Mock()
    constructor = Mock(return_value=client)
    monkeypatch.setattr(genai, 'Client', constructor)
    instance = GeminiProvider()
    assert constructor.call_args.kwargs['api_key'] == 'test-key-not-real'
    options = constructor.call_args.kwargs['http_options']
    assert options.timeout == 90_000
    assert options.retry_options.attempts == 3
    return instance


def test_missing_gemini_key(monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY', raising=False)
    monkeypatch.setenv('OPENAI_API_KEY', 'old-key-must-not-be-used')
    with pytest.raises(RuntimeError, match='GEMINI_API_KEY unavailable'):
        GeminiProvider()


def test_default_gemini_model(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'test-key-not-real')
    monkeypatch.delenv('GEMINI_MODEL', raising=False)
    monkeypatch.setattr(genai, 'Client', Mock())
    assert GeminiProvider().model == 'gemini-3.8-flash'


def test_structured_request_and_validation(provider):
    payload = Extraction(source_type='research_summary')
    provider.client.models.generate_content.return_value = SimpleNamespace(
        text=payload.model_dump_json(),
        candidates=[SimpleNamespace(finish_reason=types.FinishReason.STOP)],
    )
    assert provider.extract('Source text') == payload
    request = provider.client.models.generate_content.call_args.kwargs
    assert request['model'] == 'test-gemini-model'
    assert request['contents'] == 'Source text'
    assert request['config'].system_instruction == PROMPT
    assert request['config'].response_mime_type == 'application/json'
    assert request['config'].response_json_schema == Extraction.model_json_schema()


@pytest.mark.parametrize('reason,text', [
    (types.FinishReason.SAFETY, None),
    (types.FinishReason.MAX_TOKENS, '{"source_type":"research_summary"}'),
    (types.FinishReason.STOP, ''),
])
def test_reject_blocked_empty_or_truncated_response(provider, reason, text):
    provider.client.models.generate_content.return_value = SimpleNamespace(
        candidates=[SimpleNamespace(finish_reason=reason)], text=text,
    )
    with pytest.raises(RuntimeError):
        provider.extract('Source text')


def test_validate_gemini_json_locally(provider):
    provider.client.models.generate_content.return_value = SimpleNamespace(
        candidates=[SimpleNamespace(finish_reason=types.FinishReason.STOP)],
        text='{"source_type":"invented_type"}',
    )
    with pytest.raises(ValidationError):
        provider.extract('Source text')
