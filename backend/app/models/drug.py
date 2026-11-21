from sqlalchemy import Column, Integer, String
from app.db.database import Base

class Drug(Base):
    __tablename__ = "drugs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
 