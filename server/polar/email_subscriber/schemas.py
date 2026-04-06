from datetime import datetime

from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


class EmailSubscriberCreate(Schema):
    email: str = Field(description="Subscriber email address", max_length=320)
    name: str | None = Field(default=None, description="Subscriber name", max_length=256)


class EmailSubscriberUpdate(Schema):
    name: str | None = None
    status: str | None = Field(
        default=None, description="Subscriber status: active, unsubscribed, archived"
    )


class EmailSubscriber(TimestampedSchema, IDSchema):
    id: UUID4
    organization_id: UUID4
    email: str
    name: str | None = None
    status: str
    source: str
    import_source: str | None = None
    customer_id: UUID4 | None = None
    email_verified_at: datetime | None = None
    unsubscribed_at: datetime | None = None


class EmailSubscriberStats(Schema):
    total: int = 0
    active: int = 0
    unsubscribed: int = 0
    archived: int = 0
    invalid: int = 0


class StorefrontSubscribe(Schema):
    """Public schema for Space card subscribe."""

    email: str = Field(description="Email address to subscribe", max_length=320)
    name: str | None = Field(default=None, description="Optional name", max_length=256)
