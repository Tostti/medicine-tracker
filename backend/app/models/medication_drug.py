from sqlalchemy import Column, Integer, String, ForeignKey
from app.db.database import Base

class MedicationDrug(Base):
    __tablename__ = "medication_drugs"

    drug_id = Column(Integer, ForeignKey("drugs.id"),primary_key=True, index=True)
    medication_id = Column(Integer, ForeignKey("medications.id"), primary_key=True, index=True, nullable=False)
    dose = Column(String, index=True, nullable=False)
 