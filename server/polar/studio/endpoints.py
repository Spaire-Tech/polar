from collections.abc import AsyncIterator

from fastapi import Body, Depends
from sse_starlette.sse import EventSourceResponse

from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import WorkbookGenerateRequest
from .service import studio as studio_service

router = APIRouter(prefix="/studio", tags=["studio", APITag.private])


@router.post(
    "/workbook/generate",
    summary="Generate Workbook",
    description=(
        "Stream a Markdown workbook manuscript authored by Spaire Studio. "
        "Responds as Server-Sent Events with `start`, `delta`, `done`, and "
        "`error` event types."
    ),
    responses={
        200: {
            "description": "SSE stream of workbook Markdown chunks.",
            "content": {"text/event-stream": {}},
        }
    },
)
async def generate_workbook(
    auth_subject: auth.StudioWrite,
    workbook: WorkbookGenerateRequest = Body(...),
    session: AsyncSession = Depends(get_db_session),
) -> EventSourceResponse:
    """Stream a generated workbook manuscript as SSE."""

    async def event_stream() -> AsyncIterator[dict[str, object]]:
        async for event in studio_service.stream_workbook(
            session, auth_subject, workbook
        ):
            # sse-starlette expects {"event": name, "data": "<str>"} — we
            # json-stringify the payload to keep the client side trivial.
            yield {
                "event": event["event"],
                "data": studio_service.format_sse_data(event.get("data", {})),
            }

    return EventSourceResponse(event_stream())
