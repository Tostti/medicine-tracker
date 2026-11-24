from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.existence import ExistenceRead, ExistenceUpdate
from app.services import existence as existence_service

router = APIRouter(
    prefix="/existences",
    tags=["existences"],
)


@router.delete("/{existence_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existence(
    existence_id: int,
    db: Session = Depends(get_db),
):
    existence = existence_service.get_existence(db, existence_id=existence_id)
    if existence is None:
        raise HTTPException(status_code=404, detail="Existence not found")
    existence_service.delete_existence(db, existence)


@router.patch("/{existence_id}", response_model=ExistenceRead, status_code=status.HTTP_200_OK)
def update_existence(
    payload: ExistenceUpdate,
    existence_id: int,
    db: Session = Depends(get_db),
):
    existence = existence_service.get_existence(db, existence_id=existence_id)
    if existence is None:
        raise HTTPException(status_code=404, detail="Existence not found")
    return existence_service.edit_existence(db, existence, payload)
