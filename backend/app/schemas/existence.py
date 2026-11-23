from datetime import date

from pydantic import BaseModel, ConfigDict


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
