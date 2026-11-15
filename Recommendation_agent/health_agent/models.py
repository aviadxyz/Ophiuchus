from datetime import datetime, timezone
from typing import Literal, Any
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime

def now():
    return datetime.now(timezone.utc)

class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)

Severity = Literal['green', 'yellow', 'red', 'undetermined']

class Measurement(Model):
    measurement_id: str
    astronaut_id: str
    metric: str
    value: float
    unit: str
    timestamp: AwareDatetime
    source: str = Field(min_length=1)
    quality: float | None = Field(default=None, ge=0, le=1)

class AssessmentRequest(Model):
    astronaut_id: str = Field(min_length=1)
    request_id: str = Field(min_length=1, max_length=128)
    measurements: list[dict[str, Any]] = Field(default_factory=list, max_length=1000)
    symptoms: list[str] = Field(default_factory=list, max_length=100)
    mission_context: dict[str, Any] = Field(default_factory=dict)

class ValidationResult(Model):
    status: Literal['valid', 'partial', 'invalid']
    normalized: list[Measurement]
    rejected: list[dict[str, Any]]
    warnings: list[str]
    data_quality: str

class Finding(Model):
    metric: str
    current_value: float
    baseline_value: float | None
    unit: str
    deviation: float | None
    moving_average: float
    slope_per_day: float | None
    trend: str
    finding_type: str = 'statistical_observation'
    data_quality: str
    measurement_ids: list[str]

class Risk(Model):
    risk_id: str
    risk_type: str
    severity: Severity
    supporting_measurement_ids: list[str]
    rule_ids: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    uncertainty: str
    escalation_required: bool = False
    escalation_protocol_id: str | None = None

class Recommendation(Model):
    recommendation_id: str
    title: str
    description: str
    category: Literal['monitoring', 'preventive', 'medication', 'supplement', 'escalation']
    priority: int
    severity: Severity
    status: Literal['approved_action', 'requires_review', 'informational_only', 'escalation']
    related_risk_ids: list[str]
    supporting_metric_ids: list[str]
    protocol_id: str
    evidence_ids: list[str]
    source_links: list[str]
    frequency_label: str | None = None
    recheck_time: str | None = None
    requires_medical_approval: bool = False
    reasoning_summary: str
    protocol_origin: Literal['approved_protocol', 'draft_candidate'] = 'approved_protocol'
    protocol_review_status: str | None = None
    matching_condition_ids: list[str] = Field(default_factory=list)
    matching_relation_ids: list[str] = Field(default_factory=list)
    applicability_limitations: list[str] = Field(default_factory=list)

class Assessment(Model):
    assessment_id: str
    astronaut_id: str
    assessment_status: Literal['completed', 'incomplete', 'invalid_input', 'medical_review_required']
    risk_level: Severity
    escalation_required: bool
    escalation_status: str
    recommendations: list[Recommendation] = Field(max_length=5)
    findings: list[Finding]
    risks: list[Risk]
    validation: ValidationResult
    limitations: list[str]
    generated_at: datetime = Field(default_factory=now)
    model_version: str
    rules_version: str
    professional_review_status: str = 'not_reviewed'
    research_knowledge: list[dict[str, Any]] = Field(default_factory=list)
    protocol_mode: Literal['approved', 'candidate_review'] = 'approved'

class LLMSelection(Model):
    protocol_ids: list[str] = Field(max_length=5)
