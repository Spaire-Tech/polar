from datetime import datetime

from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


class EmailBroadcastCreate(Schema):
    subject: str = Field(description="Email subject line", max_length=255)
    sender_name: str = Field(description="Sender display name", max_length=100)
    reply_to_email: str | None = Field(default=None, description="Reply-to email address")
    content_json: dict | None = Field(default=None, description="Structured editor content")
    content_html: str | None = Field(default=None, description="HTML content for sending")
    segment_id: UUID4 | None = Field(default=None, description="Target segment ID")


class EmailBroadcastUpdate(Schema):
    subject: str | None = None
    sender_name: str | None = None
    reply_to_email: str | None = None
    content_json: dict | None = None
    content_html: str | None = None
    segment_id: UUID4 | None = None


class EmailBroadcast(TimestampedSchema, IDSchema):
    id: UUID4
    organization_id: UUID4
    subject: str
    sender_name: str
    sender_email: str
    reply_to_email: str | None = None
    content_json: dict | None = None
    content_html: str | None = None
    segment_id: UUID4 | None = None
    status: str
    scheduled_at: datetime | None = None
    sent_at: datetime | None = None
    total_recipients: int = 0


class EmailBroadcastAnalytics(Schema):
    total_recipients: int = 0
    sent: int = 0
    delivered: int = 0
    opened: int = 0
    clicked: int = 0
    bounced: int = 0
    unsubscribed: int = 0
    open_rate: float = 0.0
    click_rate: float = 0.0
