"""Auditable relation-stage and HRR coverage reporting; does not approve medical use."""
from collections import Counter
from knowledge_ingestion.storage import read_json

def relationship_report(root,batches,sources):
    stages=Counter(); rejected=Counter(); per_source={}; per_risk={}
    for batch in batches:
        sid=batch['source_id']; diagnostics=batch.get('relation_diagnostics')
        rows=[r for t,rs in batch['tables'].items() if t.startswith('relations/') for r in rs]
        diagnostics=diagnostics or {'candidate_relationships':len(batch.get('raw_extraction',{}).get('claims',[])),'relations_staged':len(rows)}
        stages.update(diagnostics)
        target=per_source.setdefault(sid,{'url':sources.get(sid,{}).get('source_url'),'candidate_relationships':0,'relations_staged':0,'rejected':0})
        target['candidate_relationships']+=diagnostics.get('candidate_relationships',0)
        target['relations_staged']+=len(rows)
        relation_rejections=[r for r in batch.get('rejected',[]) if r.get('group')=='relationships']
        target['rejected']+=len(relation_rejections)
        rejected.update(r.get('reason','unknown') for r in relation_rejections)
        risk_ids=batch.get('nasa_risk_ids') or sources.get(sid,{}).get('nasa_risk_ids',[])
        if not risk_ids and sources.get(sid,{}).get('cache_path'):
            from urllib.parse import urljoin,urlsplit
            from knowledge_ingestion.crawler.hrr import risk_identifier
            source=sources[sid]; doc=read_json(root/source['cache_path'],{})
            risk_ids=sorted({risk_identifier(urljoin(source['source_url'],link[0])) for link in doc.get('links',[]) if link[0] and urlsplit(urljoin(source['source_url'],link[0])).hostname=='humanresearchroadmap.nasa.gov' and risk_identifier(urljoin(source['source_url'],link[0]))})
        for rid in risk_ids:
            risk=per_risk.setdefault(rid,{'candidate_relationships':0,'relations_staged':0,'rejected':0})
            risk['candidate_relationships']+=diagnostics.get('candidate_relationships',0)
            risk['relations_staged']+=len(rows); risk['rejected']+=len(relation_rejections)
    exports={}
    for kind in ('draft','approved'):
        manifest=read_json(root/f'DB/{kind}/export_manifest.json',{})
        exports[kind]={'relations_per_csv':{t:n for t,n in manifest.get('counts',{}).items() if t.startswith('relations/')},'audit':manifest.get('relation_export_audit',{})}
    hrr=read_json(root/'staging/sources/hrr_manifest.json',{})
    documents=hrr.get('documents',{})
    for sid,document in documents.items():
        per_source.setdefault(sid,{'url':document['url'],'candidate_relationships':0,'relations_staged':0,'rejected':0})
    for rid in hrr.get('risks',{}):
        per_risk.setdefault(rid,{'candidate_relationships':0,'relations_staged':0,'rejected':0})
    stages['documents_parsed']=sum(bool(r.get('cache_path')) and r.get('fetch_status')=='success' for r in sources.values())
    stages['relations_staged_unique']=len({r['relation_id'] for b in batches for t,rs in b['tables'].items() if t.startswith('relations/') for r in rs})
    stages['relations_exported']=sum(exports.get('draft',{}).get('relations_per_csv',{}).values())
    coverage={
        'risks_discovered':hrr.get('index_discovered_count',0),
        'risk_index_reported_count':hrr.get('index_reported_count'),
        'discovery_complete':hrr.get('discovery_complete',False),
        'inactive_risks':sum(r.get('status')=='inactive' for r in hrr.get('risks',{}).values()),
        'explicit_targets_not_in_index':[r for r in hrr.get('risks',{}).values() if r.get('explicit_target') and not r.get('in_current_index')],
        'documents_discovered':len(documents),
        'primary_report_documents':sum('evidence_report' in d.get('kinds',[]) for d in documents.values()),
        'supplemental_documents':sum('supplemental' in d.get('kinds',[]) for d in documents.values()),
        'appendices':sum('appendix' in d.get('kinds',[]) for d in documents.values()),
        'cross_cutting_documents':sum('cross_cutting' in d.get('kinds',[]) for d in documents.values()),
        'documents_downloaded':sum(d.get('fetch_status')=='success' for d in documents.values()),
        'documents_parsed':sum(d.get('parse_status')=='success' for d in documents.values()),
        'risk_document_associations':len(hrr.get('associations',[])),
        'structural_research_links':len(hrr.get('structural_links',[])),
        'errors':hrr.get('errors',[]),
    }
    return {'stages':dict(stages),'rejection_reasons':dict(rejected),'per_source':per_source,'per_evidence_report':{sid:per_source[sid] for sid in documents},'per_nasa_risk':per_risk,'exports':exports,'hrr_coverage':coverage,'export_errors':[read_json(p) for p in (root/'staging/export_errors').glob('*.json')]}
