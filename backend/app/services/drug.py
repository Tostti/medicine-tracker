from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Drug
from app.schemas.drug import MedicationDrugCreate


class InvalidCompositionError(ValueError):
    """A list of drugs refers to a missing drug, or lists one twice."""


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


def resolve_composition(
    db: Session, drugs: list[MedicationDrugCreate]
) -> list[tuple[Drug, str]]:
    """Turn drugs given by id or by name into (drug, dose) pairs.

    Shared by medications and essentials. Doesn't commit: drugs created by name are
    only flushed, so the caller's transaction saves them with the rest or not at all.
    """
    result: list[tuple[Drug, str]] = []
    seen_drug_ids: set[int] = set()
    for d in drugs:
        if d.drug_id is not None:
            drug = get_drug(db, d.drug_id)
            if drug is None:
                raise InvalidCompositionError(f"Drug {d.drug_id} not found")
        else:
            drug = get_or_create_drug(db, d.name)

        # A drug can only appear once (it's part of the primary key).
        if drug.id in seen_drug_ids:
            raise InvalidCompositionError(f"Drug '{drug.name}' is listed twice")
        seen_drug_ids.add(drug.id)

        result.append((drug, d.dose))
    return result
