import hmac
import json
import os
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, Header, Query
from .models import AssessmentRequest, Assessment
from .agent import PreventiveHealthAgent
from .knowledge import KnowledgeTools
from .storage import HealthStore

def create_app(agent=None, tokens=None):
    if agent is None:
        governance_path = os.getenv('HEALTH_GOVERNANCE_FILE')
        governance = json.loads(Path(governance_path).read_text()) if governance_path else None
        agent = PreventiveHealthAgent(HealthStore(os.getenv('HEALTH_DB_PATH', str(Path(__file__).resolve().parents[1] / 'data' / 'health.sqlite3'))), KnowledgeTools(governance=governance))
    tokens = tokens if tokens is not None else json.loads(os.getenv('HEALTH_API_TOKENS', '{}'))
    app = FastAPI(title='Orbital Health Recommendation Agent', version='0.1.0')

    def access(authorization: str | None = Header(default=None)):
        if not authorization or not authorization.startswith('Bearer '):
            raise HTTPException(401, 'Bearer authentication required')
        token = authorization[7:]
        if not token:
            raise HTTPException(401, 'Invalid credentials')
        for expected, astronaut_ids in tokens.items():
            if hmac.compare_digest(token, expected):
                return set(astronaut_ids)
        raise HTTPException(401, 'Invalid credentials')

    @app.exception_handler(PermissionError)
    async def denied(request, error):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=403, content={'detail': 'Astronaut access denied'})

    @app.post('/api/health/assess', response_model=Assessment)
    def assess(request: AssessmentRequest, allowed=Depends(access)):
        try:
            return agent.assess(request, allowed)
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from exc

    @app.get('/api/astronauts/{astronaut_id}/recommendations', response_model=Assessment)
    def recommendations(astronaut_id: str, allowed=Depends(access)):
        result = agent.store.latest(astronaut_id, allowed)
        if result is None:
            raise HTTPException(404, 'No assessment available')
        return result

    @app.get('/api/recommendations/{recommendation_id}/evidence')
    def evidence(recommendation_id: str, allowed=Depends(access)):
        result = agent.store.recommendation_evidence(recommendation_id, allowed)
        if result is None:
            raise HTTPException(404, 'Recommendation not found')
        return {'evidence': result}

    @app.get('/api/astronauts/{astronaut_id}/health-history')
    def history(astronaut_id: str, days: int = Query(default=30, ge=1, le=3650), metrics: list[str] | None = Query(default=None), allowed=Depends(access)):
        return agent.store.get_health_history(astronaut_id, allowed, metrics, days)

    return app
