from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base


class MedicationDrug(Base):
    __tablename__ = "medication_drugs"

    drug_id: Mapped[int] = mapped_column(ForeignKey("drugs.id"), primary_key=True)
    medication_id: Mapped[int] = mapped_column(
        ForeignKey("medications.id"), primary_key=True, index=True
    )
    dose: Mapped[str] = mapped_column()

    drug: Mapped["Drug"] = relationship(back_populates="medications")
    medication: Mapped["Medication"] = relationship(back_populates="drugs")
