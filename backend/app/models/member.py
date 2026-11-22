from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base


class Member(Base):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(index=True)

    usual_medications: Mapped[list["Medication"]] = relationship(
        secondary="usual_medications",
        back_populates="members",
    )
