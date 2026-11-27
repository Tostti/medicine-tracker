from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.database import Base
from app.services.dose import dose_key


class MedicationDrug(Base):
    __tablename__ = "medication_drugs"

    drug_id: Mapped[int] = mapped_column(ForeignKey("drugs.id"), primary_key=True)
    medication_id: Mapped[int] = mapped_column(
        ForeignKey("medications.id"), primary_key=True, index=True
    )
    dose: Mapped[str] = mapped_column()
    # The dose in comparable form ("1 g" -> "1000mg"), to match essentials.
    # Never set by hand: it follows `dose` (see below).
    dose_key: Mapped[str] = mapped_column()

    drug: Mapped["Drug"] = relationship(back_populates="medications")
    medication: Mapped["Medication"] = relationship(back_populates="drugs")

    # Runs on every assignment to dose, including MedicationDrug(dose=...).
    @validates("dose")
    def _set_dose_key(self, _key: str, dose: str) -> str:
        self.dose_key = dose_key(dose)
        return dose
