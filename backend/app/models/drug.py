from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Drug(Base):
    __tablename__ = "drugs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(index=True)

    medications: Mapped[list["MedicationDrug"]] = relationship(back_populates="drug")
