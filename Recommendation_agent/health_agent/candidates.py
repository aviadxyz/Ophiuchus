"""Draft research matching for review cards; never a clinical authorization path."""
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit
from pydantic import Field
from .models import Model, Finding
from .analysis import UNITS


class Applicability(Model):
    expected_evidence_id: str
    required_conditions: str
    required_profile: dict[str, str]
    environment_ids: list[str]


class CandidateConfig(Model):
    version: str = Field(min_length=1)
    metric_biomarker_ids: dict[str, list[str]] = Field(default_factory=dict)
    protocols: dict[str, Applicability]


class ReviewCandidate(Model):
    protocol_id: str
    title: str
    treatment_id: str
    review_status: str
    matching_condition_ids: list[str]
    matching_relation_ids: list[str]
    supporting_measurement_ids: list[str]
    sources: list[dict[str, Any]]
    match_basis: str
    applicability_limitations: list[str]


def load_config(value=None):
    if value is None:
        value = json.loads((Path(__file__).resolve().parents[1]/'config/candidate_applicability.json').read_text(encoding='utf-8'))
    config = CandidateConfig.model_validate(value)
    if set(config.metric_biomarker_ids) - set(UNITS):
        raise ValueError('Candidate metric mapping contains unsupported metrics')
    return config


class CandidateRetriever:
    def __init__(self, knowledge, configuration=None):
        if not knowledge.draft_mode:
            raise ValueError('candidate_review requires HEALTH_KNOWLEDGE_MODE=draft')
        self.knowledge = knowledge
        self.config = load_config(configuration)

    def _rows(self, table):
        return [r for r in self.knowledge.rows(table) if r.get('review_status') in ('pending', 'approved')]

    def _index(self, table, key):
        result = {}
        for row in self._rows(table):
            identifier = row.get(key)
            if not identifier or identifier in result:
                raise ValueError('Missing or duplicate draft identifier: ' + table)
            result[identifier] = row
        return result

    def retrieve(self, profile: dict, findings: list[Finding]) -> dict:
        conditions = self._index('entities/conditions', 'condition_id')
        treatments = self._index('entities/treatments', 'treatment_id')
        biomarkers = self._index('entities/biomarkers', 'biomarker_id')
        environments = self._index('entities/environments', 'environment_id')
        claims = self._index('evidence/knowledge_claims', 'claim_id')
        evidence = self._index('evidence/evidence', 'evidence_id')
        sources = self._index('metadata/sources', 'source_id')
        blocked, matched = [], []
        if not profile.get('mission_id') or profile.get('environment_id') not in environments:
            return {'candidates':[], 'blocked':[], 'reason':'Trusted mission/environment context is missing or unresolved.'}
        condition_ids = profile.get('condition_ids', [])
        if not isinstance(condition_ids, list) or any(not isinstance(i, str) for i in condition_ids):
            return {'candidates':[], 'blocked':[], 'reason':'Trusted condition_ids must be a list of existing condition IDs.'}
        recorded = set(condition_ids) & conditions.keys()

        def support(evidence_id, source_id=None):
            ev = evidence.get(evidence_id)
            src = sources.get(ev.get('source_id')) if ev else None
            if not ev or not src or (source_id and src['source_id'] != source_id):
                return None
            url = src.get('source_url', '')
            if (not ev.get('evidence_text') or ev.get('verification_status') != 'exact_match'
                    or src.get('fetch_status') != 'success' or ev.get('source_url') != url
                    or urlsplit(url).scheme not in ('http', 'https') or not urlsplit(url).hostname):
                return None
            record = next((s for s in self.knowledge.get_supporting_evidence(evidence_id=evidence_id, research_only=True)
                           if s['source_id'] == src['source_id']), None)
            if record:
                associated = [c for c in claims.values() if c.get('evidence_id') == evidence_id]
                record = dict(record, research_only=True, protocol_origin='draft_candidate',
                    source_review_status=src['review_status'],
                    evidence_classification=[c.get('evidence_status', 'unknown') for c in associated],
                    study_population=[c.get('study_population', 'unknown') for c in associated],
                    limitations=[c.get('limitations', '') for c in associated])
            return record

        def relation_support(row, left, right):
            claim = claims.get(row.get('claim_id'))
            if not claim or (claim.get('subject_entity_id'), claim.get('object_entity_id'), claim.get('predicate')) != (left, right, row.get('relationship_type')):
                return None
            if claim.get('evidence_status') == 'investigational':
                return None
            return support(claim.get('evidence_id'), claim.get('source_id'))

        # Only declared metric IDs and actual graph edges can connect a reading
        # to a condition. No diagnosis or numerical risk is inferred by this join.
        measurement_links = {}
        for row in self._rows('relations/condition_biomarker'):
            cid, bid = row.get('source_entity_id'), row.get('target_entity_id')
            if cid not in conditions or bid not in biomarkers:
                continue
            if row.get('relationship_type') != 'monitored_by':
                continue
            source = relation_support(row, cid, bid)
            if not source:
                continue
            for finding in findings:
                if bid in self.config.metric_biomarker_ids.get(finding.metric, []):
                    measurement_links.setdefault(cid, []).append((row['relation_id'], finding.measurement_ids, source))
        treatment_links = self._rows('relations/condition_treatment')
        seen_ids = set()
        for candidate in self._rows('protocols/candidate_protocols'):
            pid = candidate.get('protocol_id')
            if not pid or pid in seen_ids:
                raise ValueError('Missing or duplicate draft candidate protocol ID')
            seen_ids.add(pid)
            cid, tid = candidate.get('related_condition_id'), candidate.get('treatment_id')
            reason = None
            policy = self.config.protocols.get(pid)
            if cid not in conditions or tid not in treatments:
                reason = 'Condition or treatment reference is missing or rejected.'
            elif cid not in recorded and cid not in measurement_links:
                reason = 'No recorded personal condition or explicit measurement relationship matches.'
            elif not policy or policy.expected_evidence_id != candidate.get('evidence_id') or policy.required_conditions != candidate.get('required_conditions', ''):
                reason = 'Candidate applicability mapping is missing or no longer matches its source record.'
            elif any(profile.get(key) != value for key, value in policy.required_profile.items()):
                reason = 'Trusted mission phase/activity/gravity context does not match.'
            elif policy.environment_ids and profile['environment_id'] not in policy.environment_ids:
                reason = 'Trusted environment does not match the documented context.'
            elif candidate.get('contraindications'):
                reason = 'Documented contraindications require a structured clinical review; not interpreted as free text.'
            elif treatments[tid].get('medication_or_supplement') not in ('', None) or treatments[tid].get('treatment_type') in ('medication', 'supplement'):
                reason = 'Medication and supplement suggestions require the approved protocol/inventory path.'
            elif treatments[tid].get('evidence_status') == 'investigational':
                reason = 'Treatment is explicitly investigational.'
            if reason:
                blocked.append({'protocol_id':pid, 'reason':reason})
                continue
            source = support(candidate.get('evidence_id'), candidate.get('source_id'))
            linked = []
            for row in treatment_links:
                if (row.get('source_entity_id'), row.get('target_entity_id'), row.get('relationship_type')) != (cid, tid, 'countermeasure_for'):
                    continue
                proof = relation_support(row, cid, tid)
                if proof and proof['evidence_id'] == candidate['evidence_id']:
                    linked.append(row)
            if not source or not linked or not candidate.get('indication') or candidate['indication'] not in source['supporting_excerpt']:
                blocked.append({'protocol_id':pid, 'reason':'Candidate relationship, indication or evidence cannot be resolved consistently.'})
                continue
            links = measurement_links.get(cid, [])
            proof_sources = {s['evidence_id']:s for s in [source]+[link[2] for link in links]}
            matched.append(ReviewCandidate(protocol_id=pid, title=treatments[tid]['canonical_name'], treatment_id=tid,
                review_status=candidate['review_status'], matching_condition_ids=[cid],
                matching_relation_ids=sorted({r['relation_id'] for r in linked}|{link[0] for link in links}),
                supporting_measurement_ids=sorted({mid for link in links for mid in link[1]}), sources=list(proof_sources.values()),
                match_basis='recorded_condition' if cid in recorded else 'measurement_relationship',
                applicability_limitations=['Research candidate only; individual safety and applicability are not established.',
                    'Contraindications and complete eligibility requirements are undocumented; medical review is required.',
                    'A condition association or monitored biomarker is not a diagnosis or evidence of treatment benefit for this astronaut.']))
        matched.sort(key=lambda c:(0 if c.match_basis == 'recorded_condition' else 1, c.protocol_id))
        unique, seen = [], set()
        for candidate in matched:
            if candidate.treatment_id not in seen:
                unique.append(candidate)
                seen.add(candidate.treatment_id)
        return {'candidates':unique, 'blocked':blocked,
                'reason':None if unique else 'No draft candidate has a traceable personal match and applicable trusted mission context.'}
