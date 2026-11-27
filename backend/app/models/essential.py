from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.db.database import Base
from app.services.dose import dose_key


class Essential(Base):
    """A composition to always keep at home, whatever the brand: "Ibuprofeno 600 mg".

    Any medication with exactly the same drugs and doses covers it.
    """

    __tablename__ = "essentials"

    id: Mapped[int] = mapped_column(primary_key=True)

    drugs: Mapped[list["EssentialDrug"]] = relationship(
        back_populates="essential", cascade="all, delete-orphan"
    )


class EssentialDrug(Base):
    __tablename__ = "essential_drugs"

    essential_id: Mapped[int] = mapped_column(
        ForeignKey("essentials.id", ondelete="CASCADE"), primary_key=True
    )
    drug_id: Mapped[int] = mapped_column(ForeignKey("drugs.id"), primary_key=True)
    # As first written, for display; matching uses dose_key, like MedicationDrug.
    dose: Mapped[str] = mapped_column()
    dose_key: Mapped[str] = mapped_column()

    essential: Mapped[Essential] = relationship(back_populates="drugs")
    drug: Mapped["Drug"] = relationship()

    @validates("dose")
    def _set_dose_key(self, _key: str, dose: str) -> str:
        self.dose_key = dose_key(dose)
        return dose
