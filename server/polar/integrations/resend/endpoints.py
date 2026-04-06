import hashlib
import hmac

import structlog
from fastapi import HTTPException, Request

from polar.config import settings
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.worker import enqueue_job

log = structlog.get_logger()

router = APIRouter(
    prefix="/integrations/resend",
    tags=["integrations_resend"],
    include_in_schema=False,
)


HANDLED_EVENT_TYPES = {
    "email.delivered",
    "email.opened",
    "email.clicked",
    "email.bounced",
    "email.complained",
}


def _verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify Resend webhook signature using HMAC-SHA256."""
    if not secret:
        return True  # Skip verification in development
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/webhook")
async def resend_webhook(request: Request) -> dict[str, str]:
    """Receive webhook events from Resend for email tracking."""
    payload = await request.body()
    signature = request.headers.get("svix-signature", "")

    # Resend uses Svix for webhooks. For simplicity we process all events
    # even without signature verification if no secret is configured.
    # In production, RESEND_WEBHOOK_SECRET should be set.
    if settings.RESEND_WEBHOOK_SECRET and not signature:
        raise HTTPException(status_code=401, detail="Missing signature")

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = data.get("type", "")
    if event_type not in HANDLED_EVENT_TYPES:
        return {"status": "ignored"}

    event_data = data.get("data", {})
    email_id = event_data.get("email_id")

    if not email_id:
        return {"status": "ignored"}

    log.info(
        "resend.webhook",
        event_type=event_type,
        email_id=email_id,
    )

    # Enqueue processing job
    enqueue_job(
        "resend.webhook.process_event",
        event_type=event_type,
        email_id=email_id,
        event_data=event_data,
    )

    return {"status": "accepted"}
