from pathlib import Path
import csv
import hashlib
import json
import os
import tempfile

def stable_id(kind, *parts):
    return kind + '_' + hashlib.sha256(json.dumps(parts, ensure_ascii=False).encode()).hexdigest()[:20]

def atomic_json(path, value):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(value, f, ensure_ascii=False, indent=2)
        os.replace(name, path)
    finally:
        if os.path.exists(name): os.unlink(name)

def read_json(path, default=None):
    return json.loads(Path(path).read_text(encoding='utf-8')) if Path(path).exists() else default

def atomic_bytes(path,data):
    path=Path(path); path.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(dir=path.parent,suffix='.tmp')
    try:
        with os.fdopen(fd,'wb') as f: f.write(data)
        os.replace(name,path)
    finally:
        if os.path.exists(name): os.unlink(name)

def write_csv(path, fields, rows):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
            writer.writeheader(); writer.writerows(rows)
        os.replace(name, path)
    finally:
        if os.path.exists(name): os.unlink(name)

ENTITY_FIELDS = {
 'environments': 'environment_id canonical_name environment_type gravity_description radiation_context description',
 'risk_factors': 'risk_id canonical_name category description',
 'conditions': 'condition_id canonical_name body_system description',
 'biomarkers': 'biomarker_id canonical_name unit measurement_method measurement_frequency monitoring_device description',
 'treatments': 'treatment_id canonical_name treatment_type description medication_or_supplement active_ingredient route_of_administration requires_medical_supervision evidence_status',
 **{k: f'{v}_id canonical_name description' for k,v in [('cognitive_findings','cognitive'),('physical_findings','physical'),('genes','gene'),('microbiome','microbiome')]}}
RELATIONS = {'environment_risk':('environments','risk_factors'), 'risk_condition':('risk_factors','conditions'), 'condition_biomarker':('conditions','biomarkers'), 'condition_treatment':('conditions','treatments'), 'condition_cognitive':('conditions','cognitive_findings'), 'condition_physical':('conditions','physical_findings'), 'condition_gene':('conditions','genes'), 'condition_microbiome':('conditions','microbiome'), 'treatment_risk':('treatments','risk_factors')}
SCHEMAS = {f'entities/{k}':v+' review_status' for k,v in ENTITY_FIELDS.items()}
SCHEMAS.update({f'relations/{k}':'relation_id source_entity_id target_entity_id relationship_type claim_id review_status' for k in RELATIONS})
SCHEMAS.update({
 'evidence/evidence':'evidence_id source_id source_url chunk_id page_number section text_location evidence_text extraction_method verification_status review_status',
 'evidence/knowledge_claims':'claim_id subject_entity_id predicate object_entity_id claim_text source_id evidence_id evidence_status study_population study_environment limitations review_status',
 'metadata/sources':'source_id source_url parent_source_id title source_type fetch_status error content_hash cache_path duplicate_of retrieved_at review_status',
 'metadata/source_types':'source_type description', 'metadata/risk_categories':'category description', 'metadata/treatment_types':'treatment_type description',
 'monitoring/monitoring_guidance':'guidance_id biomarker_id related_condition_id measurement_method recommended_frequency measurement_limitations applicable_environment_id source_id evidence_id review_status',
 'protocols/candidate_protocols':'protocol_id related_condition_id treatment_id indication required_conditions contraindications dosage frequency duration source_id evidence_id review_status',
 'protocols/approved_protocols':'protocol_id related_condition_id treatment_id indication required_conditions contraindications dosage frequency duration source_id evidence_id review_status authorized_by authorized_at',
 'inventory/mission_inventory':'inventory_id treatment_id quantity unit expiration_date storage_conditions mission_id availability_status',
 'aliases/aliases':'alias_id alias entity_id entity_type source_id review_status'})
