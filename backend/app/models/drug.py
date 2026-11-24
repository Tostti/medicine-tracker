from sqlalchemy import Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Drug(Base):
    __tablename__ = "drugs"
    __table_args__ = (
        # One drug per name regardless of case: "Ibuprofeno" == "ibuprofeno".
        Index("uq_drugs_name_lower", text("lower(name)"), unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(index=True)

    medications: Mapped[list["MedicationDrug"]] = relationship(back_populates="drug")
