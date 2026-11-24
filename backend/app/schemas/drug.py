from pydantic import BaseModel, ConfigDict, field_validator, model_validator


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
    """A drug to attach to a new medication.

    Pass `drug_id` for an existing drug, or `name` to reuse a drug with that
    name (case-insensitive) or create it if it doesn't exist yet.
    """

    drug_id: int | None = None
    name: str | None = None
    dose: str

    @model_validator(mode="after")
    def exactly_one_of_id_or_name(self) -> "MedicationDrugCreate":
        if self.name is not None:
            self.name = self.name.strip() or None
        if (self.drug_id is None) == (self.name is None):
            raise ValueError("provide exactly one of drug_id or name")
        return self
