from datetime import date

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Existence(Base):
    __tablename__ = "existences"

    id: Mapped[int] = mapped_column(primary_key=True)
    due_date: Mapped[date] = mapped_column(index=True)
    low_amount: Mapped[bool] = mapped_column()
    medication_id: Mapped[int] = mapped_column(ForeignKey("medications.id"), index=True)

    medication: Mapped["Medication"] = relationship(back_populates="existences")
