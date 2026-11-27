import logging
from collections.abc import Sequence
from datetime import date
from typing import Literal

from sqlalchemy import ColumnElement, delete, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Drug, Existence, Medication, MedicationDrug
from app.schemas.drug import MedicationDrugCreate
from app.schemas.medication import MedicationCreate, MedicationUpdate
from app.services import drug as drug_service
from app.services import essential as essential_service
from app.services import image as image_service
from app.services import storage

logger = logging.getLogger(__name__)


def _contains(column, term: str) -> ColumnElement[bool]:
    """Case- and accent-insensitive "contains": "analgesico" matches "Analgésico".

    Escapes % and _ so they're searched literally instead of acting as wildcards.
    """
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return func.unaccent(column).ilike(func.unaccent(f"%{escaped}%"), escape="\\")


MedicationSort = Literal["id", "name", "newest"]

# A fixed list of orderings, so a request can never put arbitrary SQL in ORDER BY.
# Each ends in a unique column: without one, rows that tie (two "Tafirol") could swap
# places between requests and skip/limit pages would repeat or miss them.
_ORDER_BY: dict[MedicationSort, tuple[ColumnElement, ...]] = {
    "id": (Medication.id,),
    # Like the search: "Álgic" sorts with the A's, and case doesn't matter.
    "name": (func.lower(func.unaccent(Medication.commercial_name)), Medication.id),
    # Ids grow with each insert, so the highest is the most recently added.
    "newest": (Medication.id.desc(),),
}


def get_medications(
    db: Session,
    q: str | None = None,
    drug: str | None = None,
    function: str | None = None,
    in_stock: bool = False,
    essential: bool = False,
    sort: MedicationSort = "id",
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
    if essential:
        stmt = stmt.where(Medication.id.in_(essential_service.covered_medication_ids(db)))
    stmt = stmt.order_by(*_ORDER_BY[sort]).offset(skip).limit(limit)
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


def _medication_drugs(db: Session, drugs: list[MedicationDrugCreate]) -> list[MedicationDrug]:
    return [
        MedicationDrug(drug=drug, dose=dose)
        for drug, dose in drug_service.resolve_composition(db, drugs)
    ]


def create_medication(db: Session, payload: MedicationCreate) -> Medication:
    """Create a medication with its drugs (new or existing) and first existences.

    Everything happens in one transaction: if any part fails, nothing is saved,
    so an abandoned or invalid form never leaves orphan drugs behind.
    """
    try:
        db_item = Medication(**payload.model_dump(exclude={"drugs", "existences"}))

        db_item.drugs = _medication_drugs(db, payload.drugs)
        db_item.existences = [Existence(**e.model_dump()) for e in payload.existences]

        db.add(db_item)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(db_item)
    return db_item


def set_picture(db: Session, medication: Medication, data: bytes) -> Medication:
    """Upload a new picture and replace the old one, deleting it if it was ours."""
    old = medication.picture_uri
    medication.picture_uri = image_service.store_image(data)
    db.commit()
    db.refresh(medication)

    # After the commit, so a failure here never loses the new picture.
    if old and image_service.is_image_key(old):
        try:
            storage.delete_object(old)
        except Exception:
            logger.warning("Couldn't delete old picture %s", old, exc_info=True)
    return medication

def edit_medication(
    db: Session,
    medication: Medication,
    payload: MedicationUpdate,
) -> Medication:
    """Update the fields that were sent. `drugs`, if sent, replaces the whole list."""
    try:
        for field, value in payload.model_dump(exclude_unset=True, exclude={"drugs"}).items():
            setattr(medication, field, value)

        if "drugs" in payload.model_fields_set:
            new_drugs = _medication_drugs(db, payload.drugs)
            # Delete the old rows first: a drug that stays keeps the same primary key
            # (drug_id, medication_id), so it's removed and inserted again with its new dose.
            db.execute(delete(MedicationDrug).where(MedicationDrug.medication_id == medication.id))
            db.expire(medication, ["drugs"])
            medication.drugs.extend(new_drugs)

        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(medication)
    return medication