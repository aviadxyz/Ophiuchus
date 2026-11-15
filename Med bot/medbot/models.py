from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime


def utcnow():
    return datetime.now(timezone.utc)


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False, str_strip_whitespace=True)


Mood = Literal['neutral', 'positive', 'anxious', 'stressed', 'sad', 'frustrated', 'lonely', 'fatigued', 'overwhelmed', 'unknown']
Intent = Literal['general_medical_question', 'personal_health_question', 'health_data_explanation', 'mental_health_support', 'emotional_check_in', 'medical_and_emotional', 'casual_conversation', 'urgent_support', 'unknown']


class Consent(Model):
    personal_health: bool = False
    save_conversations: bool = False
    mood_history: bool = False


class ConsentUpdate(Model):
    personal_health: bool | None = None
    save_conversations: bool | None = None
    mood_history: bool | None = None


class ChatRequest(Model):
    session_id: str | None = Field(default=None, min_length=1, max_length=128)
    request_id: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=4000)
    consent: ConsentUpdate | None = None
    self_reported_mood: Mood | None = None
    reply_mode: Literal['standard', 'watch'] = 'standard'
    screen_id: str | None = Field(default=None, max_length=80)
    # Must be deliberate confirmation; prose alone never initiates a formal assessment.
    formal_assessment: bool = False


class MoodAssessment(Model):
    label: Mood = 'unknown'
    source: Literal['self_report', 'message_inference', 'unavailable'] = 'unavailable'
    confidence: Literal['low', 'moderate', 'high', 'unknown'] = 'unknown'
    user_confirmed: bool = False


class Classification(Model):
    intent: Intent = 'unknown'
    mood: Mood = 'unknown'
    confidence: Literal['low', 'moderate', 'high', 'unknown'] = 'unknown'
    urgent: bool = False
    needs_health: bool = False
    needs_recommendations: bool = False
    needs_support_options: bool = False
    search_terms: list[str] = Field(default_factory=list, max_length=4)
    metrics: list[str] = Field(default_factory=list, max_length=9)


class GeneratedReply(Model):
    # Clinical factual text is rendered from retrieved records, not free generation.
    reply: str = Field(min_length=1, max_length=2400)
    source_ids: list[str] = Field(default_factory=list, max_length=8)
    action_ids: list[str] = Field(default_factory=list, max_length=5)
    forward: bool = False


class Source(Model):
    id: str
    title: str
    url: str
    excerpt: str
    review_status: str
    research_only: bool
    limitations: list[str] = Field(default_factory=list)


class SuggestedAction(Model):
    id: str
    description: str
    protocol_id: str
    status: Literal['approved_action', 'requires_review', 'informational_only', 'escalation']


class ChatResponse(Model):
    session_id: str
    message_id: str
    intent: Intent
    mood_assessment: MoodAssessment
    reply: str
    sources: list[Source] = Field(default_factory=list)
    suggested_actions: list[SuggestedAction] = Field(default_factory=list)
    safety_status: Literal['normal', 'urgent', 'service_unavailable', 'response_withheld'] = 'normal'
    human_support_available: bool = False
    support_status: Literal['not_configured'] = 'not_configured'
    forward: bool = False
    limitations: list[str] = Field(default_factory=list)
    assessment_id: str | None = None
    generated_at: datetime = Field(default_factory=utcnow)


class MoodCheckin(Model):
    request_id: str = Field(min_length=1, max_length=128)
    mood: Mood
    intensity: int | None = Field(default=None, ge=1, le=5, strict=True)
    note: str | None = Field(default=None, max_length=1000)
    timestamp: AwareDatetime = Field(default_factory=utcnow)


class SupportRequest(Model):
    session_id: str | None = Field(default=None, max_length=128)
    recipient: Literal['crew_medical_officer', 'flight_surgeon', 'behavioral_health_professional', 'onboard_emergency_contact']
    consent_to_share: bool = False
    summary: str = Field(default='', max_length=1000)


class LegacyChatRequest(Model):
    message: str = Field(min_length=1, max_length=1000)
    screenId: str = Field(max_length=80)
    screenLabel: str = Field(max_length=120)
    context: str = Field(default='', max_length=12000)
    replyMode: Literal['standard', 'watch'] = 'standard'
