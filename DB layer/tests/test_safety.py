import httpx
import pytest
from knowledge_ingestion.crawler import Crawler
from knowledge_ingestion.extraction import Extraction
from knowledge_ingestion.pipeline import materialize,export
from knowledge_ingestion.normalization import EntityResolver
from knowledge_ingestion.storage import atomic_json,read_json
from knowledge_ingestion.review import authorize_protocol
from knowledge_ingestion.queries import KnowledgeBase

def test_robots_and_redirect_allowlist(tmp_path):
    seen=[]
    def handler(request):
        seen.append(str(request.url))
        if request.url.path=='/robots.txt': return httpx.Response(200,text='User-agent: *\nDisallow: /blocked')
        return httpx.Response(302,headers={'location':'https://example.com/external'})
    cfg={'sources':['https://nasa.gov/blocked','https://nasa.gov/redirect'],'max_depth':1,'max_pages':3,'request_delay_seconds':0,'allowed_domains':['nasa.gov']}
    result=Crawler(cfg,tmp_path,httpx.Client(transport=httpx.MockTransport(handler))).run()
    assert all(r['fetch_status']=='failed' for r in result.values())
    assert 'https://nasa.gov/blocked' not in seen
    assert not any('example.com' in s for s in seen)

def test_monitoring_protocol_requires_separate_authorization(tmp_path,monkeypatch):
    quote='A study investigates exercise for bone loss and measures bone density.'
    result=Extraction.model_validate({'source_type':'research_summary','entities':[{'local_id':'c','entity_type':'conditions','canonical_name':'Bone loss','evidence_text':quote},{'local_id':'t','entity_type':'treatments','canonical_name':'Exercise','evidence_text':quote},{'local_id':'b','entity_type':'biomarkers','canonical_name':'Bone density','evidence_text':quote}],'monitoring':[{'biomarker':'b','condition':'c','evidence_text':quote}],'interventions':[{'condition':'c','treatment':'t','indication':'Bone loss','evidence_text':quote}]})
    source={'source_id':'s','source_url':'https://nasa.gov/a','fetch_status':'success'}
    chunk={'chunk_id':'ch','text':quote,'page_number':1,'section':None,'text_location':'characters 0:70'}
    batch=materialize(result,source,chunk,EntityResolver(tmp_path/'registry.json'))
    assert batch['tables']['monitoring/monitoring_guidance'][0]['recommended_frequency'] is None
    protocol=batch['tables']['protocols/candidate_protocols'][0]
    assert protocol['dosage'] is None
    atomic_json(tmp_path/'staging/extracted/ch.json',batch)
    atomic_json(tmp_path/'staging/sources/manifest.json',{'s':source})
    with pytest.raises(ValueError): authorize_protocol(tmp_path,protocol['protocol_id'],'Reviewer')
    for rows in batch['tables'].values():
        for r in rows: r['review_status']='approved'
    atomic_json(tmp_path/'staging/reviewed/ch.json',batch)
    path=export(tmp_path,False); kb=KnowledgeBase(path)
    assert kb.get_approved_protocols(protocol['related_condition_id'])==[]
    monkeypatch.setattr('builtins.input',lambda _: 'AUTHORIZE CLINICAL USE')
    assert authorize_protocol(tmp_path,protocol['protocol_id'],'Reviewer')
    export(tmp_path,False)
    assert len(kb.get_approved_protocols(protocol['related_condition_id']))==1
    assert kb.get_approved_protocols(protocol['related_condition_id'])[0]['authorized_by']=='Reviewer'
