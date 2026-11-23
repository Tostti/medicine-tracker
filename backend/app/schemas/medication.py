from pydantic import BaseModel, ConfigDict

from app.schemas.drug import MedicationDrugRead, MedicationDrugCreate
from app.schemas.existence import ExistenceRead


class MedicationBase(BaseModel):
    commercial_name: str
    type: str | None = None
    function: str | None = None
    picture_uri: str | None = None


class MedicationCreate(MedicationBase):
    drugs: list[MedicationDrugCreate]


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
