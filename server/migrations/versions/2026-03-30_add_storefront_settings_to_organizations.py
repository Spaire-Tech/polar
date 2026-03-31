"""Add storefront_settings to organizations

Revision ID: a1b2c3d4e5f6
Revises: f4a2b9c1d3e5
Create Date: 2026-03-30 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
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
                f"'{sa.inspect(DEFAULT_STOREFRONT_SETTINGS)}'::jsonb"
                if False
                else "'{}'::jsonb"
            ),
        ),
    )

    # Migrate existing profile_settings.enabled to storefront_settings.enabled
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
