"""Add storefront_settings to organizations

Revision ID: 7ec79cee1daf
Revises: f4a2b9c1d3e5
Create Date: 2026-03-30 00:00:00.000000

"""

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "7ec79cee1daf"
down_revision = "f4a2b9c1d3e5"
branch_labels = None
depends_on = None

DEFAULT_STOREFRONT_SETTINGS = {
    "enabled": False,
    "show_header": True,
    "header_image_url": None,
    "show_logo": True,
    "show_name": True,
    "show_description": True,
    "description": None,
    "thumbnail_size": "medium",
    "show_product_details": True,
    "accent_color": None,
}


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column(
            "storefront_settings",
            JSONB,
            nullable=False,
            server_default=sa.text(
                f"'{json.dumps(DEFAULT_STOREFRONT_SETTINGS)}'::jsonb"
            ),
        ),
    )

    # Migrate existing profile_settings data to storefront_settings
    op.execute(
        """
        UPDATE organizations
        SET storefront_settings = jsonb_build_object(
            'enabled', COALESCE((profile_settings->>'enabled')::boolean, false),
            'show_header', true,
            'header_image_url', null,
            'show_logo', true,
            'show_name', true,
            'show_description', true,
            'description', profile_settings->>'description',
            'thumbnail_size', 'medium',
            'show_product_details', true,
            'accent_color', profile_settings->>'accent_color'
        )
        """
    )


def downgrade() -> None:
    op.drop_column("organizations", "storefront_settings")
