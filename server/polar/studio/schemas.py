from typing import Literal

from pydantic import Field

from polar.kit.schemas import Schema
from polar.organization.schemas import OrganizationID


class WorkbookGenerateRequest(Schema):
    """Brief for generating an AI-authored workbook.

    The creator describes the digital product they want Spaire Studio to
    draft. Studio streams back a complete, well-structured Markdown
    manuscript ready to be reviewed, edited, and published as a Spaire
    product.
    """

    organization_id: OrganizationID = Field(
        description="The organization that will own the generated workbook."
    )
    topic: str = Field(
        min_length=3,
        max_length=200,
        description=(
            "Core topic or transformation the workbook delivers. "
            'e.g. "Morning routines for remote founders".'
        ),
    )
    audience: str = Field(
        min_length=3,
        max_length=200,
        description=(
            'Who this workbook is for. e.g. "First-time SaaS founders in year 1".'
        ),
    )
    outcome: str = Field(
        min_length=3,
        max_length=300,
        description=(
            "The transformation the reader gets by completing the workbook. "
            'e.g. "A repeatable 30-day launch plan with daily checklists".'
        ),
    )
    tone: Literal["warm", "direct", "playful", "clinical"] = Field(
        default="warm",
        description="Voice and tone of the manuscript.",
    )
    length: Literal["short", "standard", "deep"] = Field(
        default="standard",
        description=(
            "Approximate depth: short (~8 pages), standard (~16 pages), "
            "deep (~32 pages)."
        ),
    )
