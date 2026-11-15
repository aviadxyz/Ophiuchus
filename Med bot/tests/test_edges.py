from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
import pytest
from medbot.adapters import HealthTools
from medbot.models import ConsentUpdate, Classification, GeneratedReply, utcnow
from medbot.safety import urgent_language
from test_medbot import setup, message


def test_generation_outage_is_service_unavailable(setup):
    bot, model = setup
    model.respond = lambda *a: (_ for _ in ()).throw(ConnectionError())
    assert bot.chat('DEMO_ASTRONAUT', message()).safety_status == 'service_unavailable'


def test_concurrent_retries_have_one_generation(setup):
    bot, model = setup
    with ThreadPoolExecutor(max_workers=2) as pool:
        first, second = list(pool.map(lambda _:bot.chat('DEMO_ASTRONAUT', message()), range(2)))
    assert first == second
    assert len(model.classify_calls) == 1


def test_saved_initial_retry_survives_restart(setup):
    bot, model = setup
    request = message(consent=ConsentUpdate(save_conversations=True))
    first = bot.chat('DEMO_ASTRONAUT', request)
    from medbot.memory import ConversationStore
    bot.memory = ConversationStore(bot.memory.path)
    assert bot.chat('DEMO_ASTRONAUT', request) == first
    assert len(model.classify_calls) == 1


def test_actual_draft_research_is_labeled():
    tools = HealthTools()
    sources = tools.search(['sleep'])
    assert sources and all(s.research_only for s in sources)
    assert any(s.review_status != 'approved' for s in sources)


@pytest.mark.parametrize('text', ['I might hurt my\u200bself', 'I can’t keep myself safe', 'I am not safe', 'I am thinking of ending my own life'])
def test_additional_crisis_phrasing(text):
    assert urgent_language(text)


def test_existing_red_assessment_escalates_without_generation(setup):
    bot, model = setup
    model.classification = Classification(intent='personal_health_question', needs_recommendations=True)
    previous, sources = bot.tools.latest_recommendations('DEMO_ASTRONAUT')
    previous.escalation_required = True
    bot.tools.latest_recommendations = lambda *a:(previous, sources)
    result = bot.chat('DEMO_ASTRONAUT', message('Explain my assessment', consent=ConsentUpdate(personal_health=True)))
    assert result.safety_status == 'urgent' and not model.respond_calls


def test_health_consent_revoked_during_generation_withholds_records(setup):
    bot, model = setup
    model.classification = Classification(intent='personal_health_question', needs_health=True)
    def revoke(payload):
        bot.memory.update_consent('DEMO_ASTRONAUT', ConsentUpdate(personal_health=False))
        return GeneratedReply(reply='Here are the observations.')
    model.respond = revoke
    result = bot.chat('DEMO_ASTRONAUT', message('Explain my sleep', consent=ConsentUpdate(personal_health=True)))
    assert result.safety_status == 'response_withheld' and '5.8' not in result.reply


def test_successful_formal_assessment_uses_authorized_adapter(setup):
    bot, model = setup
    previous, sources = bot.tools.latest_recommendations('DEMO_ASTRONAUT')
    called = []
    def assess(astronaut, request_id, personal):
        called.append((astronaut, request_id, personal['available']))
        return {'status':'completed', 'assessment':previous}
    bot.tools.request_assessment = assess
    result = bot.chat('DEMO_ASTRONAUT', message('Create an assessment', formal_assessment=True, consent=ConsentUpdate(personal_health=True)))
    assert called == [('DEMO_ASTRONAUT','message-1',True)]
    assert result.assessment_id == previous.assessment_id


def test_assessment_url_rejects_remote_and_credentials():
    with pytest.raises(ValueError):
        HealthTools(assessment_url='https://external.invalid/api/health/assess')
    with pytest.raises(ValueError):
        HealthTools(assessment_url='http://secret@localhost/api/health/assess')


def test_urgent_message_does_not_wait_for_prior_model_call(setup):
    from threading import Event
    bot, model = setup
    session_id = bot.memory.get_conversation_context('DEMO_ASTRONAUT')['session_id']
    started, release = Event(), Event()
    def delayed(payload):
        started.set()
        assert release.wait(timeout=10)
        return GeneratedReply(reply='We can talk about that.')
    model.respond = delayed
    with ThreadPoolExecutor(max_workers=2) as pool:
        normal = pool.submit(bot.chat, 'DEMO_ASTRONAUT', message(session_id=session_id))
        assert started.wait(timeout=5)
        crisis = pool.submit(bot.chat, 'DEMO_ASTRONAUT', message('I might hurt myself', session_id=session_id, request_id='urgent-2'))
        try:
            assert crisis.result(timeout=2).safety_status == 'urgent'
        finally:
            release.set()
        assert normal.result(timeout=5).safety_status == 'urgent'


def test_opt_in_does_not_retroactively_save_unsaved_messages(setup):
    from medbot.memory import ConversationStore
    bot, model = setup
    first = bot.chat('DEMO_ASTRONAUT', message('Earlier unsaved disclosure', self_reported_mood='sad'))
    bot.chat('DEMO_ASTRONAUT', message('Save from now on', request_id='message-2', session_id=first.session_id,
                                     consent=ConsentUpdate(save_conversations=True)))
    restarted = ConversationStore(bot.memory.path)
    context = restarted.get_conversation_context('DEMO_ASTRONAUT', first.session_id)
    assert all(m['content'] != 'Earlier unsaved disclosure' for m in context['recent_messages'])
    assert 'self_reported_mood' not in context['preferences']


def test_mood_retry_without_explicit_timestamp_is_idempotent(setup):
    from medbot.models import MoodCheckin
    bot, model = setup
    bot.memory.update_consent('DEMO_ASTRONAUT', ConsentUpdate(mood_history=True))
    first = bot.memory.record_mood_checkin('DEMO_ASTRONAUT', MoodCheckin(request_id='mood-1', mood='neutral'))
    second = bot.memory.record_mood_checkin('DEMO_ASTRONAUT', MoodCheckin(request_id='mood-1', mood='neutral'))
    assert first == second


def test_reenabling_saving_does_not_resurrect_revoked_content(setup):
    from medbot.memory import ConversationStore
    bot, model = setup
    first = bot.chat('DEMO_ASTRONAUT', message('Formerly saved disclosure', consent=ConsentUpdate(save_conversations=True)))
    bot.memory.update_consent('DEMO_ASTRONAUT', ConsentUpdate(save_conversations=False))
    bot.chat('DEMO_ASTRONAUT', message('Only save this new turn', request_id='message-2', session_id=first.session_id,
                                     consent=ConsentUpdate(save_conversations=True)))
    restarted = ConversationStore(bot.memory.path)
    context = restarted.get_conversation_context('DEMO_ASTRONAUT', first.session_id)
    assert all(m['content'] != 'Formerly saved disclosure' for m in context['recent_messages'])
