import re
import os
from knowledge_ingestion.storage import stable_id

def normalize_text(text):
    return re.sub(r'\s+', ' ', text).strip()

def parse_document(data, content_type, url):
    if 'pdf' in content_type or url.lower().endswith('.pdf'):
        import fitz
        with fitz.open(stream=data, filetype='pdf') as doc:
            return {'title':url.rsplit('/',1)[-1], 'pages':[{'page_number':i+1,'text':normalize_text(p.get_text())} for i,p in enumerate(doc)], 'links':[]}
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(data, 'html.parser')
    title = soup.title.get_text(' ', strip=True) if soup.title else url
    article = soup.find('article') or soup.find('main') or soup.find(attrs={'role':'main'})
    if article is None:
        article = soup.body or soup
    for node in article.select('script,style,nav,footer,header,aside,form,[role=navigation]'):
        node.decompose()
    links = [(a.get('href'), a.get_text(' ',strip=True)) for a in article.select('a[href]')]
    return {'title':title,'pages':[{'page_number':None,'text':normalize_text(article.get_text(' ',strip=True))}], 'links':links}

def chunks(document, size=None, overlap=None):
    size=int(os.getenv('EXTRACTION_CHUNK_SIZE','2400')) if size is None else size
    overlap=int(os.getenv('EXTRACTION_CHUNK_OVERLAP','200')) if overlap is None else overlap
    if size <= overlap or overlap < 0: raise ValueError('Invalid chunk bounds')
    for page in document['pages']:
        text = page['text']
        start=0
        while start<len(text):
            end=min(start+size,len(text))
            if end<len(text):
                boundaries=list(re.finditer(r'\n\s*\n|(?<=[.!?])\s+',text[start:end]))
                useful=[b.end()+start for b in boundaries if b.end()>max(overlap,size//2)]
                if useful: end=useful[-1]
            part=text[start:end]
            yield {'source_id':document['source_id'],'source_url':document.get('source_url'),
                'chunk_id':stable_id('chunk',document['source_id'],page['page_number'],start,part),
                'page_number':page['page_number'],'section':page.get('section'),
                'text_location':f'characters {start}:{end}','text':part,'original_text':part}
            if end==len(text): break
            next_start=max(start+1,end-overlap)
            # Align overlap to the start of a sentence where possible.
            boundaries=list(re.finditer(r'(?<=[.!?])\s+',text[next_start:end]))
            if boundaries: next_start+=boundaries[0].end()
            start=next_start
