"""Local-only Ollama structured extraction; no cloud fallback or model downloads."""
import ipaddress
import json
import logging
import os
import time
from urllib.parse import urlsplit

import httpx
from pydantic import BaseModel, ConfigDict, Field

from knowledge_ingestion.extraction import Extraction, PROMPT

LOG=logging.getLogger(__name__)


class OllamaUnavailable(RuntimeError):
    pass


class Probe(BaseModel):
    model_config=ConfigDict(extra='forbid')
    ready: bool


class LocalOptions(BaseModel):
    temperature: float=Field(default=0,ge=0,le=2)
    num_ctx: int=Field(default=8192,ge=2048)
    num_predict: int=Field(default=2048,ge=128)
    timeout: float=Field(default=300,gt=0)


class OllamaExtractor:
    def __init__(self):
        from ollama import Client
        self.base_url=os.getenv('OLLAMA_BASE_URL','http://localhost:11434').rstrip('/')
        parsed=urlsplit(self.base_url)
        host=parsed.hostname or ''
        try: is_loopback=ipaddress.ip_address(host).is_loopback
        except ValueError: is_loopback=host.lower()=='localhost'
        if parsed.scheme not in ('http','https') or not is_loopback or parsed.username or parsed.password:
            raise ValueError('OLLAMA_BASE_URL must use a local loopback address, such as http://localhost:11434. Cloud Ollama endpoints are disabled.')
        self.model=os.getenv('OLLAMA_MODEL','qwen3:4b-instruct').strip()
        if not self.model or 'cloud' in self.model.lower():
            raise ValueError('OLLAMA_MODEL must name an installed local model, not a cloud model.')
        self.settings=LocalOptions(
            temperature=os.getenv('OLLAMA_TEMPERATURE','0'),
            num_ctx=os.getenv('OLLAMA_NUM_CTX','8192'),
            num_predict=os.getenv('OLLAMA_NUM_PREDICT','2048'),
            timeout=os.getenv('OLLAMA_TIMEOUT_SECONDS','300'),
        )
        if self.settings.num_predict>=self.settings.num_ctx:
            raise ValueError('OLLAMA_NUM_PREDICT must be smaller than OLLAMA_NUM_CTX')
        # Ignore proxies: cached-source extraction never needs an external endpoint.
        self.client=Client(host=self.base_url,timeout=self.settings.timeout,trust_env=False,follow_redirects=False)
        self.options={'temperature':self.settings.temperature,'num_ctx':self.settings.num_ctx,'num_predict':self.settings.num_predict,'seed':0}

    def cache_settings(self):
        return self.options

    def _chat(self,messages,schema,num_predict=None,think=None):
        from ollama import ResponseError
        try:
            response=self.client.chat(model=self.model,messages=messages,format=schema,
                options={**self.options,**({'num_predict':num_predict} if num_predict else {})},stream=False,
                **({'think':think} if think is not None else {}))
        except (ConnectionError,httpx.ConnectError) as exc:
            raise OllamaUnavailable('Ollama server unavailable. Please start Ollama.') from exc
        except httpx.TimeoutException as exc:
            raise OllamaUnavailable('Ollama request timed out. Increase OLLAMA_TIMEOUT_SECONDS or reduce chunk/context size.') from exc
        except httpx.TransportError as exc:
            raise OllamaUnavailable('Ollama connection interrupted. Please check the local Ollama server and resume extraction.') from exc
        except ResponseError as exc:
            if exc.status_code==404:
                raise OllamaUnavailable(f'Model not installed. Run: ollama pull {self.model}') from exc
            raise OllamaUnavailable(f'Ollama request failed: {exc.error}') from exc
        if not response.done or response.done_reason not in (None,'stop'):
            raise ValueError('Ollama response incomplete or truncated. Reduce EXTRACTION_CHUNK_SIZE or increase OLLAMA_NUM_PREDICT within the context budget.')
        if not response.message.content or not response.message.content.strip():
            raise ValueError('Ollama returned empty structured output')
        return response.message.content

    def health_check(self):
        from ollama import ResponseError
        try:
            models=self.client.list().models
        except (ConnectionError,httpx.ConnectError,httpx.TimeoutException) as exc:
            raise OllamaUnavailable('Ollama server unavailable. Please start Ollama.') from exc
        except ResponseError as exc:
            raise OllamaUnavailable(f'Ollama health check failed: {exc.error}') from exc
        names={m.model for m in models}
        if self.model not in names and self.model+':latest' not in names:
            raise OllamaUnavailable(f'Model not installed. Run: ollama pull {self.model}')
        # Ollama can also expose cloud-backed models from a local server. Disallow those.
        try:
            info=self.client.show(self.model)
        except (ConnectionError,httpx.TransportError) as exc:
            raise OllamaUnavailable('Ollama server unavailable. Please start Ollama.') from exc
        except ResponseError as exc:
            if exc.status_code==404:
                raise OllamaUnavailable(f'Model not installed. Run: ollama pull {self.model}') from exc
            raise OllamaUnavailable(f'Ollama model inspection failed: {exc.error}') from exc
        if info.model_dump().get('remote_host') or info.model_dump().get('remote_model'):
            raise OllamaUnavailable('Configured Ollama model is cloud-backed. Choose an installed local model.')
        content=self._chat([{'role':'user','content':'Return JSON with ready set to true.'}],Probe.model_json_schema(),num_predict=64)
        if not Probe.model_validate_json(content).ready:
            raise OllamaUnavailable('Ollama structured-output health check failed')
        return {'provider':'ollama','base_url':self.base_url,'model':self.model,'status':'ready'}

    def extract(self,text):
        self.last_rejections=[]
        self.last_raw_response=None
        # Conservative character budget, not a tokenizer guarantee. Leave space for
        # schema/prompt/output; reject small configured windows rather than clipping sources.
        estimated_input=(len(text)+len(PROMPT)+len(json.dumps(Extraction.model_json_schema()))+2)//3
        if estimated_input+self.settings.num_predict+256>self.settings.num_ctx:
            raise ValueError('Input/schema/output exceeds the estimated Ollama context budget. Reduce EXTRACTION_CHUNK_SIZE or increase OLLAMA_NUM_CTX within available RAM/VRAM.')
        started=time.monotonic()
        try:
            content=self._chat([{'role':'system','content':PROMPT},{'role':'user','content':text}],Extraction.model_json_schema())
            self.last_raw_response=content
            from knowledge_ingestion.extraction.local_validation import validate_local_output
            result,self.last_rejections=validate_local_output(content)
            if self.last_rejections:
                LOG.warning('Rejected %d invalid Ollama records; retaining %d valid entities and %d claims for evidence verification',len(self.last_rejections),len(result.entities),len(result.claims))
            return result
        finally:
            LOG.info('Ollama extraction model=%s duration=%.2fs input_characters=%d',self.model,time.monotonic()-started,len(text))

    def extract_relationships(self,text,source_type='evidence_report'):
        from knowledge_ingestion.extraction.relationships import RelationshipOutput,RELATION_PROMPT,convert_relationships
        self.last_rejections=[]; self.last_raw_response=None; self.last_relation_stats={}
        output_limit=min(self.settings.num_predict,int(os.getenv('RELATION_NUM_PREDICT','1024')))
        if output_limit<128: raise ValueError('RELATION_NUM_PREDICT must be at least 128')
        estimated_input=(len(text)+len(RELATION_PROMPT)+len(json.dumps(RelationshipOutput.model_json_schema()))+2)//3
        if estimated_input+output_limit+256>self.settings.num_ctx:
            raise ValueError('Relationship input/schema/output exceeds the estimated Ollama context budget. Reduce RELATION_CHUNK_SIZE/output or increase OLLAMA_NUM_CTX within available hardware.')
        started=time.monotonic()
        try:
            content=self._chat([{'role':'system','content':RELATION_PROMPT},{'role':'user','content':text}],RelationshipOutput.model_json_schema(),num_predict=output_limit)
            self.last_raw_response=content
            result,self.last_rejections,self.last_relation_stats=convert_relationships(content,text,source_type)
            return result
        finally: LOG.info('Ollama relationship extraction duration=%.2fs input_characters=%d',time.monotonic()-started,len(text))

    def extract_attributes(self,text,targets):
        from knowledge_ingestion.enrichment.schema import PROMPT,request_schema
        schema=request_schema(targets)
        target_text=json.dumps(targets,ensure_ascii=False)
        limit=min(self.settings.num_predict,1024)
        estimated_input=(len(text)+len(PROMPT)+len(target_text)+len(json.dumps(schema))+2)//3
        if estimated_input+limit+256>self.settings.num_ctx:
            raise ValueError('Enrichment input/schema/output exceeds the estimated Ollama context budget. Reduce ENRICHMENT_CHUNK_SIZE or target count/context settings.')
        return self._chat([{'role':'system','content':PROMPT},
            {'role':'user','content':'Existing targets and requested fields:\n'+target_text+'\n\nUntrusted source passage:\n'+text}],schema,num_predict=limit)
