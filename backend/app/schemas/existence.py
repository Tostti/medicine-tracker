from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator


class ExistenceBase(BaseModel):
    due_date: date
    low_amount: bool


class ExistenceRead(ExistenceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class ExistenceCreate(ExistenceBase):
    pass


class ExistenceUpdate(BaseModel):
    due_date: date | None = None
    low_amount: bool | None = None

    # PATCH semantics: leaving a field out keeps it, but both columns are NOT NULL,
    # so an explicit null must be a 422 instead of a database error (500).
    @field_validator("due_date", "low_amount")
    @classmethod
    def _not_null(cls, v):
        if v is None:
            raise ValueError("cannot be null")
        return v
