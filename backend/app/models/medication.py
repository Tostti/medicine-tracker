from sqlalchemy import false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(primary_key=True)
    commercial_name: Mapped[str] = mapped_column(index=True)
    type: Mapped[str | None] = mapped_column()
    function: Mapped[str | None] = mapped_column()
    picture_uri: Mapped[str | None] = mapped_column()
    # Replaced by essentials (a composition, not a brand). Kept until a later migration
    # drops it, so the data migration can be undone; nothing reads or writes it anymore.
    common_use: Mapped[bool] = mapped_column(default=False, server_default=false())
    existences: Mapped[list["Existence"]] = relationship(
        back_populates="medication",
        order_by="Existence.due_date",
    )

    drugs: Mapped[list["MedicationDrug"]] = relationship(back_populates="medication")
