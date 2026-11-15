from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import re
from copy import deepcopy
from urllib.parse import urlsplit
from knowledge_ingestion.parsers import chunks
from knowledge_ingestion.storage import read_json, stable_id
from .models import MonitoringExtraction, MicrobiomeExtraction, MONITORING_PROMPT, MICROBIOME_PROMPT, PROMPT_VERSION, SCHEMA_VERSION
from .validation import parse_output
from .append import AdditiveCatalog, append_tables, recover
from .safety import contained, write_json, writer_lock

TOPICS = {
    'monitoring':re.compile(r'heart.rate|variability|blood pressure|sleep.(?:duration|efficiency|quality|loss)|temperature|respiratory|oxygen.saturation|physical.activity|muscle.(?:strength|force)|bone.(?:mineral.)?density|immune.biomarker|stress.hormone|radiation.(?:dose|exposure)|cognitive|performance.measure', re.I),
    'microbiome':re.compile(r'microbiom|microbiota|microbial|microbes|bacteria|viruses|microorganism', re.I),
}


class LocalFocusedProvider:
    def __init__(self):
        from knowledge_ingestion.extraction.ollama_provider import OllamaExtractor
        self.provider = OllamaExtractor()
        self.model = self.provider.model
    def cache_settings(self):
        return {**self.provider.cache_settings(),'focused_num_predict':min(self.provider.settings.num_predict,800),'focused_think':False,'compact_details':True}
    def health_check(self):
        return self.provider.health_check()
    def extract_focused(self, job):
        schema = MonitoringExtraction if job['focus'] == 'monitoring' else MicrobiomeExtraction
        prompt = MONITORING_PROMPT if job['focus'] == 'monitoring' else MICROBIOME_PROMPT
        payload = 'Source: '+job['source_url']+'\nSection: '+str(job['section'])+'\nUntrusted source passage:\n'+job['text']
        output_limit = min(self.provider.settings.num_predict, 800)
        estimated = (len(prompt)+len(payload)+len(json.dumps(schema.model_json_schema()))+2)//3
        if estimated+output_limit+256 > self.provider.settings.num_ctx:
            raise ValueError('Focused schema/source/output exceeds local model context budget')
        output_schema = schema.model_json_schema()
        output_schema['properties']['records']['maxItems'] = 1
        for name,definition in output_schema.get('$defs', {}).items():
            if 'properties' in definition:
                core = ['category','related_name','related_kind','relationship','evidence_text']
                core += ['indicator'] if job['focus']=='monitoring' else ['microbiome_concept','scope']
                properties = definition['properties']
                details = {key:value for key,value in properties.items() if key not in core}
                definition['properties'] = {key:properties[key] for key in core}
                definition['properties']['details'] = {'anyOf':[{'type':'object','properties':details,'additionalProperties':False},{'type':'null'}]}
                definition['required'] = core
                for field in definition['properties'].values():
                    field.pop('default', None)
        raw = self.provider._chat([{'role':'system','content':prompt},{'role':'user','content':payload}],output_schema,num_predict=output_limit,think=False)
        self.last_raw_content = raw
        decoded = json.loads(raw)
        for item in decoded.get('records', []):
            details = item.pop('details', None)
            if details is not None:
                if not isinstance(details, dict) or set(details)&set(item):
                    raise ValueError('Invalid optional focused details')
                item.update(details)
        return json.dumps(decoded,ensure_ascii=False)


def jobs(root, focuses, provider, source_id=None, hrr_only=False):
    root = contained(root)
    manifest = read_json(root/'staging/sources/manifest.json', {})
    result, coverage = [], []
    documents = sorted(manifest.values(), key=lambda s:(0 if s.get('hrr_kind') == 'evidence_report' else 1, s['source_id']))
    seen_content = set()
    for source in documents:
        if source_id and source['source_id'] != source_id:
            continue
        if hrr_only and source.get('hrr_kind') not in ('evidence_report','risk_page'):
            continue
        host = urlsplit(source['source_url']).hostname or ''
        if source.get('fetch_status') != 'success' or not (host == 'nasa.gov' or host.endswith('.nasa.gov')):
            continue
        if '/humans-in-space/astronauts' in source['source_url'] or source.get('duplicate_of'):
            continue
        cache = contained(root/source.get('cache_path', '__missing__'))
        if not cache.is_file():
            coverage.append({'source_id':source['source_id'],'status':'missing_cache'})
            continue
        doc = read_json(cache)
        content_hash = hashlib.sha256(json.dumps(doc.get('pages', []),sort_keys=True).encode()).hexdigest()
        if content_hash in seen_content:
            continue
        seen_content.add(content_hash)
        sections = doc.get('sections') or [{'text':p['text'],'page_number':p['page_number'],'section':'Article' if p['page_number'] is None else 'PDF page','extractable':True} for p in doc.get('pages', [])]
        hits = Counter()
        for section in sections:
            if not section.get('extractable', True) or re.match(r'^references\s*$',section.get('section') or '',re.I):
                continue
            selected_text = re.split(r'Research in support of this risk:|Related Content|Keep Exploring|Explore more:',section['text'],maxsplit=1,flags=re.I)[0]
            document = {'source_id':source['source_id'],'source_url':source['source_url'],'pages':[{'text':selected_text,'page_number':section.get('page_number'),'section':section.get('section')}]}
            for chunk in chunks(document, size=1200, overlap=160):
                for focus in focuses:
                    if not TOPICS[focus].search(chunk['text']):
                        continue
                    metadata = dict(focus=focus, model=provider.model, settings=provider.cache_settings(),
                        prompt_version=PROMPT_VERSION, schema_version=SCHEMA_VERSION,
                        prompt_hash=hashlib.sha256((MONITORING_PROMPT if focus=='monitoring' else MICROBIOME_PROMPT).encode()).hexdigest(),
                        schema_hash=hashlib.sha256(json.dumps((MonitoringExtraction if focus=='monitoring' else MicrobiomeExtraction).model_json_schema(),sort_keys=True).encode()).hexdigest(),
                        content_hash=hashlib.sha256(chunk['text'].encode()).hexdigest())
                    job_id = stable_id('focused', source['source_id'], chunk['chunk_id'], metadata)
                    result.append({**chunk,'focus':focus,'job_id':job_id,'original_page_text':section['text'],
                                   'metadata':metadata, 'source':source})
                    hits[focus] += 1
        coverage.append({'source_id':source['source_id'],'source_url':source['source_url'],
                         'hrr_evidence_report':source.get('hrr_kind') == 'evidence_report','eligible_chunks':dict(hits),
                         'status':'eligible' if hits else 'no_targeted_passage'})
    return result, coverage


def materialize(catalog, record, job):
    source, focus = job['source'], job['focus']
    kind = 'biomarkers' if focus == 'monitoring' else 'microbiome'
    name = record.indicator if focus == 'monitoring' else record.microbiome_concept
    attributes = {}
    if focus == 'monitoring':
        attributes = {'unit':record.unit, 'measurement_method':record.measurement_method,
                      'monitoring_device':record.device}
    eid = catalog.evidence(source, job, record.evidence_text)
    entity_id = catalog.entity(kind, name, attributes)
    details = record.model_dump(exclude={'related_name','related_kind','relationship','evidence_text'})
    details['record_type'] = focus+'_source_observation'
    details['study_schedule_is_not_a_clinical_recommendation'] = True
    catalog.claim(entity_id, 'described_by', '', json.dumps(details,ensure_ascii=False,sort_keys=True), source,eid,
                  record.study_population,record.study_environment,record.limitations)
    if record.related_name:
        related = catalog.entity(record.related_kind, record.related_name)
        claim_id = catalog.claim(related, record.relationship, entity_id, record.evidence_text, source,eid,
                                 record.study_population,record.study_environment,record.limitations)
        table = ('condition_' if record.related_kind == 'conditions' else 'risk_') + ('biomarker' if focus == 'monitoring' else 'microbiome')
        catalog.add('relations/'+table, dict(relation_id=stable_id('relation', related,record.relationship,entity_id),
            source_entity_id=related,target_entity_id=entity_id,relationship_type=record.relationship,claim_id=claim_id,review_status='pending'))
    if focus == 'monitoring' and record.measurement_method:
        # Existing frequency column cannot distinguish study schedules from care
        # recommendations. Keep it empty; retain study schedules in claim JSON.
        catalog.add('monitoring/monitoring_guidance', dict(guidance_id=stable_id('guidance',entity_id,eid,record.measurement_method),
            biomarker_id=entity_id,related_condition_id=related if record.related_name and record.related_kind == 'conditions' else '',
            measurement_method=record.measurement_method,recommended_frequency='',measurement_limitations=record.limitations,
            applicable_environment_id='',source_id=source['source_id'],evidence_id=eid,review_status='pending'))


def extract_focused(root, focus='monitoring,microbiome', max_chunks=None, source_id=None, provider=None, hrr_only=False):
    from dotenv import load_dotenv
    load_dotenv(contained(root/'.env'), override=False)
    with writer_lock(root):
        return _extract_focused(root,focus,max_chunks,source_id,provider,hrr_only)


def _extract_focused(root, focus, max_chunks, source_id, provider, hrr_only):
    root = contained(root)
    focuses = tuple(dict.fromkeys(f.strip() for f in focus.split(',')))
    if not focuses or set(focuses)-TOPICS.keys():
        raise ValueError('focus must contain monitoring and/or microbiome')
    provider = provider or LocalFocusedProvider()
    recover(root)
    selected, coverage = jobs(root, focuses, provider, source_id, hrr_only)
    report_path = root/'reports/focused_enrichment/latest.json'
    report = {'started_at':datetime.now(timezone.utc).isoformat(),'status':'running','focuses':focuses,
        'sources':coverage,'eligible_jobs':len(selected),'processed':0,'resumed':0,'errors':[], 'jobs':[],
        'new_rows':{},'duplicates_skipped':0,'reused_entities':[], 'limitations':[
            'All new records remain pending professional review; exact quotations do not prove semantic or clinical validity.',
            'Study schedules are stored as research observations, never recommended monitoring frequencies.',
            'No treatments, protocols, existing records or approved data are modified.',
            'Cached NASA risk summaries are used when HRR evidence PDFs are unavailable; missing coverage is reported.']}
    write_json(report_path, report)
    if not selected:
        report['status'] = 'no_eligible_sources'
        write_json(report_path, report)
        return report
    pending = any(read_json(root/'staging/focused/checkpoints'/f"{job['job_id']}.json", {}).get('status') != 'committed' for job in selected)
    if pending:
        try:
            provider.health_check()
        except Exception as error:
            report['status']='failed'
            report['errors'].append({'stage':'local_model_health_check','error':str(error)})
            write_json(report_path, report)
            return report
    attempted = 0
    for job in selected:
        checkpoint = contained(root/'staging/focused/checkpoints'/f"{job['job_id']}.json")
        old = read_json(checkpoint, {})
        if old.get('status') == 'committed':
            report['resumed'] += 1
            report['jobs'].append(old)
            continue
        stage_path = contained(root/'staging/focused/batches'/f"{job['job_id']}.json")
        transaction_path = contained(root/'staging/focused/transactions'/f"{job['job_id']}.json")
        transaction = read_json(transaction_path, {})
        if stage_path.exists() and transaction.get('status') == 'committed':
            staged = read_json(stage_path)
            entry = {'job_id':job['job_id'],'focus':job['focus'],'source_id':job['source_id'],
                     'source_url':job['source_url'],'status':'committed','metadata':job['metadata'],
                     'new_rows':{f['table']:f['rows'] for f in transaction['files']},
                     **staged.get('statistics', {})}
            write_json(checkpoint, entry)
            report['resumed'] += 1
            report['jobs'].append(entry)
            continue
        if max_chunks is not None and attempted >= max_chunks:
            break
        attempted += 1
        raw_cache = contained(root/'cache/focused'/f"{job['job_id']}.json")
        entry = {'job_id':job['job_id'],'focus':job['focus'],'source_id':job['source_id'],
                 'source_url':job['source_url'],'page_number':job['page_number'],'section':job['section'],'metadata':job['metadata']}
        try:
            cached = read_json(raw_cache)
            if cached and cached.get('metadata') == job['metadata']:
                content = cached['content']
            else:
                content = provider.extract_focused(job)
                write_json(raw_cache, {'metadata':job['metadata'],'content':content,
                                      'raw_content':getattr(provider,'last_raw_content',content)})
            records, rejected, count = parse_output(content, job)
            catalog = AdditiveCatalog(root)
            materialized = []
            for record in records:
                try:
                    trial = deepcopy(catalog)
                    materialize(trial, record, job)
                    catalog = trial
                    materialized.append(record)
                except ValueError as error:
                    rejected.append({'reason':str(error),'record':record.model_dump()})
            batch = {'source_id':job['source_id'],'source_type':job['source'].get('source_type') or 'research_summary',
                     'chunk':{key:job[key] for key in ('chunk_id','page_number','section','text_location','text')},
                     'focused_mode':job['focus'],'raw_extraction':{'records':[r.model_dump() for r in records]},
                     'metadata':job['metadata'],'tables':catalog.new,'rejected':rejected,
                     'statistics':{'candidates':count,'valid_records':len(materialized),'rejected':rejected,
                                   'duplicates_skipped':catalog.duplicates,'reused_entities':sorted(catalog.reused)}}
            if stage_path.exists() and read_json(stage_path) != batch:
                raise ValueError('Existing focused staging is preserved; conflicting regeneration requires manual review')
            if not stage_path.exists():
                write_json(stage_path, batch)
            counts = append_tables(root, catalog.new, job['job_id'])
            entry.update(status='committed',candidates=count,valid_records=len(materialized),rejected=rejected,
                         new_rows=counts,duplicates_skipped=catalog.duplicates,reused_entities=sorted(catalog.reused))
            write_json(checkpoint, entry)
            report['processed'] += 1
            report['duplicates_skipped'] += catalog.duplicates
            report['reused_entities'].extend(sorted(catalog.reused))
            for table,n in counts.items():
                report['new_rows'][table] = report['new_rows'].get(table,0)+n
        except Exception as error:
            entry.update(status='failed',error=str(error))
            write_json(checkpoint, entry)
            report['errors'].append({'job_id':job['job_id'],'error':str(error)})
        report['jobs'].append(entry)
        write_json(report_path, report)
    report['status'] = 'partial_failure' if report['errors'] else 'completed' if report['processed']+report['resumed'] >= len(selected) else 'checkpointed'
    report['finished_at'] = datetime.now(timezone.utc).isoformat()
    write_json(report_path, report)
    write_json(root/'reports/focused_enrichment/runs'/f"{stable_id('run',report['started_at'])}.json",report)
    return report
