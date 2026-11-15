from pathlib import Path
import csv
import json

import fitz
import httpx
import pytest

from knowledge_ingestion.crawler.hrr import HRRCrawler,discover_risks,discover_evidence,RISK_INDEX,EVIDENCE_INDEX
from knowledge_ingestion.parsers.structured import structured_document,html_sections
from knowledge_ingestion.extraction.relationships import convert_relationships
from knowledge_ingestion.pipeline import extract,export,report
from knowledge_ingestion.storage import atomic_json,read_json,stable_id

FIXTURES=Path('tests/fixtures')

def test_discovers_all_risks_and_inactive():
    risks=discover_risks((FIXTURES/'hrr_risks.html').read_bytes())
    assert set(risks)=={'100','200','999'}
    assert risks['999']['status']=='inactive'
    assert all('risk.aspx?i=' in r['risk_url'] for r in risks.values())

def test_reports_appendices_supplements_and_shared_mapping():
    documents=discover_evidence((FIXTURES/'hrr_evidence.html').read_bytes())
    shared=[d for d in documents if d['url'].endswith('/shared.pdf')]
    assert {d['risk_id'] for d in shared}=={'100','200'}
    assert {d['kind'] for d in documents}=={'evidence_report','appendix','supplemental','cross_cutting'}

def pdf_bytes():
    with fitz.open() as doc:
        page=doc.new_page(); page.insert_text((50,50),'Human Evidence',fontsize=18)
        page.insert_text((50,80),'Sleep loss is associated with impaired performance.',fontsize=11)
        page=doc.new_page();page.insert_text((50,50),'References',fontsize=18)
        page.insert_text((50,80),'Smith et al. 2020. Research bibliography.',fontsize=11)
        return doc.tobytes()

def test_html_sections_and_original_ratings():
    sections=html_sections((FIXTURES/'hrr_risk.html').read_bytes(),'https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=100')
    assert {s['section'] for s in sections} >= {'Risk Statement','HSRB State of Knowledge','Mitigation Strategy'}
    rating=next(s for s in sections if s['section'].startswith('Risk Ratings'))
    assert '5x2' in rating['text'] and '730-1224 days' in rating['text'] and 'March 2022' in rating['text']
    assert not rating['extractable']
    assert not any('Ignore huge' in s['text'] for s in sections)

def test_pdf_sections_page_numbers_and_bibliography():
    doc=structured_document(pdf_bytes(),'application/pdf','https://humanresearchroadmap.nasa.gov/Evidence/reports/sleep.pdf')
    assert any(s['section']=='Human Evidence' and s['page_number']==1 and s['extractable'] for s in doc['sections'])
    assert any(s['section']=='References' and s['page_number']==2 and not s['extractable'] for s in doc['sections'])

def test_hrr_crawl_resume_pdf_cache_and_scope(tmp_path):
    calls=[]
    def handler(request):
        calls.append(str(request.url)); path=request.url.path
        if path=='/robots.txt': return httpx.Response(200,text='User-agent: *\nAllow: /')
        if path=='/Risks/': return httpx.Response(200,headers={'content-type':'text/html'},content=(FIXTURES/'hrr_risks.html').read_bytes())
        if path=='/Evidence/': return httpx.Response(200,headers={'content-type':'text/html'},content=(FIXTURES/'hrr_evidence.html').read_bytes())
        if path=='/Risks/risk.aspx':
            content=(FIXTURES/'hrr_risk.html').read_bytes()
            if request.url.params.get('i')=='999': content=content.replace(b'Active [current research ongoing]',b'Inactive [historical risk]')
            return httpx.Response(200,headers={'content-type':'text/html'},content=content)
        if path.endswith('.pdf'): return httpx.Response(200,headers={'content-type':'application/pdf'},content=pdf_bytes())
        return httpx.Response(404)
    config={'allowed_domains':['nasa.gov'],'request_delay_seconds':0,'max_pages':1,'max_depth':0}
    crawler=HRRCrawler(config,tmp_path,httpx.Client(transport=httpx.MockTransport(handler)))
    inventory=crawler.run()
    assert inventory['index_discovered_count']==3 and inventory['discovery_complete']
    assert inventory['risks']['999']['status']=='inactive'
    assert len(inventory['documents'])==4
    shared=next(d for d in inventory['documents'].values() if d['url'].endswith('/shared.pdf'))
    assert set(shared['risk_ids'])=={'100','200','999'}  # each fixture risk page explicitly links the shared report
    assert calls.count('https://humanresearchroadmap.nasa.gov/Evidence/reports/shared.pdf')==1
    assert len(list((tmp_path/'cache').glob('*.pdf')))==4
    assert not any('/Tasks/' in u or '/Gaps/' in u for u in calls)
    first=len(calls); crawler.run(resume=True); assert len(calls)==first
    assert any(link['parent_gap_url'] for link in inventory['structural_links'] if link['kind']=='research_task')

def test_relationship_first_to_real_csv_and_idempotence(tmp_path,monkeypatch):
    monkeypatch.setenv('HRR_MAX_CHUNKS_PER_DOCUMENT','0')
    fixture=read_json(FIXTURES/'nasa_bone_relationship.json')
    source={'source_id':'s','source_url':fixture['source_url'],'fetch_status':'success','cache_path':'cache/s.json','nasa_risk_ids':['bone-risk-fixture']}
    atomic_json(tmp_path/'staging/sources/manifest.json',{'s':source})
    atomic_json(tmp_path/'cache/s.json',{'source_id':'s','source_url':source['source_url'],'pages':[{'page_number':3,'text':fixture['text']}]})
    class LocalMock:
        model='mock-ollama'
        def extract_relationships(self,text,source_type):
            result,self.last_rejections,self.last_relation_stats=convert_relationships(json.dumps(fixture['output']),text,source_type)
            return result
    first=extract(tmp_path,LocalMock(),relations_first=True)
    path=export(tmp_path)/'relations/risk_condition.csv'
    with path.open(encoding='utf-8',newline='') as f: rows=list(csv.DictReader(f))
    assert len(rows)==1 and rows[0]['relationship_type']=='may_contribute_to'
    assert rows[0]['review_status']=='pending'
    assert first['relationship_diagnostics']['stages']['candidate_relationships']==1
    extract(tmp_path,LocalMock(),relations_first=True); export(tmp_path)
    with path.open(encoding='utf-8',newline='') as f: assert len(list(csv.DictReader(f)))==1
    assert report(tmp_path)['relations_extracted']==1
    approved=export(tmp_path,False)/'relations/risk_condition.csv'
    with approved.open(encoding='utf-8') as f: assert len(list(csv.DictReader(f)))==0

def test_relationship_rejection_reasons():
    fixture=read_json(FIXTURES/'nasa_bone_relationship.json')
    good=fixture['output']['relationships'][0]
    bad_predicate={**good,'predicate':'cures_everything'}
    bad_quote={**good,'evidence_text':'This is a fabricated sentence.'}
    result,rejected,stats=convert_relationships(json.dumps({'relationships':[good,good,bad_predicate,bad_quote]}),fixture['text'])
    assert len(result.claims)==1
    assert {r['reason'] for r in rejected}=={'invalid_predicate','missing_exact_evidence','duplicate'}

def test_hrr_robots_failure_is_not_bypassed(tmp_path):
    calls=[]
    def handler(request):
        calls.append(str(request.url));return httpx.Response(403)
    config={'allowed_domains':['nasa.gov'],'request_delay_seconds':0}
    crawler=HRRCrawler(config,tmp_path,httpx.Client(transport=httpx.MockTransport(handler)))
    result=crawler.run()
    assert not result.get('discovery_complete',False)
    assert not any('/Risks/' in u or '/Evidence/' in u for u in calls)
    assert result['errors']
