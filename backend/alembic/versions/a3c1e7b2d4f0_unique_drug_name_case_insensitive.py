"""unique drug name, case-insensitive

Revision ID: a3c1e7b2d4f0
Revises: f98f73ae286d
Create Date: 2026-11-24 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a3c1e7b2d4f0"
down_revision: Union[str, Sequence[str], None] = "f98f73ae286d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Fails if two drugs already differ only by case; merge them first.
    op.create_index(
        "uq_drugs_name_lower",
        "drugs",
        [sa.text("lower(name)")],
        unique=True,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("uq_drugs_name_lower", table_name="drugs")
