import hmac
import json
import os
from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI, Depends, Header, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from .adapters import HealthTools, REPO
from .agent import MedBot
from .memory import ConversationStore, SessionNotFound
from .models import ChatRequest, ChatResponse, ConsentUpdate, MoodCheckin, SupportRequest, LegacyChatRequest


def create_app(bot=None, tokens=None):
    if bot is None:
        from health_agent.knowledge import KnowledgeTools, DB_LAYER
        governance_file = os.getenv('HEALTH_GOVERNANCE_FILE')
        governance = json.loads(Path(governance_file).read_text(encoding='utf-8')) if governance_file else None
        mode = os.getenv('HEALTH_KNOWLEDGE_MODE', 'draft')
        if mode not in ('draft', 'approved'):
            raise ValueError('HEALTH_KNOWLEDGE_MODE must be draft or approved')
        bot = MedBot(ConversationStore(os.getenv('MEDBOT_DB_PATH', str(Path(__file__).resolve().parents[1]/'data/medbot.sqlite3'))),
            HealthTools(health_path=os.getenv('HEALTH_DB_PATH'), knowledge=KnowledgeTools(DB_LAYER/'DB'/mode, governance),
                        assessment_url=os.getenv('MEDBOT_ASSESSMENT_URL'), assessment_token=os.getenv('MEDBOT_ASSESSMENT_TOKEN')))
    tokens = tokens if tokens is not None else json.loads(os.getenv('HEALTH_API_TOKENS', '{}'))
    if not isinstance(tokens, dict) or any(not isinstance(k, str) or not isinstance(v, list) or any(not isinstance(i, str) for i in v) for k,v in tokens.items()):
        raise ValueError('HEALTH_API_TOKENS must map server-side tokens to lists of astronaut IDs')
    app = FastAPI(title='Orbital Health Med Bot', version='0.1.0')
    app.state.bot = bot

    def identity(authorization: str | None = Header(default=None)):
        if not authorization or not authorization.startswith('Bearer ') or not authorization[7:]:
            raise HTTPException(401, 'Bearer authentication required')
        for expected, identities in tokens.items():
            if hmac.compare_digest(authorization[7:].encode(), expected.encode()):
                if len(identities) != 1 or not identities[0]:
                    raise HTTPException(403, 'Med Bot requires credentials identifying exactly one astronaut')
                return identities[0]
        raise HTTPException(401, 'Invalid credentials')

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, error):
        # FastAPI's default errors include rejected input, which may contain private disclosures.
        return JSONResponse(status_code=422, content={'detail': [{'loc': list(e['loc']), 'type': e['type'], 'msg': e['msg']} for e in error.errors()]})

    @app.exception_handler(PermissionError)
    async def denied(request, error):
        return JSONResponse(status_code=403, content={'detail':'Access or required consent denied'})

    @app.exception_handler(SessionNotFound)
    async def missing_session(request, error):
        return JSONResponse(status_code=404, content={'detail':'Session missing or expired'})

    @app.exception_handler(ValueError)
    async def invalid_operation(request, error):
        return JSONResponse(status_code=409, content={'detail':'Request conflicts with saved state or contains an invalid timestamp'})

    @app.middleware('http')
    async def private_responses(request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Pragma'] = 'no-cache'
        return response

    @app.post('/api/medbot/chat', response_model=ChatResponse)
    def chat(body: ChatRequest, response: Response, astronaut=Depends(identity)):
        result = bot.chat(astronaut, body)
        if result.safety_status == 'service_unavailable':
            response.status_code = 503
        return result

    @app.get('/api/medbot/sessions/{session_id}')
    def session(session_id: str, astronaut=Depends(identity)):
        return bot.memory.get_conversation_context(astronaut, session_id, limit=50)

    @app.delete('/api/medbot/sessions/{session_id}')
    def delete_session(session_id: str, astronaut=Depends(identity)):
        bot.memory.delete_session(astronaut, session_id)
        return {'deleted':True}

    @app.get('/api/medbot/consent')
    def consent(astronaut=Depends(identity)):
        return bot.memory.consent(astronaut)

    @app.patch('/api/medbot/consent')
    def update_consent(body: ConsentUpdate, astronaut=Depends(identity)):
        return bot.memory.update_consent(astronaut, body)

    @app.post('/api/medbot/mood-checkin')
    def checkin(body: MoodCheckin, astronaut=Depends(identity)):
        return bot.memory.record_mood_checkin(astronaut, body)

    @app.get('/api/medbot/mood-history')
    def mood_history(days: int = Query(default=30, ge=1, le=30), astronaut=Depends(identity)):
        return {'checkins':bot.memory.get_mood_history(astronaut, days)}

    @app.delete('/api/medbot/mood-history')
    def delete_mood_history(astronaut=Depends(identity)):
        bot.memory.delete_mood_history(astronaut)
        return {'deleted':True}

    @app.delete('/api/medbot/data')
    def delete_data(astronaut=Depends(identity)):
        bot.memory.delete_all(astronaut)
        return {'deleted':True, 'consent_reset':True}

    @app.post('/api/medbot/support-request')
    def support(body: SupportRequest, astronaut=Depends(identity)):
        return bot.request_crew_support(astronaut, body)

    @app.post('/api/chat')
    def legacy_chat(body: LegacyChatRequest, request: Request, response: Response, astronaut=Depends(identity)):
        # Existing browser text context is not trusted identity, consent, or a source
        # of clinical facts. Fetch structured records only through authorized tools.
        session_id = request.cookies.get('medbot_session')
        try:
            if session_id:
                bot.memory.get_conversation_context(astronaut, session_id)
        except (SessionNotFound, PermissionError):
            session_id = None
        result = bot.chat(astronaut, ChatRequest(session_id=session_id, request_id=str(uuid4()), message=body.message,
                                               screen_id=body.screenId, reply_mode=body.replyMode))
        response.set_cookie('medbot_session', result.session_id, httponly=True, samesite='strict',
                            secure=os.getenv('MEDBOT_SECURE_COOKIE', '1') == '1', max_age=1800, path='/api/chat')
        if result.safety_status == 'service_unavailable':
            response.status_code = 503
        return {'reply':result.reply, 'urgent':result.safety_status == 'urgent', 'forward':result.forward and result.safety_status != 'urgent'}

    return app
