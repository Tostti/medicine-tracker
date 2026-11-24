from pydantic import BaseModel, ConfigDict, field_validator


class DrugBase(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be empty")
        return v


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
