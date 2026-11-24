"""enable unaccent extension

Revision ID: b7d2f4a9c1e3
Revises: a3c1e7b2d4f0
Create Date: 2026-11-24 13:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b7d2f4a9c1e3"
down_revision: Union[str, Sequence[str], None] = "a3c1e7b2d4f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Ships with Postgres; used for accent-insensitive search.
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP EXTENSION IF EXISTS unaccent")
