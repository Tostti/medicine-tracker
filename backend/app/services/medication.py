from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Drug, Existence, Medication, MedicationDrug
from app.schemas.medication import MedicationCreate


def get_medications(
    db: Session,
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

    if drug:
        stmt = stmt.where(
            Medication.drugs.any(MedicationDrug.drug.has(Drug.name.ilike(f"%{drug}%")))
        )

    if function:
        stmt = stmt.where(Medication.function.ilike(f"%{function}%"))

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


def create_medication(db: Session, payload: MedicationCreate) -> Medication:
    data = payload.model_dump(exclude={"drugs"})
    db_item = Medication(**data)
    db_item.drugs = [
        MedicationDrug(drug_id=d.drug_id, dose=d.dose) for d in payload.drugs
    ]
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
