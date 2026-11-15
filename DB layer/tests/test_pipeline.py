import csv
from pathlib import Path
import httpx
import pytest
from pydantic import ValidationError
from knowledge_ingestion.crawler import normalize_url,Crawler
from knowledge_ingestion.parsers import parse_document,chunks
from knowledge_ingestion.extraction import Extraction
from knowledge_ingestion.validation import verify_evidence
from knowledge_ingestion.normalization import EntityResolver
from knowledge_ingestion.storage import atomic_json,read_json,SCHEMAS
from knowledge_ingestion.pipeline import extract,export,report
from knowledge_ingestion.queries import KnowledgeBase

QUOTE='Microgravity is associated with bone loss.'
def response():
    return Extraction.model_validate({'source_type':'research_summary','entities':[{'local_id':'r','entity_type':'risk_factors','canonical_name':'Microgravity','evidence_text':QUOTE},{'local_id':'c','entity_type':'conditions','canonical_name':'Bone loss','evidence_text':QUOTE}], 'claims':[{'subject':'r','object':'c','predicate':'associated_with','claim_text':QUOTE,'evidence_text':QUOTE}]})

class MockProvider:
    def extract(self,text): return response()

def test_url():
    assert normalize_url('HTTPS://NASA.GOV/a?utm_source=x&b=2&a=1#part')=='https://nasa.gov/a?a=1&b=2'
    with pytest.raises(ValueError): normalize_url('javascript:bad')

def test_html_chunks():
    doc=parse_document(Path('tests/fixtures/article.html').read_bytes(),'text/html','https://nasa.gov/a')
    assert 'navigation' not in doc['pages'][0]['text'] and 'ignore footer' not in doc['pages'][0]['text']
    doc['source_id']='s'; parts=list(chunks(doc,size=30,overlap=5))
    assert len(parts)>1 and parts==list(chunks(doc,size=30,overlap=5))

def test_pdf(tmp_path):
    import fitz
    doc=fitz.open(); page=doc.new_page(); page.insert_text((50,50),QUOTE)
    path=tmp_path/'fixture.pdf'; doc.save(path); doc.close()
    result=parse_document(path.read_bytes(),'application/pdf',str(path))
    assert result['pages'][0]['page_number']==1 and QUOTE in result['pages'][0]['text']

def test_validation():
    assert response().entities[0].attributes.unit is None
    data=response().model_dump(); data['claims'][0]['object']='missing'
    with pytest.raises(ValidationError): Extraction.model_validate(data)
    data=response().model_dump(); data['claims'][0]['evidence_status']='approved_protocol'
    with pytest.raises(ValidationError): Extraction.model_validate(data)
    assert verify_evidence('Microgravity  is associated',QUOTE)
    assert not verify_evidence('Microgravity causes bone loss',QUOTE)

def test_resolver(tmp_path):
    path=tmp_path/'registry.json'; r=EntityResolver(path)
    a=r.resolve('conditions','Bone Loss')
    assert EntityResolver(path).resolve('conditions',' bone loss ')==a
    r.add_reviewed_alias('conditions','BMD reduction',a)
    assert r.resolve('conditions','BMD reduction')==a
    assert r.resolve('conditions','Osteoporosis')!=a

def seed(root):
    source={'source_id':'s','source_url':'https://nasa.gov/a','fetch_status':'success','cache_path':'cache/s.json','review_status':'pending'}
    atomic_json(root/'staging/sources/manifest.json',{'s':source})
    atomic_json(root/'cache/s.json',{'source_id':'s','pages':[{'page_number':None,'text':QUOTE}]})

def test_integration_idempotence_exports(tmp_path):
    seed(tmp_path); extract(tmp_path,MockProvider()); first=report(tmp_path)
    extract(tmp_path,MockProvider()); second=report(tmp_path)
    assert second['entities_extracted']==first['entities_extracted']
    assert second['relations_extracted']==first['relations_extracted']
    assert second['claims_awaiting_review']==first['claims_awaiting_review']
    assert second['extraction_status']['chunks_skipped']==1
    assert first['entities_extracted']==2 and first['relations_extracted']==1
    draft=export(tmp_path); approved=export(tmp_path,False)
    def rows(path):
        with path.open(encoding='utf-8',newline='') as f: return list(csv.DictReader(f))
    assert len(rows(draft/'evidence/knowledge_claims.csv'))==3
    assert not rows(approved/'evidence/knowledge_claims.csv')
    assert not KnowledgeBase(approved).search_medical_knowledge('bone')
    for path in (tmp_path/'staging/extracted').glob('*.json'):
        batch=read_json(path)
        for rs in batch['tables'].values():
            for r in rs: r['review_status']='approved'
        atomic_json(tmp_path/'staging/reviewed'/path.name,batch)
    export(tmp_path,False)
    kb=KnowledgeBase(approved); assert kb.search_medical_knowledge('bone')
    assert kb.get_approved_protocols('anything')==[]
    for table,fields in SCHEMAS.items():
        with (draft/(table+'.csv')).open(encoding='utf-8') as f: assert next(csv.reader(f))==fields.split()

def test_reject_missing_and_preserve_conflict(tmp_path):
    from knowledge_ingestion.pipeline import materialize
    result=response(); result.claims.append(result.claims[0].model_copy(update={'claim_text':'Association uncertain','limitations':'Conflicting result'}))
    result.claims.append(result.claims[0].model_copy(update={'evidence_text':'This quote is invented.'}))
    b=materialize(result,{'source_id':'s','source_url':'https://nasa.gov/a'},{'chunk_id':'ch','text':QUOTE,'page_number':None,'section':None,'text_location':'characters 0:40'},EntityResolver(tmp_path/'ids.json'))
    assert len(b['tables']['relations/risk_condition'])==2
    assert len(b['rejected'])==1

def test_crawler_duplicate_and_failure(tmp_path):
    calls=[]
    def handler(request):
        calls.append(str(request.url))
        if request.url.path=='/robots.txt': return httpx.Response(200,text='User-agent: *\nAllow: /')
        if request.url.path=='/bad': return httpx.Response(404)
        return httpx.Response(200,headers={'content-type':'text/html'},text='<article>'+QUOTE+'</article>')
    config={'sources':['https://nasa.gov/a','https://nasa.gov/a#fragment','https://nasa.gov/b','https://nasa.gov/bad'],'max_depth':0,'max_pages':10,'request_delay_seconds':0,'allowed_domains':['nasa.gov']}
    result=Crawler(config,tmp_path,httpx.Client(transport=httpx.MockTransport(handler))).run()
    assert len(result)==3 and calls.count('https://nasa.gov/a')==1
    assert sum(bool(r.get('duplicate_of')) for r in result.values())==1
    assert sum(r['fetch_status']=='failed' for r in result.values())==1
