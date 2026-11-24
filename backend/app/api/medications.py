from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.images import read_upload, storage_errors
from app.db.database import get_db
from app.schemas.medication import MedicationDetail, MedicationCreate, MedicationUpdate
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
    q: str | None = None,
    drug: str | None = None,
    function: str | None = None,
    in_stock: bool = False,
    common_use: bool | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return medication_service.get_medications(
        db,
        q=q,
        common_use=common_use,
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

@router.patch(
    "/{medication_id}", response_model=MedicationDetail, status_code=status.HTTP_200_OK
)
def update_medication(
    payload: MedicationUpdate,
    medication_id: int,
    db: Session = Depends(get_db),
):
    medication = medication_service.get_medication(db, medication_id=medication_id)
    if medication is None:
        raise HTTPException(status_code=404, detail="Medication not found")
    try:
        return medication_service.edit_medication(db, medication, payload)
    except medication_service.InvalidMedicationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(e)
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
    if medication_service.get_medication(db, medication_id) is None:
        raise HTTPException(status_code=404, detail="Medication not found")
    return existence_service.add_existence(db, medication_id, payload)


@router.post("/", response_model=MedicationDetail, status_code=status.HTTP_201_CREATED)
def create_medication(
    payload: MedicationCreate,
    db: Session = Depends(get_db),
):
    try:
        return medication_service.create_medication(db, payload)
    except medication_service.InvalidMedicationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(e)
        )


@router.put(
    "/{medication_id}/picture",
    response_model=MedicationDetail,
    status_code=status.HTTP_200_OK,
)
def set_medication_picture(
    medication_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
):
    medication = medication_service.get_medication(db, medication_id)
    if medication is None:
        raise HTTPException(status_code=404, detail="Medication not found")
    data = read_upload(file)
    with storage_errors():
        return medication_service.set_picture(db, medication, data)
