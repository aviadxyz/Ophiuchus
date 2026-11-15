from hashlib import sha256
import json
import re
from threading import RLock
from weakref import WeakValueDictionary
from uuid import uuid4
from .models import ChatRequest, ChatResponse, Classification, GeneratedReply, MoodAssessment
from .safety import urgent_language, urgent_reply, medication_question, unsafe_reply
from .adapters import request_crew_support
from .llm import OllamaModel


class MedBot:
    def __init__(self, memory, tools, model=None):
        self.memory, self.tools, self.model = memory, tools, model or OllamaModel()
        self._locks = WeakValueDictionary()
        self._lock_guard = RLock()

    def _session_lock(self, session_id):
        with self._lock_guard:
            lock = self._locks.get(session_id)
            if lock is None:
                lock = RLock()
                self._locks[session_id] = lock
            return lock

    def chat(self, astronaut: str, request: ChatRequest) -> ChatResponse:
        # Run language triage immediately, before model or optional data retrieval.
        urgent = urgent_language(request.message)
        if request.session_id:
            self.memory.get_conversation_context(astronaut, request.session_id)
        if request.consent:
            self.memory.update_consent(astronaut, request.consent)
        session_id = request.session_id or self.memory.session_for_request(astronaut, request.request_id)
        context = self.memory.get_conversation_context(astronaut, session_id)
        session_id = context['session_id']
        fingerprint = sha256(json.dumps(request.model_dump(mode='json', exclude={'session_id'}), sort_keys=True).encode()).hexdigest()
        if urgent:
            # Do not queue a crisis message behind an earlier slow model call in
            # this session. Memory operations are short and model-independent.
            with self.memory.lock:
                cached = self.memory.cached_response(astronaut, session_id, request.request_id, fingerprint)
                if cached:
                    return ChatResponse.model_validate(cached)
                self.memory.safety_revision(astronaut, session_id, urgent=True)
                response, _ = self._answer(astronaut, request, context, True)
                self.memory.save_conversation_context(astronaut, session_id, request.message, response.model_dump(mode='json'),
                    request.request_id, fingerprint, False, request.self_reported_mood, context['consent']['save_conversations'])
                return response
        with self._session_lock(session_id):
            context = self.memory.get_conversation_context(astronaut, session_id)
            revision = self.memory.safety_revision(astronaut, session_id)
            cached = self.memory.cached_response(astronaut, session_id, request.request_id, fingerprint)
            if cached:
                return ChatResponse.model_validate(cached)
            response, health_used = self._answer(astronaut, request, context, urgent)
            if revision != self.memory.safety_revision(astronaut, session_id):
                response, health_used = self._answer(astronaut, request, context, True)
            elif response.safety_status == 'urgent':
                self.memory.safety_revision(astronaut, session_id, urgent=True)
            # Respect revocation during an in-flight model call: do not return or
            # retain personal data fetched under consent that has since changed.
            if health_used and not self.memory.consent(astronaut).personal_health:
                response = self._base(session_id, intent='personal_health_question',
                    reply='Personal-health access was turned off. I have withheld the personal-data response.', safety_status='response_withheld')
                health_used = False
            self.memory.save_conversation_context(astronaut, session_id, request.message, response.model_dump(mode='json'),
                request.request_id, fingerprint, health_used, request.self_reported_mood, context['consent']['save_conversations'])
            return response

    def _base(self, session_id, **kwargs):
        return ChatResponse(session_id=session_id, message_id=str(uuid4()), intent=kwargs.pop('intent', 'unknown'),
                            mood_assessment=kwargs.pop('mood_assessment', MoodAssessment()), **kwargs)

    def _answer(self, astronaut, request, context, urgent):
        sid = context['session_id']
        if urgent:
            return self._base(sid, intent='urgent_support', reply=urgent_reply(request.reply_mode == 'watch'), safety_status='urgent',
                limitations=['No human contact integration is configured; no message was sent.']), False
        consent = self.memory.consent(astronaut)
        payload = {'message':request.message, 'recent_messages':context['recent_messages'][-8:],
                   'self_reported_mood':request.self_reported_mood, 'reply_mode':request.reply_mode}
        try:
            classification = Classification.model_validate(self.model.classify(payload))
        except Exception:
            return self._base(sid, reply='The local Med Bot model is unavailable or returned invalid data. Please try again; seek human medical support for an urgent concern.',
                              safety_status='service_unavailable'), False
        mood = MoodAssessment(label=request.self_reported_mood or classification.mood,
            source='self_report' if request.self_reported_mood else 'message_inference',
            confidence='high' if request.self_reported_mood else 'low' if classification.confidence == 'high' else classification.confidence,
            user_confirmed=request.self_reported_mood is not None)
        if classification.urgent or classification.intent == 'urgent_support':
            return self._base(sid, intent='urgent_support', mood_assessment=mood, reply=urgent_reply(request.reply_mode == 'watch'),
                              safety_status='urgent'), False
        if medication_question(request.message):
            return self._base(sid, intent=classification.intent, mood_assessment=mood, forward=True,
                reply='I can help explain recorded information, but I cannot recommend starting, stopping, changing, or dosing medication. This is one for the flight surgeon.'), False
        limitations, sources, actions, facts = [], [], [], []
        personal, health_used, assessment_id = {}, False, None
        personal_intent = classification.intent in ('personal_health_question', 'health_data_explanation', 'medical_and_emotional')
        wants_personal = (personal_intent and (classification.needs_health or classification.needs_recommendations)) or request.formal_assessment
        if wants_personal and not consent.personal_health:
            limitations.append('Personal health access is off. No health records were retrieved.')
        if wants_personal and consent.personal_health:
            health_used = True
            personal = self.tools.get_health_history(astronaut, classification.metrics or None)
            if not personal['available']:
                limitations.append(personal['reason'])
            else:
                for f in personal['findings'][:3]:
                    reading = personal['latest'][f.metric]
                    fact = f"Recorded {f.metric.replace('_', ' ')}: {f.current_value:g} {f.unit}, at {reading.timestamp.isoformat()} (source: {reading.source})."
                    if f.deviation is not None:
                        fact += f' Difference from your recorded baseline: {f.deviation:+g} {f.unit}.'
                    else:
                        fact += ' No compatible personal baseline is available.'
                    if f.slope_per_day is not None:
                        fact += f' Statistical trend: {f.trend}; not a diagnosis.'
                    facts.append(fact)
                if not personal['findings']:
                    limitations.append('No matching measurements are available.')
                if any(r.escalation_required for r in personal['risks']):
                    return self._base(sid, intent='urgent_support', mood_assessment=mood, reply=urgent_reply(request.reply_mode == 'watch'),
                        safety_status='urgent', limitations=['An existing configured assessment rule requires human medical review.']), True
        if classification.needs_recommendations and personal_intent and consent.personal_health:
            assessment, existing_sources = self.tools.latest_recommendations(astronaut)
            sources.extend(existing_sources)
            if assessment:
                assessment_id = assessment.assessment_id
                if assessment.escalation_required:
                    return self._base(sid, intent='urgent_support', mood_assessment=mood, reply=urgent_reply(request.reply_mode == 'watch'), safety_status='urgent'), True
                # Explain exact existing recommendations; do not create replacements.
                for r in assessment.recommendations:
                    if r.category not in ('medication', 'supplement'):
                        actions.append(r)
                        facts.append(f'Existing recommendation: {r.title}. {r.reasoning_summary}')
                if not assessment.recommendations:
                    limitations.append('The latest assessment has no eligible recommendations.')
            else:
                limitations.append('No prior assessment is available.')
        if request.formal_assessment:
            if not consent.personal_health:
                limitations.append('A formal assessment requires personal-health access consent.')
            else:
                assessment_result = self.tools.request_assessment(astronaut, request.request_id, personal)
                if assessment_result['status'] == 'completed':
                    assessment = assessment_result['assessment']
                    assessment_id = assessment.assessment_id
                    facts.append('A formal assessment was saved by the existing recommendation service.')
                    if assessment.escalation_required:
                        return self._base(sid, intent='urgent_support', mood_assessment=mood, reply=urgent_reply(request.reply_mode == 'watch'),
                                          safety_status='urgent', assessment_id=assessment_id), True
                else:
                    limitations.append('Formal assessment: ' + assessment_result['status'] + '. No new assessment was confirmed.')
        if classification.needs_support_options and personal.get('available'):
            actions.extend(self.tools.get_approved_support_options(personal))
        if classification.search_terms:
            search = self.tools.search_behavioral_health_knowledge if classification.intent in ('mental_health_support', 'medical_and_emotional') else self.tools.search
            sources.extend(search(classification.search_terms))
        # Only actual retrieved records can become citations or actions.
        sources = list({s.id:s for s in sources}.values())[:8]
        from .models import SuggestedAction
        actions = [a if isinstance(a, SuggestedAction) else SuggestedAction(id=a.recommendation_id, description=a.description, protocol_id=a.protocol_id, status=a.status) for a in actions]
        actions = list({a.id:a for a in actions}.values())[:5]
        medical = classification.intent in ('general_medical_question', 'personal_health_question', 'health_data_explanation', 'medical_and_emotional')
        if medical and not sources:
            limitations.append('No matching source evidence is available for a medical explanation.')
        if any(s.research_only for s in sources):
            limitations.append('Draft research is unreviewed informational context, not approved treatment guidance.')
        mood_history = self.memory.get_mood_history(astronaut)[:5] if consent.mood_history and classification.intent in ('mental_health_support', 'emotional_check_in', 'medical_and_emotional') else []
        try:
            output = GeneratedReply.model_validate(self.model.respond({**payload, 'classification':classification.model_dump(),
                'mood_assessment':mood.model_dump(), 'observations':facts, 'sources':[s.model_dump() for s in sources],
                'actions':[a.model_dump() for a in actions], 'mood_checkins':mood_history, 'limitations':limitations,
                'privacy':'Do not imply a personal-health record was read unless observations were supplied.'}))
            if not set(output.source_ids) <= {s.id for s in sources} or not set(output.action_ids) <= {a.id for a in actions}:
                raise ValueError('Unresolvable generated reference')
            if unsafe_reply(output.reply):
                raise ValueError('Unsafe or unsupported generated content')
        except (ValueError, TypeError):
            return self._base(sid, intent=classification.intent, mood_assessment=mood,
                reply='I could not produce a reliable response from the local model. Please try again, or ask a medical professional about a health concern.',
                safety_status='response_withheld', limitations=limitations, assessment_id=assessment_id), health_used
        except Exception:
            return self._base(sid, intent=classification.intent, mood_assessment=mood,
                reply='The local Med Bot model is unavailable. Please try again; seek human medical support for an urgent concern.',
                safety_status='service_unavailable', limitations=limitations, assessment_id=assessment_id), health_used
        # Facts and source excerpts are server-rendered; free model text only supplies
        # the conversational bridge. No generated numbers or invented links survive.
        reply = output.reply
        if medical and not facts and not sources:
            reply = 'I do not have enough recorded data or source evidence to answer that medical question reliably.'
        if wants_personal and not consent.personal_health:
            reply += ' You can enable personal-health access if you want me to review your saved measurements.'
        if request.reply_mode != 'watch':
            if facts:
                reply += ' ' + ' '.join(facts[:3])
            if medical and sources:
                s = sources[0]
                excerpt = s.excerpt
                # Never echo research medication dosages as user-facing advice.
                if not re.search(r'\b\d+(?:\.\d+)?\s*(?:mg|mcg|tablets?|capsules?)\b', excerpt, re.I):
                    label = 'Unreviewed research excerpt' if s.research_only else 'Recorded source excerpt'
                    reply += f' {label}: "{excerpt[:600]}"'
        else:
            # Enforce tiny-screen size after all postprocessing.
            if personal.get('latest'):
                reading = next(iter(personal['latest'].values()))
                reply = f'Recorded {reading.metric.replace("_", " ")}: {reading.value:g} {reading.unit} (source: {reading.source}). This observation does not establish a cause.'
            reply = ' '.join(reply.split()[:30])
            reply = ' '.join(re.split(r'(?<=[.!?])\s+', reply)[:2])
        selected_actions = [a for a in actions if a.id in output.action_ids]
        return self._base(sid, intent=classification.intent, mood_assessment=mood, reply=reply, sources=sources,
            suggested_actions=selected_actions, forward=output.forward, limitations=limitations, assessment_id=assessment_id), health_used

    def request_crew_support(self, astronaut, request):
        if request.session_id:
            self.memory.get_conversation_context(astronaut, request.session_id)
        return request_crew_support(request)
