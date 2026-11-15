from pathlib import Path
from datetime import datetime, timezone
import logging
import time
from knowledge_ingestion.storage import *
from knowledge_ingestion.extraction import create_provider, Extraction
from knowledge_ingestion.extraction.cache import extraction_identity
from knowledge_ingestion.parsers import chunks
from knowledge_ingestion.validation import verify_evidence
from knowledge_ingestion.normalization import EntityResolver

LOG=logging.getLogger(__name__)

def extract(root,provider=None,max_chunks=None,relations_first=False,risk_id=None,source_id=None,hrr_only=False):
    if max_chunks is not None and max_chunks < 1:
        raise ValueError('max_chunks must be positive')
    status={'started_at':datetime.now(timezone.utc).isoformat(),'root':str(root.resolve()),'chunks_attempted':0,'chunks_succeeded':0,'chunks_failed':0,'chunks_skipped':0,'documents_attempted':0,'status':'running'}
    def finish():
        status['finished_at']=datetime.now(timezone.utc).isoformat()
        if status['status']=='running':
            status['status']='failed' if status['chunks_failed'] else 'completed'
        atomic_json(root/'staging/extraction_status.json',status)
        return report(root)
    atomic_json(root/'staging/extraction_status.json',status)
    manifest=read_json(root/'staging/sources/manifest.json',{})
    docs=[r for r in manifest.values() if r.get('fetch_status')=='success' and r.get('cache_path') and not r.get('duplicate_of')]
    if source_id: docs=[r for r in docs if r['source_id']==source_id]
    if hrr_only: docs=[r for r in docs if r.get('hrr_kind') in ('risk_page','evidence_report')]
    if relations_first:
        from knowledge_ingestion.extraction.selection import document_exclusion,document_priority
        status['documents_skipped']=[{'source_id':r['source_id'],'url':r['source_url'],'reason':document_exclusion(r)} for r in docs if document_exclusion(r)]
        docs=sorted([r for r in docs if not document_exclusion(r)],key=document_priority)
    if risk_id is not None:
        from knowledge_ingestion.crawler.hrr import risk_identifier
        def matches_risk(row):
            if str(risk_id) in row.get('nasa_risk_ids',[]): return True
            doc=read_json(root/row['cache_path'],{})
            return any(risk_identifier(link[0])==str(risk_id) for link in doc.get('links',[]) if link[0])
        docs=[r for r in docs if matches_risk(r)]
    if not docs:
        message='No accessible HRR documents to extract. Inspect staging/sources/hrr_manifest.json and source fetch errors; the original generic cache is not silently substituted.' if hrr_only else 'No accessible documents match the requested filters. Check crawl results, risk ID and source ID.'
        status.update(status='failed',error=message); return finish()
    try:
        provider=provider or create_provider()
        if relations_first and not hasattr(provider,'extract_relationships'):
            raise ValueError('Relationship-first extraction requires the local Ollama provider. No cloud provider will be called.')
        status['provider']=type(provider).__name__
        status['model']=getattr(provider,'model',None)
        if hasattr(provider,'health_check'): provider.health_check()
    except Exception as exc:
        status.update(status='failed',error=str(exc)); return finish()
    status['cache_hits']=0
    status['mode']='relations_first' if relations_first else 'generic'
    status['selection']={}
    resolver=EntityResolver(root/'staging/entity_registry.json')
    # Validate legacy extractions before reuse, including previous Gemini work.
    legacy=[]
    for p in (root/'staging/extracted').glob('*.json'):
        try:
            old=read_json(p)
            if old.get('extraction_metadata'): continue
            parsed=Extraction.model_validate(old['raw_extraction'])
            excerpts=[item.evidence_text for group in (parsed.entities,parsed.claims,parsed.monitoring,parsed.interventions) for item in group]
            if all(verify_evidence(q,old['chunk']['text']) for q in excerpts): legacy.append(old)
        except (ValueError,KeyError,TypeError):
            LOG.warning('Legacy extraction %s cannot be reused; original file preserved',p.name)
    for source in docs:
        status['documents_attempted']+=1
        try:
            doc=read_json(root/source['cache_path'])
            if relations_first and not source.get('nasa_risk_ids'):
                from knowledge_ingestion.crawler.hrr import risk_identifier
                from urllib.parse import urljoin,urlsplit
                source={**source,'nasa_risk_ids':sorted({risk_identifier(urljoin(source['source_url'],link[0])) for link in doc.get('links',[]) if link[0] and urlsplit(urljoin(source['source_url'],link[0])).hostname=='humanresearchroadmap.nasa.gov' and risk_identifier(urljoin(source['source_url'],link[0]))})}
            if relations_first:
                from knowledge_ingestion.extraction.selection import selected_chunks
                document_chunks,selection=selected_chunks(doc)
                status['selection'][source['source_id']]=selection
            else: document_chunks=list(chunks(doc))
        except Exception as exc:
            status.update(status='failed',error=f'Cannot read/chunk cached source {source["source_id"]}: {exc}'); return finish()
        for position,chunk in enumerate(document_chunks,1):
            key,metadata=extraction_identity(chunk['text'],provider,mode='relations_first' if relations_first else 'generic')
            path=root/'staging/extracted'/f"{chunk['chunk_id']}_{key}.json"
            if path.exists():
                status['chunks_skipped']+=1; continue
            if not relations_first and any(b['source_id']==source['source_id'] and b['chunk'].get('page_number')==chunk['page_number'] and chunk['text'] in b['chunk']['text'] and b['chunk']['text'] in next((p['text'] for p in doc['pages'] if p['page_number']==chunk['page_number']),'') for b in legacy):
                status['chunks_skipped']+=1; continue
            if max_chunks is not None and status['chunks_attempted']>=max_chunks:
                return finish()
            status['chunks_attempted']+=1
            LOG.info('Processing source=%s chunk=%s (%d/%d in document)',source['source_url'],chunk['chunk_id'],position,len(document_chunks))
            started=time.monotonic()
            try:
                cache_path=root/'cache/extractions'/f'{key}.json'
                cached=read_json(cache_path)
                if cached:
                    result=Extraction.model_validate(cached['raw_extraction'])
                    if relations_first:
                        result.source_type='risk_description' if source.get('hrr_kind')=='risk_page' or '/reference/risk-' in source['source_url'] else 'evidence_report' if 'pdf' in source.get('file_type','') else 'research_summary'
                    validation_rejections=cached.get('validation_rejections',[])
                    model_output=cached.get('original_model_output')
                    relation_stats=cached.get('relation_stats',{})
                    status['cache_hits']+=1
                else:
                    if relations_first:
                        result=Extraction.model_validate(provider.extract_relationships(chunk['text'],source_type='risk_description' if source.get('hrr_kind')=='risk_page' or '/reference/risk-' in source['source_url'] else 'evidence_report' if 'pdf' in source.get('file_type','') else 'research_summary'))
                    else: result=Extraction.model_validate(provider.extract(chunk['text']))
                    validation_rejections=getattr(provider,'last_rejections',[])
                    model_output=getattr(provider,'last_raw_response',None)
                    relation_stats=getattr(provider,'last_relation_stats',{}) if relations_first else {}
                    atomic_json(cache_path,{'extraction_metadata':metadata,'raw_extraction':result.model_dump(),'validation_rejections':validation_rejections,'original_model_output':model_output,'relation_stats':relation_stats})
                if relations_first:
                    page_text=' '.join(p['text'] for p in doc['pages'] if p.get('page_number')==chunk.get('page_number'))
                    document_verified=[]
                    validation_rejections=list(validation_rejections)
                    for claim in result.claims:
                        if verify_evidence(claim.evidence_text,page_text): document_verified.append(claim)
                        else: validation_rejections.append({'reason':'missing_document_evidence','group':'relationships','claim':claim.model_dump(),'detail':'Quote matches selected text but not the original extracted document page.'})
                    used={ref for claim in document_verified for ref in (claim.subject,claim.object)}
                    result=Extraction.model_validate({**result.model_dump(),'claims':[c.model_dump() for c in document_verified],'entities':[e.model_dump() for e in result.entities if e.local_id in used]})
                batch=materialize(result,source,chunk,resolver)
                batch['nasa_risk_ids']=source.get('nasa_risk_ids',[])
                if risk_id is not None and str(risk_id) not in batch['nasa_risk_ids']: batch['nasa_risk_ids']=[*batch['nasa_risk_ids'],str(risk_id)]
                batch['relation_diagnostics']={**batch.get('relation_diagnostics',{}),**relation_stats}
                batch['relation_diagnostics']['relations_staged']=sum(len(rows) for table,rows in batch['tables'].items() if table.startswith('relations/'))
                batch['rejected'].extend(validation_rejections)
                if validation_rejections: batch['original_model_output']=model_output
                batch['extraction_metadata']=metadata
                atomic_json(path,batch)
                status['chunks_succeeded']+=1
                error_path=root/'staging/errors'/f"{chunk['chunk_id']}.json"
                if error_path.exists(): error_path.unlink()
            except Exception as exc:
                status['chunks_failed']+=1
                status['error']=str(exc)
                LOG.error('Extraction failed %s: %s',chunk['chunk_id'],exc)
                atomic_json(root/'staging/errors'/f"{chunk['chunk_id']}.json",{'error':str(exc),'source_id':source['source_id'],'attempted_at':datetime.now(timezone.utc).isoformat()})
                raw_output=getattr(provider,'last_raw_response',None)
                if raw_output:
                    atomic_json(root/'staging/errors'/f"{chunk['chunk_id']}_response.json",{'source_id':source['source_id'],'chunk_id':chunk['chunk_id'],'error':str(exc),'original_model_output':raw_output})
                if getattr(exc,'code',None)==429 or 'RESOURCE_EXHAUSTED' in str(exc) or str(exc).startswith('429'):
                    status['status']='blocked_quota'
                    LOG.error('Stopping extraction: provider quota/rate limit reached. Export cannot create medical records until extraction succeeds.')
                    return finish()
                from knowledge_ingestion.extraction.ollama_provider import OllamaUnavailable
                if isinstance(exc,OllamaUnavailable):
                    status['status']='failed'; return finish()
            finally:
                LOG.info('Chunk %s finished in %.2fs',chunk['chunk_id'],time.monotonic()-started)
            atomic_json(root/'staging/extraction_status.json',status)
    return finish()

def materialize(result,source,chunk,resolver):
    tables={}; rejected=[]; ids={}; kinds={}
    diagnostics={'candidate_relationships':len(result.claims),'evidence_verified':0,'entities_resolved':0,'relations_validated':0,'relations_staged':0}
    def add(table,row): tables.setdefault(table,[]).append(row)
    def evidence(text,group=None):
        if not verify_evidence(text,chunk['text']):
            rejected.append({'reason':'missing_exact_evidence','group':group,'excerpt':text}); return None
        eid=stable_id('evidence',source['source_id'],chunk['chunk_id'],text)
        add('evidence/evidence',dict(evidence_id=eid,source_id=source['source_id'],source_url=source['source_url'],chunk_id=chunk['chunk_id'],page_number=chunk['page_number'],section=chunk['section'],text_location=chunk['text_location'],evidence_text=text,extraction_method='llm_structured',verification_status='exact_match',review_status='pending'))
        return eid
    for e in result.entities:
        eid=evidence(e.evidence_text)
        if not eid: continue
        identifier=resolver.resolve(e.entity_type,e.canonical_name); ids[e.local_id]=identifier; kinds[e.local_id]=e.entity_type
        key=ENTITY_FIELDS[e.entity_type].split()[0]
        add('entities/'+e.entity_type,{key:identifier,'canonical_name':e.canonical_name,'description':e.description,**e.attributes.model_dump(),'review_status':'pending'})
        # Entity descriptions/attributes are medical assertions too: preserve their evidence.
        cid=stable_id('claim',identifier,'described_by',source['source_id'],eid,e.model_dump_json())
        add('evidence/knowledge_claims',dict(claim_id=cid,subject_entity_id=identifier,predicate='described_by',object_entity_id=None,claim_text=e.model_dump_json(),source_id=source['source_id'],evidence_id=eid,evidence_status=e.attributes.evidence_status,study_population='unknown',study_environment=None,limitations=result.source_limitations,review_status='pending'))
        for alias in e.aliases:
            add('aliases/aliases',dict(alias_id=stable_id('alias',alias,identifier),alias=alias,entity_id=identifier,entity_type=e.entity_type,source_id=source['source_id'],review_status='pending'))
    for c in result.claims:
        if c.subject not in ids or c.object not in ids:
            rejected.append({'reason':'unresolved_entity','group':'relationships','claim':c.model_dump()}); continue
        eid=evidence(c.evidence_text,'relationships')
        if not eid: continue
        diagnostics['evidence_verified']+=1; diagnostics['entities_resolved']+=1
        cid=stable_id('claim',ids[c.subject],c.predicate,ids[c.object],c.claim_text,source['source_id'],eid)
        add('evidence/knowledge_claims',dict(claim_id=cid,subject_entity_id=ids[c.subject],object_entity_id=ids[c.object],predicate=c.predicate,claim_text=c.claim_text,source_id=source['source_id'],evidence_id=eid,evidence_status=c.evidence_status,study_population=c.study_population,study_environment=c.study_environment,limitations=c.limitations or result.source_limitations,review_status='pending'))
        matched=False
        for table,pair in RELATIONS.items():
            if pair==(kinds[c.subject],kinds[c.object]):
                add('relations/'+table,dict(relation_id=stable_id('relation',cid),source_entity_id=ids[c.subject],target_entity_id=ids[c.object],relationship_type=c.predicate,claim_id=cid,review_status='pending'))
                matched=True; diagnostics['relations_validated']+=1; diagnostics['relations_staged']+=1
        if not matched: rejected.append({'reason':'unsupported_entity_pair','group':'relationships','claim':c.model_dump(),'detail':'Claim retained, but no existing relation CSV matches its endpoint types.'})
    for m in result.monitoring:
        refs=[m.biomarker,m.condition,m.environment]
        if any(r is not None and r not in ids for r in refs): continue
        eid=evidence(m.evidence_text)
        if eid: add('monitoring/monitoring_guidance',dict(guidance_id=stable_id('guidance',eid,m.model_dump_json()),biomarker_id=ids[m.biomarker],related_condition_id=ids.get(m.condition),applicable_environment_id=ids.get(m.environment),source_id=source['source_id'],evidence_id=eid,review_status='pending',**m.model_dump(exclude={'biomarker','condition','environment','evidence_text'})))
    for p in result.interventions:
        if p.condition not in ids or p.treatment not in ids: continue
        eid=evidence(p.evidence_text)
        if eid: add('protocols/candidate_protocols',dict(protocol_id=stable_id('protocol',eid,p.model_dump_json()),related_condition_id=ids[p.condition],treatment_id=ids[p.treatment],source_id=source['source_id'],evidence_id=eid,review_status='pending',**p.model_dump(exclude={'condition','treatment','evidence_text'})))
    return {'source_id':source['source_id'],'chunk':chunk,'source_type':result.source_type,'source_limitations':result.source_limitations,'raw_extraction':result.model_dump(),'tables':tables,'rejected':rejected,'relation_diagnostics':diagnostics}

def batches(root):
    for p in sorted((root/'staging/extracted').glob('*.json')):
        yield p,read_json(root/'staging/reviewed'/p.name,read_json(p))

def export(root,draft=True):
    if draft and any((root/'staging/focused/transactions').glob('*.json')):
        from knowledge_ingestion.focused.append import preserve_draft_export
        return preserve_draft_export(root)
    tables={k:{} for k in SCHEMAS}
    from knowledge_ingestion.enrichment.merge import merge_entity
    baseline_conflicts=[]
    export_audit={'relations_seen':0,'relations_rejected_review':0,'relations_duplicate':0,'relations_missing_dependencies':0}
    manifest=read_json(root/'staging/sources/manifest.json',{})
    for row in manifest.values(): tables['metadata/sources'][row['source_id']]=row
    for _,batch in batches(root):
        if batch['source_id'] in tables['metadata/sources']:
            tables['metadata/sources'][batch['source_id']]['source_type']=batch['source_type']
        for name,rows in batch['tables'].items():
            for row in rows:
                is_relation=name.startswith('relations/')
                if is_relation: export_audit['relations_seen']+=1
                if row.get('review_status')=='rejected' or (not draft and row.get('review_status')!='approved'):
                    if is_relation: export_audit['relations_rejected_review']+=1
                    continue
                if is_relation and row[SCHEMAS[name].split()[0]] in tables[name]: export_audit['relations_duplicate']+=1
                identifier=row[SCHEMAS[name].split()[0]]
                if name.startswith('entities/') and identifier in tables[name]:
                    merge_entity(name,tables[name][identifier],row,baseline_conflicts)
                else: tables[name].setdefault(identifier,dict(row))
    from knowledge_ingestion.enrichment import overlay_enrichment
    enrichment_audit=overlay_enrichment(root,tables,draft)
    enrichment_audit['baseline_conflicts']=baseline_conflicts
    # Referential closure prevents approved exports from leaking unreviewed dependencies.
    entities={r[SCHEMAS[t].split()[0]] for t,rs in tables.items() if t.startswith('entities/') for r in rs.values()}
    evidence=tables['evidence/evidence']
    claims=tables['evidence/knowledge_claims']
    tables['evidence/knowledge_claims']={k:r for k,r in claims.items() if r['subject_entity_id'] in entities and (not r.get('object_entity_id') or r['object_entity_id'] in entities) and r['evidence_id'] in evidence}
    if not draft:
        cited={e['source_id'] for e in evidence.values()}
        tables['metadata/sources']={k:{**r,'review_status':'approved'} for k,r in tables['metadata/sources'].items() if k in cited}
    for t,rs in list(tables.items()):
        if t.startswith('relations/'):
            kept={k:r for k,r in rs.items() if r['claim_id'] in tables['evidence/knowledge_claims'] and r['source_entity_id'] in entities and r['target_entity_id'] in entities}
            export_audit['relations_missing_dependencies']+=len(rs)-len(kept)
            tables[t]=kept
        if t.startswith(('monitoring/','protocols/')):
            tables[t]={k:r for k,r in rs.items() if r.get('evidence_id') in evidence and all(not r.get(f) or r[f] in entities for f in ('biomarker_id','related_condition_id','treatment_id','applicable_environment_id'))}
    # This registry is populated only through an explicit medical authorization command.
    authorized=read_json(root/'staging/clinical_authorizations.json',{})
    tables['protocols/approved_protocols']={k:r for k,r in authorized.items() if not draft and r.get('authorized_by') and r.get('authorized_at') and r.get('evidence_id') in evidence and r.get('related_condition_id') in entities and r.get('treatment_id') in entities and k in tables['protocols/candidate_protocols']}
    from typing import get_args
    from knowledge_ingestion.extraction import SourceType
    for kind in get_args(SourceType): tables['metadata/source_types'][kind]={'source_type':kind,'description':kind.replace('_',' ')}
    for kind in ('medication','supplement','exercise','nutritional','behavioral','monitoring','environmental','medical procedure','operational countermeasure'):
        tables['metadata/treatment_types'][kind]={'treatment_type':kind,'description':kind}
    destination=root/'DB'/('draft' if draft else 'approved')
    for table,fields in SCHEMAS.items():
        try: write_csv(destination/(table+'.csv'),fields.split(),tables[table].values())
        except Exception as exc:
            atomic_json(root/'staging/export_errors'/f"{table.replace('/','_')}.json",{'reason':'export_failure','table':table,'error':str(exc),'attempted_at':datetime.now(timezone.utc).isoformat()})
            raise
    export_audit['relations_exported']=sum(len(rows) for t,rows in tables.items() if t.startswith('relations/'))
    atomic_json(destination/'export_manifest.json',{'draft':draft,'generated_at':datetime.now(timezone.utc).isoformat(),'clinical_authorization':False,'counts':{t:len(r) for t,r in tables.items()},'relation_export_audit':export_audit,'enrichment_audit':enrichment_audit})
    return destination

def report(root):
    sources=read_json(root/'staging/sources/manifest.json',{})
    bs=[b for _,b in batches(root)]
    counts={}
    for b in bs:
        for t,rows in b['tables'].items(): counts.setdefault(t,set()).update(r[SCHEMAS[t].split()[0]] for r in rows)
    result={'urls_crawled':len(sources),'urls_successfully_processed':sum(r.get('fetch_status')=='success' for r in sources.values()),'documents_extracted':len({b['source_id'] for b in bs}),'chunks_extracted':len(bs),'entities_extracted':sum(len(v) for k,v in counts.items() if k.startswith('entities/')),'relations_extracted':sum(len(v) for k,v in counts.items() if k.startswith('relations/')),'claims_awaiting_review':len({r['claim_id'] for b in bs for r in b['tables'].get('evidence/knowledge_claims',[]) if r['review_status']=='pending'}),'records_rejected_for_missing_evidence':sum(len(b['rejected']) for b in bs),'fetch_errors':[r for r in sources.values() if r.get('fetch_status')!='success'],'extraction_status':read_json(root/'staging/extraction_status.json',{}),'extraction_errors':[read_json(p) for p in (root/'staging/errors').glob('*.json')],'limitations':['Exact quote matching verifies provenance, not medical truth or semantic entailment. Human review is required.','Extraction approval never grants clinical authorization.','No mission inventory is inferred from literature.']}
    result['records_rejected_total']=sum(len(b['rejected']) for b in bs)
    result['records_rejected_for_missing_evidence']=sum(r.get('reason')=='missing_exact_evidence' for b in bs for r in b['rejected'])
    result['records_rejected_for_validation']=sum(r.get('reason') in ('invalid_structured_record','invalid_entity_reference','duplicate_entity_local_id') for b in bs for r in b['rejected'])
    from knowledge_ingestion.diagnostics import relationship_report
    result['relationship_diagnostics']=relationship_report(root,bs,sources)
    if (root/'staging/enrichment/status.json').exists():
        from knowledge_ingestion.enrichment import enrichment_report
        result['entity_enrichment']=enrichment_report(root)
        result['enrichment_claims_awaiting_review']=result['entity_enrichment']['pending']
        result['claims_awaiting_review']+=result['enrichment_claims_awaiting_review']
    atomic_json(root/'report.json',result); return result
