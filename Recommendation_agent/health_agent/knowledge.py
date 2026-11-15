"""Read-only adapter to the existing CSV export; clinical authorization is separate."""
import csv
import json
import sys
from datetime import date
from pathlib import Path
from typing import Literal, Any
from urllib.parse import urlsplit
from pydantic import Field, AwareDatetime, ValidationError
from .models import Model, now

DB_LAYER = Path(__file__).resolve().parents[2] / 'DB layer'
sys.path.insert(0, str(DB_LAYER))
from knowledge_ingestion.queries import KnowledgeBase

class DraftResearchKnowledgeBase(KnowledgeBase):
    """Read draft research without changing or granting its review status."""
    def __init__(self, root):
        self.root = Path(root)

    def rows(self, table):
        path = self.root / (table + '.csv')
        if not path.exists():
            return []
        with path.open(encoding='utf-8-sig', newline='') as stream:
            return list(csv.DictReader(stream))

class Rule(Model):
    rule_id: str
    risk_id: str
    risk_type: str
    metric: str
    field: Literal['current_value', 'deviation', 'slope_per_day', 'moving_average']
    operator: Literal['lt', 'gt', 'le', 'ge']
    threshold: float
    minimum_samples: int = Field(default=1, ge=1)
    severity: Literal['green', 'yellow', 'red']
    evidence_ids: list[str] = Field(min_length=1)
    environment_id: str | None = None
    escalation_protocol_id: str | None = None
    authorized_by: str = Field(min_length=1)
    authorized_at: AwareDatetime
    review_status: Literal['approved']

class ProtocolPolicy(Model):
    """Companion authorization schema for fields absent from the existing CSV."""
    protocol_id: str
    title: str = Field(min_length=1)
    allowed_action: str = Field(min_length=1)
    category: Literal['monitoring', 'preventive', 'medication', 'supplement', 'escalation']
    risk_ids: list[str] = Field(min_length=1)
    environment_ids: list[str] = Field(min_length=1)
    required_profile: dict[str, Any]
    contraindications: list[str]
    restrictions_reviewed: Literal[True]
    required_monitoring: str = Field(min_length=1)
    escalation_conditions: str = Field(min_length=1)
    authorization_required: bool
    authorized_by: str = Field(min_length=1)
    authorized_at: AwareDatetime
    review_status: Literal['approved']
    expected_benefit_rank: int = Field(default=0, ge=0)

class KnowledgeTools:
    def __init__(self, root=None, governance=None, demo=False):
        self.root = Path(root or DB_LAYER / 'DB' / 'draft').resolve()
        if 'snapshots' in self.root.parts:
            raise ValueError('Snapshot exports are not runtime knowledge')
        self.draft_mode = self.root.name == 'draft'
        self.kb = DraftResearchKnowledgeBase(self.root) if self.draft_mode else KnowledgeBase(self.root)
        self.clinical_kb = KnowledgeBase(DB_LAYER / 'DB' / 'approved') if self.draft_mode else self.kb
        self.demo = demo
        self.governance = governance or {'version': 'unconfigured', 'rules': [], 'protocol_policies': []}
        if self.governance.get('demo_only') and not demo:
            raise ValueError('Demo governance forbidden in real-data mode')
        self.rules = [Rule.model_validate(r) for r in self.governance.get('rules', [])]
        if any(r.authorized_at > now() for r in self.rules):
            raise ValueError('Assessment rule authorization is in the future')
        if any(r.severity == 'red' and not r.escalation_protocol_id for r in self.rules):
            raise ValueError('Red rules require an explicit escalation protocol')
        self.policies = [ProtocolPolicy.model_validate(p) for p in self.governance.get('protocol_policies', [])]
        if any(p.authorized_at > now() for p in self.policies):
            raise ValueError('Protocol authorization is in the future')

    def rows(self, table):
        path = self.root / (table + '.csv')
        if not path.exists():
            return []
        with path.open(encoding='utf-8-sig', newline='') as f:
            return list(csv.DictReader(f))

    def get_supporting_evidence(self, *, claim_id=None, evidence_id=None, relation_id=None, protocol_id=None, research_only=False) -> list[dict]:
        kb = self.kb if research_only else self.clinical_kb
        claims = kb.rows('evidence/knowledge_claims')
        ids = set([evidence_id] if evidence_id else [])
        if relation_id:
            claim_ids = {r['claim_id'] for path in (kb.root / 'relations').glob('*.csv') for r in kb.rows('relations/' + path.stem) if r['relation_id'] == relation_id}
        else:
            claim_ids = {claim_id} if claim_id else set()
        selected_claims = [c for c in claims if c['claim_id'] in claim_ids or (evidence_id and c['evidence_id'] == evidence_id)]
        ids.update(c['evidence_id'] for c in selected_claims)
        if protocol_id:
            ids.update(p['evidence_id'] for p in kb.rows('protocols/approved_protocols') if p['protocol_id'] == protocol_id and p.get('authorized_by') and p.get('authorized_at'))
        sources = {s['source_id']: s for s in kb.rows('metadata/sources')}
        result = []
        for e in kb.rows('evidence/evidence'):
            source = sources.get(e['source_id'])
            if e['evidence_id'] not in ids or not source or not source.get('source_url') or not e.get('evidence_text'):
                continue
            associated = [c for c in claims if c['evidence_id'] == e['evidence_id']]
            result.append(dict(evidence_id=e['evidence_id'], source_id=source['source_id'], source_title=source['title'],
                organization='NASA' if (urlsplit(source['source_url']).hostname or '').lower().endswith('.nasa.gov') or (urlsplit(source['source_url']).hostname or '').lower() == 'nasa.gov' else 'Source organization not recorded',
                source_url=source['source_url'], page=e.get('page_number'), section=e.get('section'),
                supporting_excerpt=e['evidence_text'], evidence_classification=[c['evidence_status'] for c in associated],
                study_population=[c['study_population'] for c in associated], limitations=[c['limitations'] for c in associated],
                review_status=e['review_status'], demo_only=self.demo, research_only=research_only))
        return result

    def search_medical_knowledge(self, query: str, relation_type: str | None = None) -> dict:
        entities, relationships = [], []
        identifiers = {query}
        for alias in self.kb.rows('aliases/aliases'):
            if alias['alias'].casefold() == query.casefold():
                identifiers.add(alias['entity_id'])
        for path in (self.root / 'entities').glob('*.csv'):
            for row in self.kb.rows('entities/' + path.stem):
                if any(q.casefold() in json.dumps(row).casefold() for q in identifiers):
                    entities.append(row)
                    identifiers.update(v for k, v in row.items() if k.endswith('_id'))
        for path in (self.root / 'relations').glob('*.csv'):
            if relation_type and path.stem != relation_type:
                continue
            for row in self.kb.rows('relations/' + path.stem):
                if identifiers.intersection([row['source_entity_id'], row['target_entity_id']]):
                    evidence = self.get_supporting_evidence(claim_id=row['claim_id'], research_only=True)
                    if evidence:
                        relationships.append({'relationship': row, 'evidence': evidence})
        return {'entities': entities, 'relationships': relationships, 'claims': self.kb.search_medical_knowledge(query), 'clinical_action_authorized': False,
                'knowledge_mode': 'draft_research' if self.draft_mode else 'reviewed', 'research_only': self.draft_mode}

    def retrieve_protocol(self, risks: list, profile: dict, context: dict) -> dict:
        eligible, blocked = [], []
        risk_ids = {r.risk_id for r in risks if r.severity != 'undetermined'}
        records = {p['protocol_id']: p for p in self.clinical_kb.rows('protocols/approved_protocols')}
        for policy in self.policies:
            p = records.get(policy.protocol_id)
            if not p or not risk_ids.intersection(policy.risk_ids):
                continue
            reason = None
            if not p.get('authorized_by') or not p.get('authorized_at') or p['authorized_by'] != policy.authorized_by or p['authorized_at'] != policy.authorized_at.isoformat():
                reason = 'Missing or inconsistent professional authorization'
            elif context.get('environment_id') not in policy.environment_ids:
                reason = 'Environment does not match'
            elif not all(k in profile and profile[k] == v for k, v in policy.required_profile.items()):
                reason = 'Required profile information missing or inapplicable'
            elif not isinstance(profile.get('restrictions'), list) or profile.get('restrictions_complete') is not True:
                reason = 'Restriction review incomplete'
            elif set(policy.contraindications).intersection(profile['restrictions']):
                reason = 'Contraindication present'
            elif not self.get_supporting_evidence(protocol_id=policy.protocol_id):
                reason = 'Evidence cannot be resolved'
            # Existing free text must not be interpreted as executable eligibility rules.
            elif p.get('required_conditions') != 'governance:' + policy.protocol_id or p.get('contraindications') != 'governance:' + policy.protocol_id:
                reason = 'CSV conditions have no validated structured mapping'
            if reason:
                blocked.append({'protocol_id': policy.protocol_id, 'reason': reason})
            else:
                eligible.append({'record': p, 'policy': policy})
        return {'protocols': eligible, 'blocked': blocked, 'reason': None if eligible else 'No applicable explicitly approved protocol with complete safeguards.'}

    def get_mission_inventory(self, mission_id: str | None, protocol: dict, profile: dict, at=None) -> dict:
        p, policy = protocol['record'], protocol['policy']
        at = at or now().date()
        substance = next((t for t in self.clinical_kb.rows('entities/treatments') if t['treatment_id'] == p['treatment_id']), None)
        if not substance or substance.get('medication_or_supplement') != policy.category or profile.get('medication_review_complete') is not True:
            return {'available': False, 'reason': 'Substance approval or astronaut medication safety review missing.'}
        authorized = not policy.authorization_required or p['protocol_id'] in profile.get('clinician_authorized_protocol_ids', [])
        for item in self.clinical_kb.rows('inventory/mission_inventory'):
            if item.get('mission_id') != mission_id or item.get('treatment_id') != p['treatment_id']:
                continue
            try:
                valid = float(item['quantity']) > 0 and date.fromisoformat(item['expiration_date']) > at and item['availability_status'] == 'available'
            except (KeyError, ValueError, TypeError):
                valid = False
            # Inventory's original schema lacks restriction approval fields: require a
            # separately reviewed inventory policy, never assume blank means safe.
            safety = self.governance.get('inventory_policies', {}).get(item['inventory_id'], {})
            safe = safety.get('approved') is True and safety.get('authorized_by') and safety.get('authorized_at') and safety.get('restrictions_reviewed') is True
            conditions = safety.get('required_profile')
            safe = safe and isinstance(conditions, dict) and all(k in profile and profile[k] == v for k, v in conditions.items())
            contraindications = safety.get('contraindications')
            safe = safe and isinstance(contraindications, list) and not set(contraindications).intersection(profile.get('restrictions', []))
            if valid and safe and authorized:
                return {'available': True, 'inventory': item, 'expiration_status': 'valid', 'restrictions': safety, 'approval_requirements_satisfied': True}
        return {'available': False, 'reason': 'Missing stock, expiry, restriction review, or clinician authorization.'}
