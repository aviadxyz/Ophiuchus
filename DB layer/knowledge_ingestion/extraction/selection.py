"""Select evidence-bearing sections and retain page/section provenance."""
import os
import re
from urllib.parse import urlsplit
from knowledge_ingestion.parsers import chunks

def document_exclusion(source):
    path=urlsplit(source['source_url']).path.rstrip('/').lower()
    if path=='/humans-in-space/astronauts':
        return 'General astronaut directory, not a medical risk or evidence document'
    return None

def document_priority(source):
    if source.get('hrr_kind')=='risk_page': return 0
    if source.get('hrr_kind')=='evidence_report': return 1
    if '/reference/risk-' in source['source_url']: return 2
    return 3

def selected_chunks(doc,limit=None):
    sections=doc.get('sections') or [{'section':'Article','text':p['text'],'page_number':p['page_number'],'extractable':True,'priority':2} for p in doc['pages']]
    selected=[]; seen=set()
    for section in sorted(sections,key=lambda s:(s.get('priority',2),s.get('page_number') or 0)):
        if not section.get('extractable',True): continue
        text=section['text']
        if len(text)<50: continue
        # Do not send table-of-contents lists or bibliography-only material.
        if text.count('...')>4 or re.match(r'^references\s*$',text.strip(),re.I): continue
        part={**doc,'pages':[{'text':text,'page_number':section.get('page_number'),'section':section.get('section')}]}
        for chunk in chunks(part,size=int(os.getenv('RELATION_CHUNK_SIZE','1600')),overlap=160):
            key=(chunk['page_number'],chunk['section'],chunk['text'])
            if key in seen: continue
            seen.add(key)
            # Offsets are explicitly within this named section, not full-page offsets.
            chunk['text_location']='section '+str(chunk['section'])+'; '+chunk['text_location']
            selected.append(chunk)
    if limit is None: limit=int(os.getenv('HRR_MAX_CHUNKS_PER_DOCUMENT','3'))
    return (selected if limit==0 else selected[:limit]),{'eligible_chunks':len(selected),'selected_chunks':len(selected) if limit==0 else min(limit,len(selected)),'selection_limit':limit,'bibliography_sections_excluded':sum(not s.get('extractable',True) for s in sections)}
