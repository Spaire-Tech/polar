from typing import Annotated

from pydantic import UUID4, Field, StringConstraints

from polar.kit.schemas import HttpUrlToStr, IDSchema, Schema, TimestampedSchema

LabelInput = Annotated[str, StringConstraints(min_length=1, max_length=80)]
IconInput = Annotated[str, StringConstraints(min_length=1, max_length=40)]


class OrganizationLinkBase(Schema):
    label: str = Field(description="Link label displayed as the button text.")
    url: str = Field(description="Target URL.")
    icon: str | None = Field(
        default=None,
        description="Optional icon identifier (e.g. 'link', 'calendar', 'email').",
    )
    order: int = Field(description="Sort order (ascending).")
    enabled: bool = Field(description="Whether the link is visible on the storefront.")


class OrganizationLink(TimestampedSchema, IDSchema, OrganizationLinkBase):
    id: UUID4
    organization_id: UUID4


class OrganizationLinkCreate(Schema):
    organization_id: UUID4 = Field(description="Organization that owns the link.")
    label: LabelInput = Field(description="Link label displayed as the button text.")
    url: HttpUrlToStr = Field(description="Target URL.")
    icon: IconInput | None = None
    order: int | None = Field(
        default=None,
        description="Sort order. Defaults to the end of the list if omitted.",
    )
    enabled: bool = True


class OrganizationLinkUpdate(Schema):
    label: LabelInput | None = None
    url: HttpUrlToStr | None = None
    icon: IconInput | None = None
    order: int | None = None
    enabled: bool | None = None


class OrganizationLinkReorder(Schema):
    organization_id: UUID4
    ids: list[UUID4] = Field(
        description="IDs in the desired display order (first = top)."
    )


class OrganizationLinkPublic(Schema):
    """Public read schema surfaced on unauthenticated storefront pages."""

    id: UUID4
    label: str
    url: str
    icon: str | None = None
