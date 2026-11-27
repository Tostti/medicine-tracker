from pydantic import BaseModel, ConfigDict, Field

from app.schemas.drug import MedicationDrugCreate, MedicationDrugRead
from app.schemas.medication import MedicationDetail


class EssentialCreate(BaseModel):
    # Same shape as a medication's drugs: each one by id or by name, with its dose.
    drugs: list[MedicationDrugCreate] = Field(min_length=1)


class EssentialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    drugs: list[MedicationDrugRead]


class EssentialDetail(EssentialRead):
    # Every medication with exactly this composition: their stock counts for it.
    medications: list[MedicationDetail]
