from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class UsualMedication(Base):
    __tablename__ = "usual_medications"

    member_id: Mapped[int] = mapped_column(ForeignKey("members.id"), primary_key=True)
    medication_id: Mapped[int] = mapped_column(
        ForeignKey("medications.id"), primary_key=True, index=True
    )
