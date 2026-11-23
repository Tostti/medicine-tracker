from pydantic import BaseModel, ConfigDict


class DrugBase(BaseModel):
    name: str


class DrugRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class DrugCreate(DrugBase):
    pass


class MedicationDrugRead(BaseModel):
    """A drug inside a medication, with its dose (the association object)."""

    model_config = ConfigDict(from_attributes=True)

    dose: str
    drug: DrugRead


class MedicationDrugCreate(BaseModel):
    drug_id: int
    dose: str
