from collections.abc import Sequence
from datetime import date

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Drug, Existence, Medication, MedicationDrug
from app.schemas.medication import MedicationCreate
from app.services import drug as drug_service


def _contains(column, term: str) -> ColumnElement[bool]:
    """Case- and accent-insensitive "contains": "analgesico" matches "Analgésico".

    Escapes % and _ so they're searched literally instead of acting as wildcards.
    """
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return func.unaccent(column).ilike(func.unaccent(f"%{escaped}%"), escape="\\")


def get_medications(
    db: Session,
    q: str | None = None,
    drug: str | None = None,
    function: str | None = None,
    in_stock: bool = False,
    skip: int = 0,
    limit: int = 100,
) -> Sequence[Medication]:
    stmt = select(Medication).options(
        selectinload(Medication.drugs).selectinload(MedicationDrug.drug),
        selectinload(Medication.existences),
    )

    if q:
        stmt = stmt.where(
            or_(
                _contains(Medication.commercial_name, q),
                _contains(Medication.type, q),
                _contains(Medication.function, q),
                Medication.drugs.any(MedicationDrug.drug.has(_contains(Drug.name, q))),
            )
        )

    if drug:
        stmt = stmt.where(
            Medication.drugs.any(MedicationDrug.drug.has(_contains(Drug.name, drug)))
        )

    if function:
        stmt = stmt.where(_contains(Medication.function, function))

    if in_stock:
        stmt = stmt.where(Medication.existences.any(Existence.due_date >= date.today()))

    stmt = stmt.order_by(Medication.id).offset(skip).limit(limit)
    return db.scalars(stmt).all()


def get_medication(
    db: Session,
    medication_id: int,
) -> Medication | None:
    stmt = (
        select(Medication)
        .options(
            selectinload(Medication.drugs).selectinload(MedicationDrug.drug),
            selectinload(Medication.existences),
        )
        .where(Medication.id == medication_id)
    )
    return db.scalars(stmt).one_or_none()


class InvalidMedicationError(ValueError):
    """The payload refers to something that doesn't exist or doesn't make sense."""


def create_medication(db: Session, payload: MedicationCreate) -> Medication:
    """Create a medication with its drugs (new or existing) and first existences.

    Everything happens in one transaction: if any part fails, nothing is saved,
    so an abandoned or invalid form never leaves orphan drugs behind.
    """
    try:
        db_item = Medication(**payload.model_dump(exclude={"drugs", "existences"}))

        seen_drug_ids: set[int] = set()
        for d in payload.drugs:
            if d.drug_id is not None:
                drug = drug_service.get_drug(db, d.drug_id)
                if drug is None:
                    raise InvalidMedicationError(f"Drug {d.drug_id} not found")
            else:
                drug = drug_service.get_or_create_drug(db, d.name)

            # A drug can only appear once per medication (it's the primary key).
            if drug.id in seen_drug_ids:
                raise InvalidMedicationError(f"Drug '{drug.name}' is listed twice")
            seen_drug_ids.add(drug.id)

            db_item.drugs.append(MedicationDrug(drug=drug, dose=d.dose))

        db_item.existences = [Existence(**e.model_dump()) for e in payload.existences]

        db.add(db_item)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(db_item)
    return db_item
