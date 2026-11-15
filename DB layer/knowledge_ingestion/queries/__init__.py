from pathlib import Path
import csv
from knowledge_ingestion.storage import SCHEMAS

class KnowledgeBase:
    """Runtime queries read reviewed exports only. Clinical protocols require separate authorization."""
    def __init__(self, root='DB/approved'):
        self.root=Path(root)
        if self.root.name=='draft': raise ValueError('Runtime queries cannot use draft exports')
    def rows(self,table):
        path=self.root/(table+'.csv')
        if not path.exists(): return []
        with path.open(encoding='utf-8',newline='') as f:
            return [r for r in csv.DictReader(f) if r.get('review_status','approved')=='approved']
    def get_supporting_evidence(self,claim_id):
        claims=[c for c in self.rows('evidence/knowledge_claims') if c['claim_id']==claim_id]
        return {'claims':claims,'evidence':[e for e in self.rows('evidence/evidence') if any(c['evidence_id']==e['evidence_id'] for c in claims)],'sources':[s for s in self.rows('metadata/sources') if any(c['source_id']==s['source_id'] for c in claims)]}
    def related(self,table,identifier):
        result=[]
        for r in self.rows('relations/'+table):
            if identifier in (r['source_entity_id'],r['target_entity_id']):
                support=self.get_supporting_evidence(r['claim_id'])
                if support['claims'] and support['evidence']: result.append({'relation':r,**support})
        return result
    def get_environment_risks(self,environment_id): return self.related('environment_risk',environment_id)
    def get_condition_details(self,condition_id):
        return {'condition':next((e for e in self.rows('entities/conditions') if e['condition_id']==condition_id),None),'claims':[self.get_supporting_evidence(c['claim_id']) for c in self.rows('evidence/knowledge_claims') if condition_id in (c['subject_entity_id'],c['object_entity_id'])]}
    def get_related_biomarkers(self,condition_id): return self.related('condition_biomarker',condition_id)
    def get_preventive_actions(self,condition_id): return self.related('condition_treatment',condition_id)
    def get_treatment_evidence(self,treatment_id):
        return [self.get_supporting_evidence(c['claim_id']) for c in self.rows('evidence/knowledge_claims') if treatment_id in (c['subject_entity_id'],c['object_entity_id'])]
    def search_medical_knowledge(self,query):
        return [self.get_supporting_evidence(c['claim_id']) for c in self.rows('evidence/knowledge_claims') if query.casefold() in c['claim_text'].casefold()]
    def get_approved_protocols(self,condition_id):
        return [r for r in self.rows('protocols/approved_protocols') if r['related_condition_id']==condition_id and r.get('authorized_by') and r.get('authorized_at')]

_default=KnowledgeBase()
get_environment_risks=_default.get_environment_risks
get_condition_details=_default.get_condition_details
get_related_biomarkers=_default.get_related_biomarkers
get_preventive_actions=_default.get_preventive_actions
get_treatment_evidence=_default.get_treatment_evidence
get_supporting_evidence=_default.get_supporting_evidence
search_medical_knowledge=_default.search_medical_knowledge
get_approved_protocols=_default.get_approved_protocols
