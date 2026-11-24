from pydantic import BaseModel, ConfigDict

from app.schemas.drug import MedicationDrugRead, MedicationDrugCreate
from app.schemas.existence import ExistenceCreate, ExistenceRead


class MedicationBase(BaseModel):
    commercial_name: str
    type: str | None = None
    function: str | None = None
    picture_uri: str | None = None


class MedicationCreate(MedicationBase):
    drugs: list[MedicationDrugCreate]
    # Optional first stock, so adding a medication you have in hand is one step.
    existences: list[ExistenceCreate] = []


class MedicationUpdate(BaseModel):
    commercial_name: str | None = None
    type: str | None = None
    function: str | None = None
    picture_uri: str | None = None


class MedicationRead(MedicationBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class MedicationDetail(MedicationRead):
    drugs: list[MedicationDrugRead]
    existences: list[ExistenceRead]
