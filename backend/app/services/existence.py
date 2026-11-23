from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Existence
from app.schemas.existence import ExistenceCreate, ExistenceUpdate


def get_medication_existences(
    db: Session,
    medication_id: int,
    skip: int = 0,
    limit: int = 100,
) -> Sequence[Existence]:
    stmt = (
        select(Existence)
        .where(Existence.medication_id == medication_id)
        .order_by(Existence.due_date)
        .offset(skip)
        .limit(limit)
    )
    return db.scalars(stmt).all()


def add_existence(db: Session, medication_id, payload: ExistenceCreate) -> Existence:
    data = payload.model_dump()
    db_item = Existence(medication_id=medication_id, **data)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def get_existence(db: Session, existence_id: int) -> Existence | None:
    return db.get(Existence, existence_id)


def delete_existence(db: Session, existence: Existence) -> None:
    db.delete(existence)
    db.commit()


def edit_existence(
    db: Session,
    existence: Existence,
    payload: ExistenceUpdate,
) -> Existence:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(existence, field, value)
    db.commit()
    db.refresh(existence)
    return existence
