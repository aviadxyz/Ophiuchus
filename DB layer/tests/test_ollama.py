import json
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
import ollama
from pydantic import ValidationError

from knowledge_ingestion.extraction import Extraction, create_provider, PROMPT
from knowledge_ingestion.extraction.ollama_provider import OllamaExtractor, OllamaUnavailable
from knowledge_ingestion.extraction.cache import extraction_identity
from knowledge_ingestion.pipeline import extract, export, report, materialize
from knowledge_ingestion.normalization import EntityResolver
from knowledge_ingestion.parsers import chunks
from knowledge_ingestion.storage import atomic_json, read_json


@pytest.fixture
def local(monkeypatch):
    for name in ('LLM_PROVIDER','OLLAMA_BASE_URL','OLLAMA_MODEL','OLLAMA_TEMPERATURE','OLLAMA_NUM_CTX','OLLAMA_NUM_PREDICT','OLLAMA_TIMEOUT_SECONDS','EXTRACTION_CHUNK_SIZE','EXTRACTION_CHUNK_OVERLAP','GEMINI_API_KEY','OPENAI_API_KEY'):
        monkeypatch.delenv(name,raising=False)
    client=Mock()
    client.list.return_value=SimpleNamespace(models=[SimpleNamespace(model='qwen3:4b-instruct')])
    client.show.return_value=SimpleNamespace(model_dump=lambda: {})
    client.chat.return_value=SimpleNamespace(done=True,done_reason='stop',message=SimpleNamespace(content='{"ready":true}'))
    monkeypatch.setattr(ollama,'Client',Mock(return_value=client))
    return client


def test_default_provider_and_health_without_cloud_credentials(local):
    provider=create_provider()
    assert isinstance(provider,OllamaExtractor)
    assert provider.health_check()['status']=='ready'
    request=local.chat.call_args.kwargs
    assert request['stream'] is False
    assert request['format']['properties']['ready']['type']=='boolean'
    assert ollama.Client.call_args.kwargs['trust_env'] is False


def test_structured_schema_and_options(local,monkeypatch):
    monkeypatch.setenv('OLLAMA_NUM_CTX','10000')
    monkeypatch.setenv('OLLAMA_NUM_PREDICT','3000')
    provider=OllamaExtractor()
    payload=Extraction(source_type='research_summary')
    local.chat.return_value.message.content=payload.model_dump_json()
    assert provider.extract('Research text')==payload
    kwargs=local.chat.call_args.kwargs
    assert kwargs['format']==Extraction.model_json_schema()
    assert kwargs['messages']==[{'role':'system','content':PROMPT},{'role':'user','content':'Research text'}]
    assert kwargs['options']['num_ctx']==10000
    assert kwargs['options']['num_predict']==3000
    assert kwargs['options']['temperature']==0

def test_focused_ollama_relationship_schema(local):
    fixture=read_json(__import__('pathlib').Path('tests/fixtures/nasa_bone_relationship.json'))
    local.chat.return_value.message.content=json.dumps(fixture['output'])
    provider=OllamaExtractor()
    result=provider.extract_relationships(fixture['text'],source_type='risk_description')
    assert len(result.claims)==1 and len(result.entities)==2
    assert result.source_type=='risk_description'
    request=local.chat.call_args.kwargs
    assert 'relationships' in request['format']['properties']
    assert 'entities' not in request['format']['properties']
    assert request['options']['num_predict']<=1024

def test_focused_attribute_schema_uses_existing_ids(local):
    provider=OllamaExtractor()
    local.chat.return_value.message.content='{"additions":[]}'
    targets=[{'entity_id':'known-id','canonical_name':'Vitamin D','fields':['treatment_type']}]
    assert provider.extract_attributes('Vitamin D is a supplement.',targets)=='{"additions":[]}'
    request=local.chat.call_args.kwargs
    properties=request['format']['$defs']['AttributeCandidate']['properties']
    assert properties['entity_id']['enum']==['known-id']
    assert properties['field']['enum']==['treatment_type']
    assert request['options']['num_predict']==1024


def test_unavailable_server(local):
    local.list.side_effect=ConnectionError('refused')
    with pytest.raises(OllamaUnavailable,match='Ollama server unavailable. Please start Ollama.'):
        OllamaExtractor().health_check()
    local.chat.assert_not_called()


def test_missing_model(local):
    local.list.return_value.models=[]
    with pytest.raises(OllamaUnavailable,match='ollama pull qwen3:4b-instruct'):
        OllamaExtractor().health_check()
    local.chat.assert_not_called()


@pytest.mark.parametrize('content,reason', [('', 'stop'),('{"source_type":"research_summary"}','length')])
def test_empty_and_truncated(local,content,reason):
    local.chat.return_value.message.content=content
    local.chat.return_value.done_reason=reason
    with pytest.raises(ValueError): OllamaExtractor().extract('text')


def test_invalid_json_and_timeout(local):
    local.chat.return_value.message.content='not json'
    with pytest.raises(ValidationError): OllamaExtractor().extract('text')
    local.chat.side_effect=httpx.ReadTimeout('slow')
    with pytest.raises(OllamaUnavailable,match='timed out'): OllamaExtractor().extract('text')


def test_local_endpoints_only(local,monkeypatch):
    monkeypatch.setenv('OLLAMA_BASE_URL','https://ollama.com')
    with pytest.raises(ValueError,match='loopback'): OllamaExtractor()
    monkeypatch.setenv('OLLAMA_BASE_URL','http://localhost:11434')
    monkeypatch.setenv('OLLAMA_MODEL','qwen3:cloud')
    with pytest.raises(ValueError,match='cloud'): OllamaExtractor()


def test_unknown_provider_never_falls_back(local,monkeypatch):
    monkeypatch.setenv('LLM_PROVIDER','typo')
    with pytest.raises(ValueError,match='Unknown LLM_PROVIDER'): create_provider()


def test_context_budget(local,monkeypatch):
    monkeypatch.setenv('OLLAMA_NUM_CTX','2048')
    monkeypatch.setenv('OLLAMA_NUM_PREDICT','512')
    with pytest.raises(ValueError,match='context budget'): OllamaExtractor().extract('text')
    local.chat.assert_not_called()

def test_relationship_context_budget(local,monkeypatch):
    monkeypatch.setenv('OLLAMA_NUM_CTX','2048')
    monkeypatch.setenv('OLLAMA_NUM_PREDICT','512')
    with pytest.raises(ValueError,match='context budget'):
        OllamaExtractor().extract_relationships('Source text. '*200)
    local.chat.assert_not_called()


def test_cache_identity_versions_and_settings(local,monkeypatch):
    from knowledge_ingestion.extraction import cache
    p=OllamaExtractor(); first=extraction_identity('text',p)[0]
    assert extraction_identity('text',p)[0]==first
    assert extraction_identity('changed text',p)[0]!=first
    p.model='another-local-model'
    assert extraction_identity('text',p)[0]!=first
    p.model='qwen3:4b-instruct'
    monkeypatch.setattr(cache,'PROMPT_VERSION','new')
    assert extraction_identity('text',p)[0]!=first


def test_sentence_chunks_keep_provenance(monkeypatch):
    text='First sentence. Second sentence. Third sentence. Fourth sentence.'
    doc={'source_id':'s','source_url':'https://nasa.gov/test','pages':[{'page_number':2,'section':'Test','text':text}]}
    parts=list(chunks(doc,size=40,overlap=10))
    assert parts[0]['text'].endswith('Second sentence. ')
    assert all(p['source_url']==doc['source_url'] and p['original_text']==p['text'] for p in parts)
    for part in parts:
        start,end=map(int,part['text_location'].removeprefix('characters ').split(':'))
        assert text[start:end]==part['text']


def seed(root):
    quote='Microgravity is associated with bone loss.'
    source={'source_id':'s','source_url':'https://nasa.gov/test','fetch_status':'success','cache_path':'cache/s.json'}
    atomic_json(root/'staging/sources/manifest.json',{'s':source})
    doc={'source_id':'s','source_url':source['source_url'],'pages':[{'page_number':None,'text':quote}]}
    atomic_json(root/'cache/s.json',doc)
    payload=Extraction.model_validate({'source_type':'research_summary','entities':[{'local_id':'r','entity_type':'risk_factors','canonical_name':'Microgravity','evidence_text':quote},{'local_id':'c','entity_type':'conditions','canonical_name':'Bone loss','evidence_text':quote}],'claims':[{'subject':'r','object':'c','predicate':'associated_with','claim_text':quote,'evidence_text':quote}]})
    return source,doc,payload


def test_local_integration_resume_and_cache(local,tmp_path):
    source,doc,payload=seed(tmp_path)
    provider=OllamaExtractor()
    local.chat.side_effect=[SimpleNamespace(done=True,done_reason='stop',message=SimpleNamespace(content='{"ready":true}')),SimpleNamespace(done=True,done_reason='stop',message=SimpleNamespace(content=payload.model_dump_json()))]
    result=extract(tmp_path,provider)
    assert result['entities_extracted']==2 and result['relations_extracted']==1
    local.chat.side_effect=None
    local.chat.return_value.message.content='{"ready":true}'
    result=extract(tmp_path,provider)
    assert result['extraction_status']['chunks_skipped']==1
    assert local.chat.call_count==3  # two health probes and one actual extraction
    assert list((tmp_path/'cache/extractions').glob('*.json'))
    export(tmp_path)
    assert report(tmp_path)['claims_awaiting_review']==3


def test_reuse_validated_legacy_gemini_work(local,tmp_path):
    source,doc,payload=seed(tmp_path)
    chunk=next(chunks(doc,size=6000,overlap=400))
    legacy=materialize(payload,source,chunk,EntityResolver(tmp_path/'staging/registry.json'))
    path=tmp_path/'staging/extracted'/f"{chunk['chunk_id']}.json"
    atomic_json(path,legacy)
    before=path.read_bytes()
    result=extract(tmp_path,OllamaExtractor())
    assert result['extraction_status']['chunks_skipped']==1
    assert local.chat.call_count==1  # health probe only
    assert path.read_bytes()==before


def test_raw_cache_reused_across_sources(local,tmp_path):
    source,doc,payload=seed(tmp_path)
    other={**source,'source_id':'s2','source_url':'https://nasa.gov/other','cache_path':'cache/s2.json'}
    atomic_json(tmp_path/'staging/sources/manifest.json',{'s':source,'s2':other})
    atomic_json(tmp_path/'cache/s2.json',{**doc,'source_id':'s2','source_url':other['source_url']})
    class Provider:
        model='mock-local'
        calls=0
        def extract(self,text):
            self.calls+=1
            return payload
    provider=Provider()
    result=extract(tmp_path,provider)
    assert provider.calls==1
    assert result['extraction_status']['cache_hits']==1
    assert result['documents_extracted']==2


def test_resume_after_interruption(local,tmp_path):
    from tests.test_extraction_status import seed as seed_multiple
    seed_multiple(tmp_path)
    class Provider:
        model='mock-local'
        def extract(self,text): return Extraction(source_type='general_information')
    # One successful checkpoint survives before a new document is interrupted.
    provider=Provider()
    extract(tmp_path,provider,max_chunks=1)
    paths=list((tmp_path/'staging/extracted').glob('*.json'))
    assert len(paths)==1
    # Delete only the derived raw cache file in this temporary fixture to force
    # another model request; the committed staging checkpoint stays untouched.
    for p in (tmp_path/'cache/extractions').glob('*.json'): p.unlink()
    failing=Mock(side_effect=KeyboardInterrupt())
    provider.extract=failing
    with pytest.raises(KeyboardInterrupt): extract(tmp_path,provider)
    assert len(list((tmp_path/'staging/extracted').glob('*.json')))==1
    provider.extract=lambda text: Extraction(source_type='general_information')
    result=extract(tmp_path,provider)
    assert result['extraction_status']['chunks_skipped']==1
    assert result['chunks_extracted']==3
