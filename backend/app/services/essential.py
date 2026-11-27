"""Essentials: compositions to always keep at home, whatever the brand.

A medication covers an essential when it has exactly the same drugs, each with an
equal dose (compared by dose_key, so "1 g" equals "1000 mg"). A combination product
never covers a single-drug essential: "Ibuprofeno 400 + Pseudoefedrina" is not a
substitute for "Ibuprofeno 400 mg".

Matching happens in Python over every row: a household has a few dozen medications,
so loading them all is cheaper than expressing set equality in SQL.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Essential, EssentialDrug, Medication, MedicationDrug
from app.schemas.essential import EssentialCreate
from app.services import drug as drug_service
from app.services.dose import dose_key

Signature = frozenset[tuple[int, str]]


class DuplicateEssentialError(ValueError):
    """There's already an essential with this composition."""


def signature(drugs: Iterable[MedicationDrug | EssentialDrug]) -> Signature:
    """What two compositions must share to match: each drug and its dose."""
    return frozenset((d.drug_id, d.dose_key) for d in drugs)


@dataclass
class EssentialWithMedications:
    """An essential plus the medications that cover it (the shape of EssentialDetail)."""

    id: int
    drugs: list[EssentialDrug]
    medications: list[Medication]


def _composition_label(essential: Essential) -> str:
    return " + ".join(sorted(d.drug.name.lower() for d in essential.drugs))


def get_essentials(db: Session) -> list[EssentialWithMedications]:
    """Every essential, by drug name, each with the medications that cover it."""
    essentials = db.scalars(
        select(Essential).options(
            selectinload(Essential.drugs).selectinload(EssentialDrug.drug)
        )
    ).all()
    medications = db.scalars(
        select(Medication)
        .options(
            selectinload(Medication.drugs).selectinload(MedicationDrug.drug),
            selectinload(Medication.existences),
        )
        .order_by(Medication.commercial_name, Medication.id)
    ).all()

    by_signature: dict[Signature, list[Medication]] = defaultdict(list)
    for m in medications:
        if m.drugs:
            by_signature[signature(m.drugs)].append(m)

    return [
        EssentialWithMedications(
            id=e.id, drugs=e.drugs, medications=by_signature.get(signature(e.drugs), [])
        )
        for e in sorted(essentials, key=_composition_label)
    ]


def get_essential(db: Session, essential_id: int) -> Essential | None:
    return db.get(Essential, essential_id)


def covered_medication_ids(db: Session) -> set[int]:
    """Ids of the medications that cover some essential."""
    wanted = {
        signature(e.drugs)
        for e in db.scalars(select(Essential).options(selectinload(Essential.drugs)))
    }
    drugs_by_medication: dict[int, list[MedicationDrug]] = defaultdict(list)
    for row in db.scalars(select(MedicationDrug)):
        drugs_by_medication[row.medication_id].append(row)
    return {
        medication_id
        for medication_id, drugs in drugs_by_medication.items()
        if signature(drugs) in wanted
    }


def create_essential(db: Session, payload: EssentialCreate) -> Essential:
    """Create an essential, or refuse if one with the same composition exists.

    One transaction: drugs created by name are only saved if the essential is.
    """
    try:
        composition = drug_service.resolve_composition(db, payload.drugs)
        # From the resolved drugs, not essential.drugs: before a flush, an EssentialDrug
        # only has its `drug` relationship set, and its drug_id is still None.
        new = frozenset((drug.id, dose_key(dose)) for drug, dose in composition)
        existing = db.scalars(
            select(Essential).options(selectinload(Essential.drugs))
        ).all()
        if any(signature(e.drugs) == new for e in existing):
            raise DuplicateEssentialError(
                "There's already an essential with these drugs and doses"
            )

        essential = Essential(
            drugs=[EssentialDrug(drug=drug, dose=dose) for drug, dose in composition]
        )
        db.add(essential)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(essential)
    return essential


def delete_essential(db: Session, essential: Essential) -> None:
    db.delete(essential)
    db.commit()
