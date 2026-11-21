from sqlalchemy import Column, Integer, String
from app.db.database import Base

class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)
    commercial_name = Column(String, index=True, nullable=False)
    type = Column(String)
    function = Column(String, index=True)
    picture_uri = Column(String)