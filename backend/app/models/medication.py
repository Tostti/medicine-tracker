from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(primary_key=True)
    commercial_name: Mapped[str] = mapped_column(index=True)
    type: Mapped[str | None] = mapped_column()
    function: Mapped[str | None] = mapped_column()
    picture_uri: Mapped[str | None] = mapped_column()

    existences: Mapped[list["Existence"]] = relationship(
        back_populates="medication",
        order_by="Existence.due_date",
    )

    members: Mapped[list["Member"]] = relationship(
        secondary="usual_medications",
        back_populates="usual_medications",
    )

    drugs: Mapped[list["MedicationDrug"]] = relationship(back_populates="medication")
