from collections import deque
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit, urlunsplit, parse_qsl, urlencode, quote
from urllib.robotparser import RobotFileParser
import hashlib
import logging
import time
import httpx
from knowledge_ingestion.storage import atomic_json, read_json, stable_id
from knowledge_ingestion.parsers import parse_document

LOG = logging.getLogger(__name__)
KEYWORDS = ('health','risk','radiation','sleep','circadian','cardio','bone','muscle','immune','nutrition','cognit','mental','behavior','countermeasure','medical','astronaut','human research','microgravity')

def normalize_url(url):
    p = urlsplit(url)
    if p.scheme.lower() not in ('http','https') or not p.hostname or p.username: raise ValueError('Unsupported URL')
    host = p.hostname.lower()
    port = p.port
    netloc = host + (f':{port}' if port and port not in (80,443) else '')
    query = urlencode(sorted((k,v) for k,v in parse_qsl(p.query) if not k.lower().startswith('utm_')))
    return urlunsplit((p.scheme.lower(),netloc,quote(p.path or '/',safe="/%:@!$&'()*+,;=-._~"),query,''))

def allowed(url, domains):
    host = urlsplit(url).hostname or ''
    return any(host == d or host.endswith('.'+d) for d in domains)

class Crawler:
    def __init__(self, config, root, client=None):
        self.config=config; self.root=root
        self.client=client or httpx.Client(timeout=30, follow_redirects=False, headers={'User-Agent':'SpaceHealthKnowledgeBot/0.1 (bounded research crawler)'})
        self.robots={}; self.robot_errors={}; self.last={}

    def request(self,url):
        host=urlsplit(url).netloc
        time.sleep(max(0,self.config['request_delay_seconds']-(time.monotonic()-self.last.get(host,0))))
        for attempt in range(3):
            self.last[host]=time.monotonic()
            try:
                r=self.client.get(url)
            except httpx.TransportError:
                if attempt==2: raise
                time.sleep(2**attempt); continue
            if r.status_code not in (429,500,502,503,504): return r
            if attempt<2: time.sleep(min(30,max(float(r.headers.get('Retry-After','2')) if r.headers.get('Retry-After','2').isdigit() else 2,2**attempt)))
        return r

    def permitted(self,url):
        p=urlsplit(url); origin=f'{p.scheme}://{p.netloc}'
        if origin in self.robot_errors: raise RuntimeError(self.robot_errors[origin])
        if origin not in self.robots:
            r=self.request(origin+'/robots.txt')
            for _ in range(5):
                if not r.is_redirect: break
                target=normalize_url(urljoin(str(r.url),r.headers['location']))
                if urlsplit(target).netloc!=p.netloc: raise RuntimeError('Cross-host robots redirect requires policy review')
                r=self.request(target)
            else: raise RuntimeError('Too many robots redirects')
            robot=RobotFileParser()
            if r.status_code==404: robot.parse([])
            elif r.status_code==200: robot.parse(r.text.splitlines())
            else:
                error=f'Cannot verify robots.txt: HTTP {r.status_code}'
                self.robot_errors[origin]=error
                raise RuntimeError(error)
            self.robots[origin]=robot
        robot=self.robots[origin]
        delay=robot.crawl_delay('SpaceHealthKnowledgeBot') or robot.crawl_delay('*')
        if delay: self.config['request_delay_seconds']=max(self.config['request_delay_seconds'],delay)
        return robot.can_fetch('SpaceHealthKnowledgeBot',url)

    def run(self,dry_run=False):
        queue=deque((normalize_url(u),0,None) for u in self.config['sources']); seen=set(); hashes={}
        rows=read_json(self.root/'staging/sources/manifest.json',{})
        attempted=0
        while queue and attempted<self.config['max_pages']:
            url,depth,parent=queue.popleft()
            if url in seen or not allowed(url,self.config['allowed_domains']): continue
            seen.add(url); attempted+=1
            if dry_run:
                print(f'{depth}: {url}'); continue
            sid=stable_id('source',url)
            row={'source_id':sid,'source_url':url,'parent_source_id':parent,'review_status':'pending','retrieved_at':datetime.now(timezone.utc).isoformat()}
            try:
                current=url
                for _ in range(6):
                    if not allowed(current,self.config['allowed_domains']): raise RuntimeError('Redirect outside allowlist')
                    if not self.permitted(current): raise RuntimeError('Disallowed by robots.txt')
                    response=self.request(current)
                    if response.is_redirect:
                        current=normalize_url(urljoin(current,response.headers['location'])); continue
                    response.raise_for_status(); break
                else: raise RuntimeError('Too many redirects')
                content_type=response.headers.get('content-type','')
                if not any(t in content_type for t in ('html','pdf')): raise RuntimeError('Unsupported content type: '+content_type)
                raw=self.root/'cache'/f'{sid}.bin'; raw.parent.mkdir(parents=True,exist_ok=True); raw.write_bytes(response.content)
                doc=parse_document(response.content,content_type,current)
                text=' '.join(p['text'] for p in doc['pages'])
                if not text: raise RuntimeError('Empty extracted content')
                digest=hashlib.sha256(text.encode()).hexdigest()
                doc.update(source_id=sid,source_url=url,final_url=current,content_hash=digest)
                path=self.root/'cache'/f'{sid}.json'; atomic_json(path,doc)
                row.update(title=doc['title'],fetch_status='success',content_hash=digest,cache_path=str(path.relative_to(self.root)),duplicate_of=hashes.get(digest))
                if digest not in hashes:
                    hashes[digest]=sid
                    if depth<self.config['max_depth']:
                        candidates=[]
                        for href,label in doc['links']:
                            try: child=normalize_url(urljoin(current,href))
                            except (ValueError,TypeError): continue
                            score=sum(k in (label+' '+child).lower() for k in KEYWORDS)
                            if score and allowed(child,self.config['allowed_domains']): candidates.append((score,child))
                        queue.extend((u,depth+1,sid) for _,u in sorted(set(candidates),reverse=True))
            except Exception as exc:
                row.update(fetch_status='failed',error=str(exc)); LOG.warning('%s: %s',url,exc)
            rows[sid]=row; atomic_json(self.root/'staging/sources/manifest.json',rows)
        return rows
