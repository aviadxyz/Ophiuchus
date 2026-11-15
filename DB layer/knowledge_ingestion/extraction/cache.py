"""Versioned raw structured-result cache, separate from source-linked staging."""
import hashlib
import json
from knowledge_ingestion.extraction import Extraction, SCHEMA_VERSION, PROMPT_VERSION, PROMPT
from knowledge_ingestion.storage import stable_id


def extraction_identity(text,provider,mode='generic'):
    settings=getattr(provider,'cache_settings',lambda: {})()
    metadata={'input_content_hash':hashlib.sha256(text.encode()).hexdigest(),
        'provider':type(provider).__name__,'model':getattr(provider,'model',None),
        'schema_version':SCHEMA_VERSION,'prompt_version':PROMPT_VERSION,
        'schema_hash':hashlib.sha256(json.dumps(Extraction.model_json_schema(),sort_keys=True).encode()).hexdigest(),
        'prompt_hash':hashlib.sha256(PROMPT.encode()).hexdigest(),'settings':settings}
    if mode=='relations_first':
        import os
        from knowledge_ingestion.extraction.relationships import RELATION_PROMPT,RELATION_PROMPT_VERSION,RelationshipOutput
        metadata.update(mode=mode,prompt_version=RELATION_PROMPT_VERSION,prompt_hash=hashlib.sha256(RELATION_PROMPT.encode()).hexdigest(),schema_hash=hashlib.sha256(json.dumps(RelationshipOutput.model_json_schema(),sort_keys=True).encode()).hexdigest(),relation_num_predict=os.getenv('RELATION_NUM_PREDICT','1024'))
    return stable_id('extraction',metadata),metadata
