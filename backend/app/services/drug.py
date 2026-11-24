from collections.abc import Sequence
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Drug, Existence, Medication, MedicationDrug


def get_drugs(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> Sequence[Drug]:
    stmt = select(Drug).order_by(Drug.name).offset(skip).limit(limit)
    return db.scalars(stmt).all()


def get_drug(db: Session, drug_id: int) -> Drug | None:
    return db.get(Drug, drug_id)


def get_drug_by_name(db: Session, name: str) -> Drug | None:
    stmt = select(Drug).where(func.lower(Drug.name) == name.strip().lower())
    return db.scalars(stmt).one_or_none()


def get_or_create_drug(db: Session, name: str) -> Drug:
    """Return the drug with this name (case-insensitive), creating it if needed.

    Doesn't commit: the caller decides when the transaction ends, so a drug
    created while adding a medication is saved together with it or not at all.
    """
    drug = get_drug_by_name(db, name)
    if drug is None:
        drug = Drug(name=name.strip())
        db.add(drug)
        db.flush()  # assigns drug.id without committing
    return drug


def add_drug(db: Session, name: str) -> Drug:
    drug = get_or_create_drug(db, name)
    db.commit()
    db.refresh(drug)
    return drug
