from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, field_validator

from app.schemas.drug import MedicationDrugRead, MedicationDrugCreate
from app.schemas.existence import ExistenceCreate, ExistenceRead
from app.services.image import is_image_key


def _check_picture_uri(v: str | None) -> str | None:
    """Either an external http(s) URL or a key returned by POST /images."""
    if v is None or v.startswith(("http://", "https://")) or is_image_key(v):
        return v
    raise ValueError("picture_uri must be an http(s) URL or an uploaded image key")


# Only used on input schemas: reads return whatever is stored.
PictureUri = Annotated[str | None, AfterValidator(_check_picture_uri)]


class MedicationBase(BaseModel):
    commercial_name: str
    type: str | None = None
    function: str | None = None
    picture_uri: str | None = None


class MedicationCreate(MedicationBase):
    picture_uri: PictureUri = None
    drugs: list[MedicationDrugCreate]
    # Optional first stock, so adding a medication you have in hand is one step.
    existences: list[ExistenceCreate] = []


class MedicationUpdate(BaseModel):
    commercial_name: str | None = None
    type: str | None = None
    function: str | None = None
    picture_uri: PictureUri = None
    # Replaces the whole list: send every drug the medication should end up with.
    drugs: list[MedicationDrugCreate] | None = None

    # PATCH semantics: leaving a field out keeps it, but these columns are NOT NULL,
    # so an explicit null must be a 422 instead of a database error (500).
    # Validators only run on fields that were sent, so omitting them is still fine.
    @field_validator("commercial_name", "drugs")
    @classmethod
    def _not_null(cls, v):
        if v is None:
            raise ValueError("cannot be null")
        return v


class MedicationRead(MedicationBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class MedicationDetail(MedicationRead):
    drugs: list[MedicationDrugRead]
    existences: list[ExistenceRead]
