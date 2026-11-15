import json
import re
from pydantic import ValidationError
from knowledge_ingestion.validation import verify_evidence
from .models import MonitoringRecord, MicrobiomeRecord

ANATOMY = {'heart','brain','bone','bones','muscle','muscles','skin','gut','blood','saliva','immune system','cardiovascular system'}
MEASURES = re.compile(r'heart.rate|variability|pressure|sleep.(?:duration|efficiency|quality|loss)|temperature|respiratory.rate|oxygen.saturation|physical.activity|muscle.(?:strength|force)|bone.(?:mineral.)?density|cognitiv|performance|radiation.(?:dose|exposure)|hormone|cytokine|cortisol|count|concentration|level|strength|density|duration|efficiency', re.I)


def validate_record(raw, job):
    model = MonitoringRecord if job['focus'] == 'monitoring' else MicrobiomeRecord
    record = model.model_validate(raw)
    quote = record.evidence_text
    # Recover source capitalization only when the entire supplied span matches
    # contiguously. Never expand a quote or change its meaning/punctuation.
    if not verify_evidence(quote, job['text']):
        position = job['text'].casefold().find(quote.casefold())
        if position >= 0:
            quote = job['text'][position:position+len(quote)]
            record.evidence_text = quote
    if not verify_evidence(quote, job['text']) or not verify_evidence(quote, job['original_page_text']):
        raise ValueError('missing_exact_source_evidence')
    name = record.indicator if job['focus'] == 'monitoring' else record.microbiome_concept
    for field in (('indicator',) if job['focus']=='monitoring' else ('microbiome_concept',)) + ('related_name','observed_change','population_text','study_environment','limitations','measurement_method','device','study_schedule','site'):
        value = getattr(record, field, None)
        if value and not verify_evidence(value, quote):
            position = quote.casefold().find(value.casefold())
            if position >= 0:
                setattr(record, field, quote[position:position+len(value)])
    name = record.indicator if job['focus'] == 'monitoring' else record.microbiome_concept
    if not verify_evidence(name, quote):
        raise ValueError('entity_name_not_verbatim')
    for field in ('related_name','observed_change','population_text','study_environment','limitations','unit','measurement_method','device','study_schedule','site'):
        value = getattr(record, field, None)
        if value and not verify_evidence(value, quote):
            raise ValueError('field_not_verbatim:'+field)
    if bool(record.related_name) != bool(record.related_kind) or bool(record.related_name) != bool(record.relationship):
        raise ValueError('incomplete_relationship_endpoints')
    if record.related_name and record.related_name.casefold().strip() in ANATOMY | {'space','spaceflight','microgravity','international space station','astronauts'}:
        raise ValueError('related_concept_is_not_a_condition_or_risk')
    if record.study_population != 'unknown':
        if not record.population_text:
            raise ValueError('population_requires_source_text')
        patterns = {'human_astronauts':r'astronaut|crew', 'ground_based_humans':r'human|people|participants|volunteer',
                    'animal_models':r'mice|mouse|rat|animal|rodent', 'cell_cultures':r'cell|culture|in vitro',
                    'simulations':r'simulat|model', 'mixed':r'astronaut|crew|mice|mouse|animal|cell|participant'}
        if not re.search(patterns[record.study_population], record.population_text, re.I):
            raise ValueError('population_label_not_supported')
        if record.study_population == 'human_astronauts' and re.search(r'\b(?:mice|mouse|rats|rodents|in vitro)\b', quote, re.I):
            raise ValueError('mixed_or_nonhuman_population_must_not_be_upgraded')
    if job['focus'] == 'monitoring':
        if name.casefold().strip() in ANATOMY or not MEASURES.search(name):
            raise ValueError('not_a_named_measurable_indicator')
        if re.search(r'dosimeter|spectrometer|ultrasound device|instrument|sensor|\bmonitor\b|actigraph(?:y)?$', name, re.I):
            raise ValueError('device_or_method_is_not_an_indicator')
        if re.search(r'radiation|exposure|ambient', name, re.I) and record.category != 'environmental_exposure':
            raise ValueError('environmental_exposure_misclassified')
        if record.category == 'environmental_exposure' and not re.search(r'radiation|exposure|ambient|noise|carbon dioxide|humidity|pressure',name,re.I):
            raise ValueError('physiological_measurement_is_not_environmental_exposure')
    else:
        if re.search(r'disinfect|antibiotic|anti-inflammatory|treatment|supplement', name, re.I):
            raise ValueError('treatment_is_not_a_microbiome_concept')
        organism_context = record.category == 'organism' and re.search(r'microb|bacter|fung|taxon|species|organism|virus',quote,re.I)
        if not re.search(r'microb|bacter|virus|viruses|fung|taxa|diversity|abundance|composition|flora', name, re.I) and not organism_context:
            raise ValueError('microbiome_concept_not_explicit')
        if record.category in ('diversity','abundance') and not re.search(record.category, quote, re.I):
            raise ValueError('diversity_and_abundance_are_not_interchangeable')
        if record.category == 'microbiome' and not re.search(r'microbiome',name,re.I):
            raise ValueError('community_or_organism_is_not_automatically_a_microbiome')
        if record.site and re.search(r'gut|intestin', record.site, re.I) and not re.search(r'gut|intestin', quote, re.I):
            raise ValueError('gut_site_not_supported')
        if record.scope == 'human' and re.search(r'hardware|surface|environmental|crop', quote, re.I) and not re.search(r'skin|gut|intestin|human|bodies', quote, re.I):
            raise ValueError('environmental_microbes_are_not_human_gut_microbiome')
        if record.scope == 'animal' and not re.search(r'mice|mouse|rats|animal|rodent',quote,re.I):
            raise ValueError('animal_scope_not_supported')
        if record.scope == 'environmental' and not re.search(r'hardware|surface|environmental|crop|cabin|water system|air filter',quote,re.I):
            raise ValueError('environmental_scope_not_supported')
        if record.scope == 'human' and not re.search(r'astronaut|crew|human|skin|gut|intestin|bodies',quote,re.I):
            raise ValueError('human_scope_not_supported')
    if record.relationship:
        cues = {
            'monitored_by':r'monitor|measur|assess|indicator|biomarker|track|quantif|determin',
            'associated_with':r'associat|correlat|link|relat|affect|alter|change|risk|due to|lead to|susceptib|chances|elevat',
            'correlates_with':r'correlat',
            'investigated_as_indicator_of':r'investigat|research|stud(?:y|ies)|explor',
            'investigated_in_relation_to':r'investigat|research|stud(?:y|ies)|explor|uncertain|unknown',
        }
        if not re.search(cues[record.relationship], quote, re.I):
            raise ValueError('relationship_semantics_not_supported')
        if re.search(r'not associated|no (?:clear |evidence of )?(?:association|correlation)|not correlated', quote, re.I):
            raise ValueError('negated_relationship_requires_manual_review')
        if re.search(r'remain(?:s)? (?:unknown|uncertain)|uncertain if', quote, re.I) and record.relationship in ('associated_with','correlates_with'):
            raise ValueError('uncertain_relationship_must_remain_investigational')
    # Preserve explicit uncertainty even when the small model omits limitations.
    if not record.limitations and re.search(r'uncertain|unknown|may|might|potential|will (?:investigate|examine)|still being explored', quote, re.I):
        record.limitations = quote
    return record


def parse_output(content, job):
    data = json.loads(content)
    if not isinstance(data, dict) or set(data) != {'records'} or not isinstance(data['records'], list) or len(data['records']) > 3:
        raise ValueError('Expected only records: zero to three source-supported items')
    accepted, rejected = [], []
    for position, item in enumerate(data['records']):
        try:
            accepted.append(validate_record(item, job))
        except (ValidationError, ValueError) as error:
            rejected.append({'index':position,'reason':'invalid_schema' if isinstance(error, ValidationError) else str(error),'record':item})
    return accepted, rejected, len(data['records'])
