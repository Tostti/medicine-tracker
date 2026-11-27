"""add essentials: what to always keep at home, by composition instead of by brand

Revision ID: c4e8a1d2f5b7
Revises: 77fb5b607bd3
Create Date: 2026-11-27 13:00:00.000000

Every medication marked common_use becomes the essential for its composition, and
brands with the same composition share one. common_use itself is left untouched, so
downgrading loses nothing; a later migration drops it.
"""

import logging
from collections import defaultdict
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# Imported, not copied: if the normalization changes later, a new migration must
# recompute every dose_key anyway, and both should use the same code.
from app.services.dose import dose_key

# revision identifiers, used by Alembic.
revision: str = "c4e8a1d2f5b7"
down_revision: Union[str, Sequence[str], None] = "77fb5b607bd3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

logger = logging.getLogger("alembic.runtime.migration")

# Snapshots of the tables as of this migration (the models may change later).
medications = sa.table(
    "medications",
    sa.column("id", sa.Integer),
    sa.column("commercial_name", sa.String),
    sa.column("common_use", sa.Boolean),
)
medication_drugs = sa.table(
    "medication_drugs",
    sa.column("medication_id", sa.Integer),
    sa.column("drug_id", sa.Integer),
    sa.column("dose", sa.String),
    sa.column("dose_key", sa.String),
)
essentials = sa.table("essentials", sa.column("id", sa.Integer))
essential_drugs = sa.table(
    "essential_drugs",
    sa.column("essential_id", sa.Integer),
    sa.column("drug_id", sa.Integer),
    sa.column("dose", sa.String),
    sa.column("dose_key", sa.String),
)


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Every existing dose gets its comparable key.
    op.add_column("medication_drugs", sa.Column("dose_key", sa.String(), nullable=True))
    rows = conn.execute(
        sa.select(
            medication_drugs.c.medication_id,
            medication_drugs.c.drug_id,
            medication_drugs.c.dose,
        )
    ).all()
    for medication_id, drug_id, dose in rows:
        conn.execute(
            medication_drugs.update()
            .where(
                medication_drugs.c.medication_id == medication_id,
                medication_drugs.c.drug_id == drug_id,
            )
            .values(dose_key=dose_key(dose))
        )
    op.alter_column("medication_drugs", "dose_key", nullable=False)

    # 2. The new tables.
    op.create_table(
        "essentials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "essential_drugs",
        sa.Column("essential_id", sa.Integer(), nullable=False),
        sa.Column("drug_id", sa.Integer(), nullable=False),
        sa.Column("dose", sa.String(), nullable=False),
        sa.Column("dose_key", sa.String(), nullable=False),
        sa.ForeignKeyConstraint(["drug_id"], ["drugs.id"]),
        sa.ForeignKeyConstraint(
            ["essential_id"], ["essentials.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("essential_id", "drug_id"),
    )

    # 3. Common-use medications -> essentials, one per distinct composition.
    common = conn.execute(
        sa.select(
            medications.c.id,
            medications.c.commercial_name,
            medication_drugs.c.drug_id,
            medication_drugs.c.dose,
        )
        .select_from(medications)
        .outerjoin(
            medication_drugs, medication_drugs.c.medication_id == medications.c.id
        )
        .where(medications.c.common_use.is_(True))
        .order_by(medications.c.id)
    ).all()

    compositions: dict[int, list[tuple[int, str]]] = defaultdict(list)
    names: dict[int, str] = {}
    for medication_id, name, drug_id, dose in common:
        names[medication_id] = name
        if drug_id is not None:
            compositions[medication_id].append((drug_id, dose))

    created: dict[frozenset, int] = {}
    for medication_id, name in names.items():
        drugs = compositions.get(medication_id)
        if not drugs:
            logger.warning(
                "Medication %s (%r) is common use but has no drugs: no essential "
                "created for it. Add its drugs, then mark it as essential.",
                medication_id,
                name,
            )
            continue

        signature = frozenset((drug_id, dose_key(dose)) for drug_id, dose in drugs)
        if signature in created:
            logger.info(
                "Medication %s (%r) -> existing essential %s",
                medication_id,
                name,
                created[signature],
            )
            continue

        essential_id = conn.execute(
            essentials.insert().values().returning(essentials.c.id)
        ).scalar_one()
        conn.execute(
            essential_drugs.insert(),
            [
                {
                    "essential_id": essential_id,
                    "drug_id": drug_id,
                    "dose": dose,
                    "dose_key": dose_key(dose),
                }
                for drug_id, dose in drugs
            ],
        )
        created[signature] = essential_id
        logger.info(
            "Medication %s (%r) -> new essential %s", medication_id, name, essential_id
        )

    logger.info(
        "Created %d essentials from %d common-use medications", len(created), len(names)
    )


def downgrade() -> None:
    # common_use was never changed, so dropping the new tables restores the old state.
    op.drop_table("essential_drugs")
    op.drop_table("essentials")
    op.drop_column("medication_drugs", "dose_key")
