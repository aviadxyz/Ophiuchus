"""Finite HRR index/risk/document discovery. No guessed IDs or recursive PDF citations."""
from datetime import datetime,timezone
import hashlib
import logging
import re
from pathlib import Path
from urllib.parse import urlsplit,parse_qs,urljoin

from bs4 import BeautifulSoup
from knowledge_ingestion.crawler import Crawler,normalize_url,allowed
from knowledge_ingestion.parsers import normalize_text
from knowledge_ingestion.parsers.structured import structured_document
from knowledge_ingestion.storage import read_json,atomic_json,stable_id,atomic_bytes

LOG=logging.getLogger(__name__)
RISK_INDEX='https://humanresearchroadmap.nasa.gov/Risks/'
EVIDENCE_INDEX='https://humanresearchroadmap.nasa.gov/Evidence/'

def risk_identifier(url):
    p=urlsplit(url)
    return parse_qs(p.query).get('i',[None])[0] if re.search(r'/Risks/risk\.aspx$',p.path,re.I) else None

def discover_risks(html,base=RISK_INDEX):
    result={}
    for a in BeautifulSoup(html,'html.parser').select('a[href]'):
        try: url=normalize_url(urljoin(base,a['href']))
        except ValueError: continue
        rid=risk_identifier(url)
        if rid and urlsplit(url).hostname==urlsplit(RISK_INDEX).hostname:
            title=normalize_text(a.get_text(' ',strip=True))
            if not title: continue
            result[rid]={'nasa_risk_id':rid,'title':title,'risk_url':url,'status':'inactive' if '[inactive]' in title.lower() else 'active','element':None,'in_current_index':True}
    return result

def _document_kind(label,cross_cutting=False):
    label=label.lower()
    if 'appendix' in label or 'appendices' in label: return 'appendix'
    if cross_cutting: return 'cross_cutting'
    if any(s in label for s in ('additional','historical','supplement')): return 'supplemental'
    return 'evidence_report'

def discover_evidence(html,base=EVIDENCE_INDEX):
    soup=BeautifulSoup(html,'html.parser'); found=[]
    if risk_identifier(base):
        for a in soup.select('a[href]'):
            if '.pdf' not in a['href'].lower(): continue
            label=normalize_text(a.get_text(' ',strip=True))
            parent_text=normalize_text(a.parent.get_text(' ',strip=True))
            if re.search(r'evidence report|appendix|supplement|additional evidence',label,re.I) or (re.search(r'\bEvidence\s*:',parent_text,re.I) and len(parent_text)<1000):
                found.append({'url':normalize_url(urljoin(base,a['href'])),'title':label,'risk_id':risk_identifier(base),'kind':_document_kind(label),'discovered_on':base})
        return found
    risk_links=[a for a in soup.select('a[href]') if risk_identifier(urljoin(base,a['href']))]
    assigned=set()
    for risk_link in risk_links:
        rid=risk_identifier(urljoin(base,risk_link['href']))
        # Use the smallest row/container containing this risk and document links.
        container=risk_link.parent
        while container and container.name not in ('body','html'):
            links=container.select('a[href]')
            if any('.pdf' in a['href'].lower() for a in links): break
            container=container.parent
        if not container or container.name in ('body','html'): continue
        # A broad container with multiple risk entries cannot establish associations.
        ids={risk_identifier(urljoin(base,a['href'])) for a in container.select('a[href]') if risk_identifier(urljoin(base,a['href']))}
        if ids!={rid}: continue
        for a in container.select('a[href]'):
            if '.pdf' not in a['href'].lower(): continue
            url=normalize_url(urljoin(base,a['href'])); label=normalize_text(a.get_text(' ',strip=True))
            found.append({'url':url,'title':label,'risk_id':rid,'kind':_document_kind(label),'discovered_on':base})
            assigned.add(id(a))
    for a in soup.select('a[href]'):
        if '.pdf' not in a['href'].lower() or id(a) in assigned: continue
        label=normalize_text(a.get_text(' ',strip=True))
        # Remaining explicit evidence-index PDFs are cross-cutting or overview,
        # not arbitrary references in scientific article bibliographies.
        found.append({'url':normalize_url(urljoin(base,a['href'])),'title':label,'risk_id':None,'kind':_document_kind(label,True),'discovered_on':base})
    return found

def risk_structure(html,url):
    soup=BeautifulSoup(html,'html.parser')
    text=soup.get_text('\n',strip=True)
    metadata={}
    for field,label in [('element','Element'),('short_title','Short Title'),('status_text','HRP Risk Status')]:
        hit=re.search(re.escape(label)+r':\s*([^\n]+)',text,re.I)
        if hit: metadata[field]=normalize_text(hit.group(1))
    if 'status_text' in metadata:
        metadata['status']='inactive' if re.search(r'\binactive\b',metadata['status_text'],re.I) else 'active'
    links=[]
    for a in soup.select('a[href]'):
        href=normalize_url(urljoin(url,a['href'])) if a['href'].startswith(('http','/','../','risk','gap','task')) else None
        if not href: continue
        label=normalize_text(a.get_text(' ',strip=True))
        if re.search(r'/(Gaps|Tasks)/[^/]*\.aspx',urlsplit(href).path,re.I):
            kind='research_gap' if '/gaps/' in href.lower() else 'research_task'
            parent_gap=None
            if kind=='research_task':
                for ancestor in a.parents:
                    if ancestor.name in ('body','html'): break
                    candidates=[g for g in ancestor.select('a[href]') if '/gaps/' in urljoin(url,g['href']).lower()]
                    unique={normalize_url(urljoin(url,g['href'])) for g in candidates}
                    if len(unique)==1: parent_gap=next(iter(unique)); break
                    if len(unique)>1: break
            links.append({'url':href,'title':label,'kind':kind,'parent_gap_url':parent_gap})
    return metadata,links

class HRRCrawler(Crawler):
    def __init__(self,config,root,client=None):
        super().__init__(config,root,client)
        self.rows=read_json(root/'staging/sources/manifest.json',{})
        self.inventory=read_json(root/'staging/sources/hrr_manifest.json',{'risks':{},'documents':{},'associations':[],'structural_links':[],'errors':[]})

    def save(self):
        atomic_json(self.root/'staging/sources/manifest.json',self.rows)
        atomic_json(self.root/'staging/sources/hrr_manifest.json',self.inventory)

    def fetch(self,url,resume=True,parent=None):
        url=normalize_url(url); sid=stable_id('source',url)
        old=self.rows.get(sid,{})
        raw_path=self.root/old.get('raw_cache_path',f'cache/{sid}.bin')
        if resume and old.get('fetch_status')=='success' and raw_path.exists():
            data=raw_path.read_bytes(); content_type=old.get('file_type','application/pdf' if data.startswith(b'%PDF') else 'text/html')
            final_url=old.get('canonical_url',url)
        else:
            row={**old,'source_id':sid,'source_url':url,'parent_source_id':parent,'review_status':old.get('review_status','pending'),'retrieved_at':datetime.now(timezone.utc).isoformat()}
            try:
                current=url
                for _ in range(6):
                    if not allowed(current,self.config['allowed_domains']): raise RuntimeError('Document outside configured allowlist')
                    if not self.permitted(current): raise RuntimeError('Disallowed by robots.txt')
                    response=self.request(current)
                    if response.is_redirect:
                        current=normalize_url(urljoin(current,response.headers['location'])); continue
                    response.raise_for_status(); break
                else: raise RuntimeError('Too many redirects')
                data=response.content; content_type=response.headers.get('content-type','')
                if data.startswith(b'%PDF'): content_type='application/pdf'
                if not any(t in content_type for t in ('html','pdf')): raise RuntimeError('Unsupported source content type '+content_type)
                final_url=current
                download_hash=hashlib.sha256(data).hexdigest()
                raw_path=self.root/'cache'/f"{sid}_{download_hash[:16]}{'.pdf' if 'pdf' in content_type else '.html'}"
                atomic_bytes(raw_path,data)
                if old.get('download_content_hash') and old['download_content_hash']!=download_hash:
                    row['previous_downloads']=[*old.get('previous_downloads',[]),{'raw_cache_path':old.get('raw_cache_path'),'download_content_hash':old['download_content_hash'],'retrieved_at':old.get('retrieved_at')}]
                row.update(fetch_status='success',error=None,raw_cache_path=str(raw_path.relative_to(self.root)),canonical_url=current,file_type=content_type,download_content_hash=hashlib.sha256(data).hexdigest())
            except Exception as exc:
                row.update(fetch_status='failed',error=str(exc)); self.rows[sid]=row; self.save()
                LOG.warning('HRR fetch failed %s: %s',url,exc); return None
            self.rows[sid]=row
            self.save()  # Download checkpoint survives a later parser interruption.
        try:
            doc=structured_document(data,content_type,final_url)
            digest=hashlib.sha256(' '.join(p['text'] for p in doc['pages']).encode()).hexdigest()
            if not any(p['text'] for p in doc['pages']): raise ValueError('No extractable document text (OCR is not enabled)')
            duplicate=next((k for k,r in self.rows.items() if k!=sid and r.get('content_hash')==digest and not r.get('duplicate_of')),None)
            doc.update(source_id=sid,source_url=url,final_url=final_url,content_hash=digest)
            parsed_path=self.root/'cache'/f'{sid}.json'; atomic_json(parsed_path,doc)
            self.rows[sid].update(title=doc['title'],content_hash=digest,cache_path=str(parsed_path.relative_to(self.root)),duplicate_of=duplicate,parse_status='success')
            self.save(); return data,doc
        except Exception as exc:
            self.rows[sid].update(parse_status='failed',error=str(exc)); self.save(); return None

    def run(self,include_evidence=True,resume=True,risk_id=None,dry_run=False):
        if dry_run:
            print('HRR finite discovery: '+RISK_INDEX+' and '+EVIDENCE_INDEX); return self.inventory
        self.inventory['last_run_started_at']=datetime.now(timezone.utc).isoformat()
        self.inventory['error_history']=[*self.inventory.get('error_history',[]),*self.inventory.get('errors',[])]
        self.inventory['errors']=[]
        self.inventory['discovery_complete']=False
        risk_result=self.fetch(RISK_INDEX,resume)
        evidence_result=self.fetch(EVIDENCE_INDEX,resume) if include_evidence else None
        if not risk_result:
            self.inventory['errors'].append({'stage':'risk_index','error':'Risk index unavailable; discovery incomplete'}); self.save(); return self.inventory
        discovered=discover_risks(risk_result[0])
        index_pages={RISK_INDEX}; pending=[risk_result[0]]
        while pending:
            page_html=pending.pop()
            for a in BeautifulSoup(page_html,'html.parser').select('a[href]'):
                try: target=normalize_url(urljoin(RISK_INDEX,a['href']))
                except ValueError: continue
                parsed=urlsplit(target)
                if target in index_pages or parsed.hostname!=urlsplit(RISK_INDEX).hostname or risk_identifier(target): continue
                if parsed.path.lower() not in ('/risks/','/risks/default.aspx') or not parsed.query: continue
                if not any(key.lower() in ('page','pageindex','p') for key in parse_qs(parsed.query)): continue
                index_pages.add(target)
                result=self.fetch(target,resume,parent=stable_id('source',RISK_INDEX))
                if result:
                    discovered.update(discover_risks(result[0],target)); pending.append(result[0])
        for rid,risk in discovered.items(): self.inventory['risks'][rid]={**self.inventory['risks'].get(rid,{}),**risk}
        for rid,risk in self.inventory['risks'].items(): risk['in_current_index']=rid in discovered
        index_text=BeautifulSoup(risk_result[0],'html.parser').get_text(' ',strip=True)
        reported=re.search(r'Risks\s+\d+\s*-\s*\d+\s*\(\s*of\s+(\d+)',index_text,re.I)
        self.inventory['index_reported_count']=int(reported.group(1)) if reported else None
        self.inventory['index_discovered_count']=len(discovered)
        self.inventory['discovery_complete']=bool(discovered) and (not reported or len(discovered)==int(reported.group(1)))
        self.inventory['risk_index_pages']=sorted(index_pages)
        if not self.inventory['discovery_complete']:
            self.inventory['errors'].append({'stage':'risk_discovery','error':'Discovered risk count does not match the official index total; no complete-coverage claim is made.'})
        for url in self.config.get('hrr_target_urls',[]):
            rid=risk_identifier(url)
            if rid and rid not in discovered:
                self.inventory['risks'].setdefault(rid,{'nasa_risk_id':rid,'risk_url':normalize_url(url),'title':None,'status':'unknown','in_current_index':False,'explicit_target':True})
        evidence=discover_evidence(evidence_result[0]) if evidence_result else []
        evidence.extend({'url':normalize_url(url),'title':'Explicit configured target','risk_id':None,'kind':'explicit_target','discovered_on':'config/sources.yaml'} for url in self.config.get('hrr_target_urls',[]) if not risk_identifier(url))
        if include_evidence and not evidence_result: self.inventory['errors'].append({'stage':'evidence_index','error':'Evidence index unavailable; evidence discovery incomplete'})
        selected=[r for rid,r in self.inventory['risks'].items() if risk_id is None or rid==str(risk_id)]
        for risk in selected:
            result=self.fetch(risk['risk_url'],resume,parent=stable_id('source',RISK_INDEX))
            sid=stable_id('source',risk['risk_url']); risk['source_id']=sid
            self.rows[sid]['nasa_risk_ids']=[risk['nasa_risk_id']]
            self.rows[sid]['hrr_kind']='risk_page'
            if result:
                metadata,structural=risk_structure(result[0],risk['risk_url']); risk.update(metadata)
                if not risk.get('title'): risk['title']=result[1]['title']
                for edge in structural:
                    item={'risk_id':risk['nasa_risk_id'],**edge}
                    if item not in self.inventory['structural_links']: self.inventory['structural_links'].append(item)
                evidence.extend(discover_evidence(result[0],risk['risk_url']))
            self.save()
        for item in evidence:
            url=item['url']; sid=stable_id('source',url)
            document=self.inventory['documents'].setdefault(sid,{'source_id':sid,'url':url,'title':item['title'],'risk_ids':[],'kinds':[],'discovered_on':[]})
            if item['risk_id'] and item['risk_id'] not in document['risk_ids']: document['risk_ids'].append(item['risk_id'])
            if item['kind'] not in document['kinds']: document['kinds'].append(item['kind'])
            if item['discovered_on'] not in document['discovered_on']: document['discovered_on'].append(item['discovered_on'])
            assoc={'risk_id':item['risk_id'],'source_id':sid,'kind':item['kind'],'discovered_on':item['discovered_on']}
            if assoc not in self.inventory['associations']: self.inventory['associations'].append(assoc)
        self.save()
        for sid,document in self.inventory['documents'].items():
            if risk_id is not None and str(risk_id) not in document['risk_ids']: continue
            self.fetch(document['url'],resume,parent=stable_id('source',EVIDENCE_INDEX))
            row=self.rows[sid]; row.update(nasa_risk_ids=document['risk_ids'],hrr_kind='evidence_report')
            document.update(fetch_status=row.get('fetch_status'),parse_status=row.get('parse_status'),content_hash=row.get('content_hash'),error=row.get('error'))
            self.save()
        # Content-identical documents with different URLs are inferred only from
        # hashes; retain every discovered URL/risk association in the inventory.
        for row in self.rows.values():
            if row.get('duplicate_of') in self.rows:
                canonical=self.rows[row['duplicate_of']]
                canonical['nasa_risk_ids']=sorted(set(canonical.get('nasa_risk_ids',[])+row.get('nasa_risk_ids',[])))
        self.inventory['last_run_finished_at']=datetime.now(timezone.utc).isoformat(); self.save()
        return self.inventory
