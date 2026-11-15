import csv
import json
from copy import deepcopy
from pathlib import Path
import pytest
from knowledge_ingestion.focused.safety import BOUNDARY, contained, write_json, write_bytes, read_rows
from knowledge_ingestion.focused.runner import extract_focused, jobs
from knowledge_ingestion.focused.validation import validate_record
from knowledge_ingestion.focused.append import FOCUSED_SCHEMAS, AdditiveCatalog, append_tables, recover
from knowledge_ingestion.pipeline import export
from knowledge_ingestion.storage import read_json

MONITOR = 'In astronauts, low blood pressure is monitored using blood pressure measurements before landing.'
MICROBE = 'In astronauts, gut microbial diversity is associated with immune dysregulation during spaceflight.'


def csv_write(path, table, rows):
    stream = __import__('io').StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=FOCUSED_SCHEMAS[table].split(),lineterminator='\r\n')
    writer.writeheader()
    writer.writerows(rows)
    write_bytes(path, stream.getvalue().encode())


def monitoring():
    return dict(indicator='blood pressure', category='physiological', related_name='low blood pressure',
        related_kind='conditions',relationship='monitored_by',measurement_method='blood pressure measurements',
        study_schedule='before landing',study_population='human_astronauts',population_text='astronauts',evidence_text=MONITOR)


def microbiome():
    return dict(microbiome_concept='gut microbial diversity',category='diversity',scope='human',site='gut',
        related_name='immune dysregulation',related_kind='conditions',relationship='associated_with',
        study_population='human_astronauts',population_text='astronauts',study_environment='spaceflight',evidence_text=MICROBE)


class Mock:
    model='synthetic-local-model'
    def __init__(self):self.calls=[]
    def health_check(self):return {'status':'ready'}
    def cache_settings(self):return {'temperature':0}
    def extract_focused(self,job):
        self.calls.append(job['job_id'])
        return json.dumps({'records':[monitoring() if job['focus']=='monitoring' else microbiome()]})


@pytest.fixture
def scenario(tmp_path):
    root=contained(tmp_path)
    source=dict(source_id='synthetic_source',source_url='https://www.nasa.gov/reference/synthetic-fixture/',
        title='Synthetic test only',fetch_status='success',cache_path='cache/synthetic.json',review_status='pending')
    write_json(root/'staging/sources/manifest.json',{'synthetic_source':source})
    write_json(root/'cache/synthetic.json',{'source_id':'synthetic_source','source_url':source['source_url'],
        'pages':[{'page_number':2,'text':MONITOR+' '+MICROBE}]})
    csv_write(root/'DB/draft/metadata/sources.csv','metadata/sources',[source])
    # Deliberately noncanonical bytes and a reviewed old value must survive exactly.
    old=dict(biomarker_id='old_indicator',canonical_name='blood pressure',unit='OLD_UNIT',review_status='approved')
    csv_write(root/'DB/draft/entities/biomarkers.csv','entities/biomarkers',[old])
    write_bytes(root/'DB/approved/protocols/approved_protocols.csv', b'untouched approved sentinel\r\n')
    return root


def job(text,focus):return {'focus':focus,'text':text,'original_page_text':text}


def test_monitoring_and_microbiome_end_to_end_preserve_existing(scenario):
    root=scenario
    old=(root/'DB/draft/entities/biomarkers.csv').read_bytes()
    protected=(root/'DB/approved/protocols/approved_protocols.csv').read_bytes()
    result=extract_focused(root,provider=Mock())
    assert result['status']=='completed'
    assert result['new_rows']['relations/condition_biomarker']==1
    assert result['new_rows']['relations/condition_microbiome']==1
    assert result['new_rows']['entities/microbiome']==1
    assert (root/'DB/draft/entities/biomarkers.csv').read_bytes()==old
    assert (root/'DB/approved/protocols/approved_protocols.csv').read_bytes()==protected
    relations=read_rows(root/'DB/draft/relations/condition_biomarker.csv')
    assert relations[0]['target_entity_id']=='old_indicator'
    guidance=read_rows(root/'DB/draft/monitoring/monitoring_guidance.csv')[0]
    assert guidance['recommended_frequency']==''
    claims=read_rows(root/'DB/draft/evidence/knowledge_claims.csv')
    assert any('before landing' in c['claim_text'] for c in claims)
    assert all(c['review_status']=='pending' for c in claims)
    assert all(e['page_number']=='2' for e in read_rows(root/'DB/draft/evidence/evidence.csv'))
    assert not (root/'DB/draft/entities/treatments.csv').exists()


def test_resume_skips_model_and_preserves_all_prefixes(scenario):
    first=Mock();extract_focused(scenario,provider=first)
    before={p:p.read_bytes() for p in (scenario/'DB').rglob('*.csv')}
    second=Mock();result=extract_focused(scenario,provider=second)
    assert not second.calls and result['resumed']==2
    assert all(p.read_bytes()==v for p,v in before.items())
    export(scenario,draft=True)
    assert all(p.read_bytes()==v for p,v in before.items())


def test_alias_resolution_reuses_id_without_rewriting_rows(scenario):
    csv_write(scenario/'DB/draft/aliases/aliases.csv','aliases/aliases',[
        dict(alias_id='a',alias='arterial pressure',entity_id='old_indicator',entity_type='biomarkers',source_id='synthetic_source',review_status='approved')])
    catalog=AdditiveCatalog(scenario)
    assert catalog.entity('biomarkers','arterial pressure')=='old_indicator'
    assert 'entities/biomarkers' not in catalog.new


@pytest.mark.parametrize('field,value', [('indicator','heart'),('indicator','ultrasound device'),('category','environmental_exposure')])
def test_monitoring_classification_guards(field,value):
    record=monitoring()
    if value=='environmental_exposure':
        record.update(indicator='radiation exposure',category='physiological',evidence_text='Astronaut radiation exposure is measured during flight.')
    else:record.update({field:value},evidence_text=f'Astronauts use a {value} in flight.')
    with pytest.raises(ValueError):validate_record(record,job(record['evidence_text'],'monitoring'))


def test_valid_environmental_exposure_is_separate_category():
    text='Radiation dose is measured with a dosimeter during spaceflight.'
    r=validate_record(dict(indicator='Radiation dose',category='environmental_exposure',device='dosimeter',evidence_text=text),job(text,'monitoring'))
    assert r.category=='environmental_exposure'


def test_microbiome_abundance_not_diversity_and_environment_not_gut():
    text='Microbial abundance was measured on hardware surfaces.'
    with pytest.raises(ValueError):validate_record(dict(microbiome_concept='Microbial abundance',category='diversity',scope='environmental',evidence_text=text),job(text,'microbiome'))
    with pytest.raises(ValueError):validate_record(dict(microbiome_concept='Microbial abundance',category='abundance',scope='human',evidence_text=text),job(text,'microbiome'))


def test_invented_excerpt_and_frequency_rejected():
    r=monitoring();r['evidence_text']='Invented supporting statement that is absent.'
    with pytest.raises(ValueError):validate_record(r,job(MONITOR,'monitoring'))
    r=monitoring();r['study_schedule']='every hour'
    with pytest.raises(ValueError,match='verbatim'):validate_record(r,job(MONITOR,'monitoring'))


def test_correlation_not_causation_and_population_not_upgraded():
    r=microbiome();r['relationship']='causes'
    with pytest.raises(ValueError):validate_record(r,job(MICROBE,'microbiome'))
    text='In mice, gut microbial diversity is associated with immune dysregulation.'
    r=microbiome();r.update(evidence_text=text,population_text='mice',study_environment=None)
    with pytest.raises(ValueError):validate_record(r,job(text,'microbiome'))


def test_risk_endpoint_uses_risk_biomarker_table(scenario):
    class Risk(Mock):
        def extract_focused(self,job):
            r=monitoring();r['related_kind']='risk_factors'
            return json.dumps({'records':[r]})
    extract_focused(scenario,focus='monitoring',provider=Risk())
    assert len(read_rows(scenario/'DB/draft/relations/risk_biomarker.csv'))==1
    assert not (scenario/'DB/draft/relations/condition_biomarker.csv').exists()


def test_path_escape_rejected_without_writing():
    target=BOUNDARY.parent/'must-not-be-created-by-focused-tests.json'
    existed=target.exists()
    with pytest.raises(ValueError):write_json(target,{'bad':True})
    assert target.exists()==existed


def test_new_foreign_key_must_resolve(scenario):
    before=(scenario/'DB/draft/entities/biomarkers.csv').read_bytes()
    with pytest.raises(ValueError,match='unresolved'):
        append_tables(scenario,{'relations/condition_biomarker':[dict(relation_id='r',source_entity_id='missing',target_entity_id='old_indicator',relationship_type='monitored_by',claim_id='missing',review_status='pending')]},'bad')
    assert (scenario/'DB/draft/entities/biomarkers.csv').read_bytes()==before


def test_interrupted_append_recovers_without_new_model_calls(scenario,monkeypatch):
    from knowledge_ingestion.focused import append
    original=append.write_bytes
    calls=[]
    def interrupted(path,data):
        calls.append(path)
        if len(calls)==2:raise OSError('synthetic interruption')
        original(path,data)
    monkeypatch.setattr(append,'write_bytes',interrupted)
    first=extract_focused(scenario,focus='monitoring',provider=Mock())
    assert first['status']=='partial_failure'
    monkeypatch.setattr(append,'write_bytes',original)
    second_model=Mock();second=extract_focused(scenario,focus='monitoring',provider=second_model)
    assert not second_model.calls and second['status']=='completed'
    assert len(read_rows(scenario/'DB/draft/relations/condition_biomarker.csv'))==1


def test_no_files_deleted(scenario):
    before={p for p in scenario.rglob('*') if p.is_file()}
    extract_focused(scenario,provider=Mock())
    assert all(p.exists() for p in before)


def test_astronaut_community_not_misclassified_as_animal_or_whole_microbiome():
    text='The community of microbes on astronauts skin changes during flight.'
    r=dict(microbiome_concept='community of microbes',category='community',scope='animal',evidence_text=text)
    with pytest.raises(ValueError,match='animal_scope'):validate_record(r,job(text,'microbiome'))
    r.update(scope='human',category='microbiome')
    with pytest.raises(ValueError,match='automatically'):validate_record(r,job(text,'microbiome'))


def test_unavailable_local_model_reports_failure_without_invented_rows(scenario):
    class Unavailable(Mock):
        def health_check(self):raise ConnectionError('Synthetic local outage')
    result=extract_focused(scenario,provider=Unavailable())
    assert result['status']=='failed' and not result['new_rows']
    assert not (scenario/'DB/draft/entities/microbiome.csv').exists()


def test_quote_capitalization_recovered_from_exact_source_span():
    record=microbiome()
    record['evidence_text']=MICROBE.lower()
    validated=validate_record(record,job(MICROBE,'microbiome'))
    assert validated.evidence_text==MICROBE


def test_second_writer_rejected_before_model_or_csv_changes(scenario):
    from knowledge_ingestion.focused.safety import writer_lock
    before=(scenario/'DB/draft/entities/biomarkers.csv').read_bytes()
    with writer_lock(scenario):
        with pytest.raises(RuntimeError,match='Another focused writer'):
            extract_focused(scenario,provider=Mock())
    assert (scenario/'DB/draft/entities/biomarkers.csv').read_bytes()==before


def test_named_organism_is_retained_without_renaming_it_to_a_community():
    text='Candida albicans, a fungal organism, was associated with infections in astronauts.'
    r=dict(microbiome_concept='Candida albicans',category='organism',scope='human',related_name='infections',
        related_kind='conditions',relationship='associated_with',evidence_text=text)
    record=validate_record(r,job(text,'microbiome'))
    assert record.microbiome_concept=='Candida albicans' and record.category=='organism'


@pytest.mark.parametrize('supported',[False,True])
def test_exact_span_proposals_need_local_support_and_normal_validation(scenario,supported):
    from knowledge_ingestion.focused.passages import run_passages
    write_json(scenario/'config/focused_passages.json',{'version':'synthetic-proposals','passages':[
        {'source_id':'synthetic_source','focus':'monitoring','record':monitoring()}]})
    class Probe(Mock):
        def __init__(self):
            super().__init__();self.provider=self
        def _chat(self,*args,**kwargs):
            self.calls.append('verify');return json.dumps({'supported':supported})
    provider=Probe()
    report=run_passages(scenario,apply=True,provider=provider)
    assert report['records'][0]['model_source_support'] is supported
    if supported:
        assert len(read_rows(scenario/'DB/draft/relations/condition_biomarker.csv'))==1
        run_passages(scenario,apply=True,provider=provider)
        assert provider.calls==['verify']
    else:
        assert not (scenario/'DB/draft/relations/condition_biomarker.csv').exists()


def test_transient_windows_reader_lock_does_not_lose_json(scenario,monkeypatch):
    from knowledge_ingestion.focused import safety
    original=safety.atomic_json
    attempts=[]
    def temporary_lock(path,value):
        attempts.append(path)
        if len(attempts)==1:raise PermissionError('Synthetic reader lock')
        return original(path,value)
    monkeypatch.setattr(safety,'atomic_json',temporary_lock)
    safety.write_json(scenario/'reader-test.json',{'preserved':True})
    assert read_json(scenario/'reader-test.json')=={'preserved':True} and len(attempts)==2


def test_task_only_quarantine_preserves_originals_and_later_valid_transactions(scenario):
    import base64
    from knowledge_ingestion.focused.restoration import quarantine_task_pilots
    for table in FOCUSED_SCHEMAS:
        path=scenario/'DB/draft'/(table+'.csv')
        if not path.exists():csv_write(path,table,[])
    baseline={}
    for path in (scenario/'DB/draft').rglob('*.csv'):
        data=read_rows(path)
        with path.open(encoding='utf-8',newline='') as stream:fields=next(csv.reader(stream))
        baseline[path.relative_to(scenario).as_posix()]={'original_base64':base64.b64encode(path.read_bytes()).decode(),
            'columns':fields,'row_count':len(data),'ids':[r[fields[0]] for r in data]}
    write_json(scenario/'reports/focused_enrichment/baseline.json',{'csv':baseline})
    result=extract_focused(scenario,provider=Mock())
    microbial_job=next(j['job_id'] for j in result['jobs'] if j['focus']=='microbiome')
    eid=read_rows(scenario/'DB/draft/evidence/evidence.csv')[0]['evidence_id']
    later={'evidence/knowledge_claims':[dict(claim_id='later-valid-claim',subject_entity_id='old_indicator',
        predicate='described_by',object_entity_id='',claim_text=MONITOR,source_id='synthetic_source',evidence_id=eid,review_status='pending')]}
    append_tables(scenario,later,'later-valid')
    quarantine_task_pilots(scenario,{microbial_job})
    assert not read_rows(scenario/'DB/draft/entities/microbiome.csv')
    assert any(r['claim_id']=='later-valid-claim' for r in read_rows(scenario/'DB/draft/evidence/knowledge_claims.csv'))
    append_tables(scenario,later,'later-valid')
    for name,record in baseline.items():
        assert (scenario/name).read_bytes().startswith(base64.b64decode(record['original_base64']))
    export(scenario,draft=True)
    assert not read_rows(scenario/'DB/draft/entities/microbiome.csv')
