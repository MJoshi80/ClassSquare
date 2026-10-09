from sqlalchemy import Integer, String, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.department import Shift
from app.database import Base

class Batch(Base):
    __tablename__ = "batches"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[int] = mapped_column(Integer, ForeignKey("departments.id"), nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    shift: Mapped[Shift] = mapped_column(Enum(Shift), nullable=False, default=Shift.morning)
    strength: Mapped[int] = mapped_column(Integer, nullable=False)
    
    department = relationship("Department", back_populates="batches")

class FixedSlot(Base):
    """Special classes with fixed, non-negotiable time slots."""
    __tablename__ = "fixed_slots"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id"), nullable=False)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("batches.id"), nullable=False)
    day: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday..4=Friday
    period: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-based period number
    room_id: Mapped[int] = mapped_column(Integer, ForeignKey("rooms.id"), nullable=False)
