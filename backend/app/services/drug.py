from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
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


def add_drug(db: Session, name: str) -> Drug:
    db_item = Drug(name=name)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item
