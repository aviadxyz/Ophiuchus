import os
import pytest
from knowledge_ingestion.focused.runner import LocalFocusedProvider, jobs
from knowledge_ingestion.focused.validation import parse_output
from knowledge_ingestion.focused.safety import BOUNDARY


@pytest.mark.skipif(os.getenv('RUN_FOCUSED_OLLAMA_TEST') != '1', reason='Optional installed local Ollama extraction check')
def test_real_focused_local_model():
    provider=LocalFocusedProvider()
    selected,_=jobs(BOUNDARY,('microbiome',),provider,source_id='source_0bb467f4a071c7fd0a01')
    assert selected
    provider.health_check()
    content=provider.extract_focused(selected[0])
    accepted,rejected,count=parse_output(content,selected[0])
    assert count >= 0
    assert all(record.evidence_text in selected[0]['text'] for record in accepted)
