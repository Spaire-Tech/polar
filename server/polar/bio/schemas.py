from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import UUID4, Field, HttpUrl

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.bio_block import BioBlockType


class BioBlockBase(Schema):
    type: BioBlockType
    order: int = Field(ge=0)
    enabled: bool = True
    settings: dict[str, Any] = Field(default_factory=dict)


class BioBlock(TimestampedSchema, BioBlockBase):
    id: UUID4
    organization_id: UUID4


class BioBlockCreate(BioBlockBase):
    organization_id: UUID4


class BioBlockUpdate(Schema):
    order: int | None = Field(default=None, ge=0)
    enabled: bool | None = None
    settings: dict[str, Any] | None = None


class BioBlockReorder(Schema):
    organization_id: UUID4
    ids: list[UUID4]


class BioSettingsUpdate(Schema):
    enabled: bool | None = None
    display_title: str | None = Field(default=None, max_length=80)
    short_bio: str | None = Field(default=None, max_length=280)
    avatar_shape: Literal["circle", "rounded"] | None = None
    show_powered_by: bool | None = None
    newsletter_enabled: bool | None = None
    newsletter_heading: str | None = Field(default=None, max_length=80)
    newsletter_description: str | None = Field(default=None, max_length=200)


class BioPublicOrganization(Schema):
    id: UUID4
    slug: str
    name: str
    avatar_url: str | None
    socials: list[dict[str, str]]
    bio_settings: dict[str, Any]


class BioPublicPage(Schema):
    organization: BioPublicOrganization
    blocks: list[BioBlock]


# Link item shape used inside a `links` block's settings JSONB:
# settings = { "heading": str | None,
#              "items": [{ "id": str, "label": str, "url": str,
#                          "subtitle": str | None, "logo_url": str | None,
#                          "logo_file_id": UUID | None, "cta": str | None }] }
class BioLinkItem(Schema):
    id: str
    label: str = Field(max_length=80)
    url: HttpUrl
    subtitle: str | None = Field(default=None, max_length=120)
    logo_url: str | None = None
    logo_file_id: UUID | None = None
    cta: str | None = Field(default=None, max_length=20)


# Video block settings:
# { "url": str, "provider": "youtube"|"tiktok"|"vimeo"|"other",
#   "thumbnail_url": str | None, "title": str | None }
VideoProvider = Literal["youtube", "tiktok", "vimeo", "other"]


# Booking block settings (v1 = paste URL only):
# { "url": str, "heading": str | None, "description": str | None }
BookingProvider = Literal["cal", "calendly", "url"]
