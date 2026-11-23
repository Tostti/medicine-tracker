from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.drug import DrugRead, DrugCreate
from app.services import drug as drug_service

router = APIRouter(
    prefix="/drugs",
    tags=["drugs"],
)


@router.get("/", response_model=list[DrugRead], status_code=status.HTTP_200_OK)
def list_drugs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return drug_service.get_drugs(
        db,
        skip=skip,
        limit=limit,
    )


@router.get("/{drug_id}", response_model=DrugRead, status_code=status.HTTP_200_OK)
def get_drug(
    drug_id: int,
    db: Session = Depends(get_db),
):
    drug = drug_service.get_drug(
        db,
        drug_id,
    )
    if drug is None:
        raise HTTPException(status_code=404, detail="Drug not found")
    return drug


@router.post("/", response_model=DrugRead, status_code=status.HTTP_201_CREATED)
def create_drug(
    payload: DrugCreate,
    db: Session = Depends(get_db),
):
    return drug_service.add_drug(db, payload.name)
