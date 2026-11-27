"""drop members and usual_medications (never used by the app)

Revision ID: d9b3f6e1a2c8
Revises: c4e8a1d2f5b7
Create Date: 2026-11-27 13:05:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d9b3f6e1a2c8"
down_revision: Union[str, Sequence[str], None] = "c4e8a1d2f5b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No API ever wrote to them, but stop rather than silently lose rows added by hand.
    conn = op.get_bind()
    for table in ("usual_medications", "members"):
        count = conn.scalar(sa.text(f"SELECT count(*) FROM {table}"))
        if count:
            raise RuntimeError(f"Refusing to drop {table}: it has {count} rows")

    op.drop_table("usual_medications")
    op.drop_table("members")


def downgrade() -> None:
    # Back as they were, empty.
    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_members_name"), "members", ["name"], unique=False)
    op.create_table(
        "usual_medications",
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("medication_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["medication_id"], ["medications.id"]),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"]),
        sa.PrimaryKeyConstraint("member_id", "medication_id"),
    )
    op.create_index(
        op.f("ix_usual_medications_medication_id"),
        "usual_medications",
        ["medication_id"],
        unique=False,
    )
