from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey
from app.db.database import Base

class Existence(Base):
    __tablename__ = "existences"

    id = Column(Integer, primary_key=True, index=True)
    due_date = Column(Date, index=True, nullable=False)
    low_amount = Column(Boolean, index=True, nullable=False)
    medication_id = Column(Integer, ForeignKey("medications.id"), index=True, nullable=False)
