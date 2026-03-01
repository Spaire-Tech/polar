from fastapi import Depends

from polar.openapi import APITag
from polar.postgres import AsyncReadSession, get_db_read_session
from polar.routing import APIRouter

from . import auth
from .agent import run_intelligence_query
from .schemas import IntelligenceQueryRequest, InsightResponse

router = APIRouter(
    prefix="/intelligence",
    tags=["intelligence", APITag.private],
)


@router.post(
    "/query",
    summary="Query Revenue Intelligence",
    response_model=InsightResponse,
    response_model_exclude_none=True,
)
async def query(
    body: IntelligenceQueryRequest,
    auth_subject: auth.IntelligenceRead,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> InsightResponse:
    """
    Ask a natural language question about your revenue.

    The agent interprets the question, fetches and computes relevant metrics,
    detects anomalies, and returns a structured insight with drivers, actions,
    and full data provenance.
    """
    return await run_intelligence_query(
        session,
        auth_subject,
        organization_id=body.organization_id,
        question=body.question,
        explicit_start=body.start_date,
        explicit_end=body.end_date,
    )
