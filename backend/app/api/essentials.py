from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.essential import EssentialCreate, EssentialDetail, EssentialRead
from app.services import drug as drug_service
from app.services import essential as essential_service

router = APIRouter(
    prefix="/essentials",
    tags=["essentials"],
)


@router.get("/", response_model=list[EssentialDetail], status_code=status.HTTP_200_OK)
def list_essentials(db: Session = Depends(get_db)):
    return essential_service.get_essentials(db)


@router.post("/", response_model=EssentialRead, status_code=status.HTTP_201_CREATED)
def create_essential(payload: EssentialCreate, db: Session = Depends(get_db)):
    try:
        return essential_service.create_essential(db, payload)
    except drug_service.InvalidCompositionError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(e)
        )
    except essential_service.DuplicateEssentialError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


@router.delete("/{essential_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_essential(essential_id: int, db: Session = Depends(get_db)):
    essential = essential_service.get_essential(db, essential_id)
    if essential is None:
        raise HTTPException(status_code=404, detail="Essential not found")
    essential_service.delete_essential(db, essential)
