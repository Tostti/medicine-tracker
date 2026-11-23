from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.medication import MedicationDetail, MedicationCreate
from app.schemas.existence import ExistenceRead, ExistenceCreate
from app.services import (
    medication as medication_service,
    existence as existence_service,
)

router = APIRouter(
    prefix="/medications",
    tags=["medications"],
)


@router.get("/", response_model=list[MedicationDetail], status_code=status.HTTP_200_OK)
def list_medications(
    drug: str | None = None,
    function: str | None = None,
    in_stock: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return medication_service.get_medications(
        db,
        drug=drug,
        function=function,
        in_stock=in_stock,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{medication_id}", response_model=MedicationDetail, status_code=status.HTTP_200_OK
)
def get_medication(
    medication_id: int,
    db: Session = Depends(get_db),
):
    medication = medication_service.get_medication(
        db,
        medication_id,
    )
    if medication is None:
        raise HTTPException(status_code=404, detail="Medication not found")
    return medication


@router.get(
    "/{medication_id}/existences",
    response_model=list[ExistenceRead],
    status_code=status.HTTP_200_OK,
)
def get_medication_existences(
    medication_id: int,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    return existence_service.get_medication_existences(
        db,
        medication_id,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/{medication_id}/existences",
    response_model=ExistenceRead,
    status_code=status.HTTP_201_CREATED,
)
def create_medication_existence(
    payload: ExistenceCreate,
    medication_id: int,
    db: Session = Depends(get_db),
):
    return existence_service.add_existence(db, medication_id, payload)


@router.post("/", response_model=MedicationDetail, status_code=status.HTTP_201_CREATED)
def create_medication(
    payload: MedicationCreate,
    db: Session = Depends(get_db),
):
    return medication_service.create_medication(db, payload)
