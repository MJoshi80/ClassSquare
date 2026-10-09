import enum
from datetime import date
from sqlalchemy import Integer, ForeignKey, Enum, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class LeaveStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    substituted = "substituted"
    rejected = "rejected"

class FacultyLeave(Base):
    __tablename__ = "faculty_leaves"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    faculty_id: Mapped[int] = mapped_column(Integer, ForeignKey("faculty.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    substitute_faculty_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("faculty.id"), nullable=True)
    status: Mapped[LeaveStatus] = mapped_column(Enum(LeaveStatus), default=LeaveStatus.pending)
    
    faculty = relationship("Faculty", foreign_keys=[faculty_id])
    substitute = relationship("Faculty", foreign_keys=[substitute_faculty_id])

