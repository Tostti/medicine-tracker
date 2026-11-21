from sqlalchemy import Column, Integer, ForeignKey
from app.db.database import Base

class UsualMedication(Base):
    __tablename__ = "usual_medications"

    member_id = Column(Integer, ForeignKey("members.id"),primary_key=True, index=True)
    medication_id = Column(Integer, ForeignKey("medications.id"), primary_key=True, index=True, nullable=False)
 