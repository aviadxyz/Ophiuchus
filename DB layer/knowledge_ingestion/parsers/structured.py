"""Source-aware sections without altering original cached page text or CSV schemas."""
import re
from bs4 import BeautifulSoup
from knowledge_ingestion.parsers import normalize_text, parse_document

HIGH_VALUE=re.compile(r'executive summary|risk statement|state of knowledge|spaceflight evidence|human evidence|monitor|measurement|countermeasure|mitigation|results|discussion|conclusion|evidence|risk context',re.I)
BIBLIOGRAPHY=re.compile(r'^(?:(?:[IVXLC\d]+|[A-Z])[.\s]+)?(?:references(?: and notes)?|bibliography|literature cited)\s*[:.]?\s*$',re.I)
RISK_LABELS=('Risk Ratings and Dispositions per Design Reference Mission (DRM) Category','Risk Statement','Risk Context','HSRB State of Knowledge','Mitigation Strategy')

def html_sections(data,url):
    soup=BeautifulSoup(data,'html.parser')
    root=soup.find('article') or soup.find('main') or soup.body or soup
    for node in root.select('script,style,nav,footer,header,aside,[role=navigation]'):
        node.decompose()
    # HRR's navigation tree repeats hundreds of gap/task titles before the risk.
    for node in list(root.select('[id]')):
        if node.attrs and node.get('id') and re.search(r'treeview|radtree|navigation|sitefooter|sitemenu',node.get('id'),re.I):
            node.decompose()
    sections=[]
    if '/risks/' in url.lower() and 'i=' in url:
        text=root.get_text('\n',strip=True)
        # Match complete heading lines, not words inside paragraphs or task titles.
        pattern=re.compile(r'(?m)^\s*('+'|'.join(re.escape(s) for s in RISK_LABELS)+r')\s*$')
        hits=list(pattern.finditer(text))
        for i,hit in enumerate(hits):
            end=hits[i+1].start() if i+1<len(hits) else len(text)
            body=text[hit.end():end]
            body=re.split(r'(?m)^\s*Gaps\s*\(\d+\)',body)[0]
            body=normalize_text(body)
            if body: sections.append({'section':hit.group(1),'text':body,'page_number':None,'priority':0 if hit.group(1) in ('Risk Statement','HSRB State of Knowledge') else 1,'extractable':'Ratings' not in hit.group(1)})
    if not sections:
        heading='Article'; parts=[]
        def flush():
            if parts:
                sections.append({'section':heading,'text':normalize_text(' '.join(parts)),'page_number':None,'priority':0 if HIGH_VALUE.search(heading) else 2,'extractable':not bool(BIBLIOGRAPHY.match(heading))})
                parts.clear()
        for node in root.find_all(['h1','h2','h3','h4','p','li']):
            if node.name.startswith('h'):
                flush(); heading=node.get_text(' ',strip=True)
            elif not node.find_parent(['p','li']): parts.append(node.get_text(' ',strip=True))
        flush()
    return sections

def pdf_sections(data):
    import fitz
    sections=[]; heading='Document'; bibliography=False
    with fitz.open(stream=data,filetype='pdf') as doc:
        for page_index,page in enumerate(doc):
            blocks=page.get_text('dict')['blocks']
            spans=[s for b in blocks if 'lines' in b for line in b['lines'] for s in line['spans'] if s['text'].strip()]
            sizes=sorted(s['size'] for s in spans)
            body_size=sizes[len(sizes)//2] if sizes else 10
            parts=[]
            def flush():
                if parts:
                    text=normalize_text(' '.join(parts)); parts.clear()
                    sections.append({'section':heading,'text':text,'page_number':page_index+1,'priority':0 if HIGH_VALUE.search(heading) else 2,'extractable':not bibliography})
            for block in blocks:
                for line in block.get('lines',[]):
                    line_spans=line['spans']; text=' '.join(s['text'] for s in line_spans).strip()
                    if not text: continue
                    cleaned=re.sub(r'\s+',' ',text)
                    is_heading=len(cleaned)<140 and not re.search(r'\.{3}|\s\d+\s*$',cleaned) and (
                        bool(BIBLIOGRAPHY.match(cleaned)) or
                        (max(s['size'] for s in line_spans)>body_size+1.2) or
                        (HIGH_VALUE.search(cleaned) and len(cleaned.split())<12 and not cleaned.endswith('.')))
                    if is_heading:
                        flush(); heading=cleaned
                        if BIBLIOGRAPHY.match(cleaned): bibliography=True
                        elif re.match(r'^(?:appendix|appendices)\b',cleaned,re.I): bibliography=False
                    else: parts.append(text)
            flush()
    return sections

def structured_document(data,content_type,url):
    doc=parse_document(data,content_type,url)
    doc['sections']=pdf_sections(data) if 'pdf' in content_type or url.lower().endswith('.pdf') else html_sections(data,url)
    doc['parser_version']='hrr-sections-1'
    return doc
