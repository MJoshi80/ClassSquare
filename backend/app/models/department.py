import enum
from sqlalchemy import Column, Integer, String, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Shift(str, enum.Enum):
    morning = "morning"
    evening = "evening"

class Department(Base):
    __tablename__ = "departments"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    shift: Mapped[Shift] = mapped_column(Enum(Shift), nullable=False, default=Shift.morning)
    
    # Relationships
    rooms = relationship("Room", back_populates="department")
    faculty = relationship("Faculty", back_populates="department")
    subjects = relationship("Subject", back_populates="department")
    batches = relationship("Batch", back_populates="department")
