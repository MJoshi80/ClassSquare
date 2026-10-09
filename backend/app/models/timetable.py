import enum
from datetime import datetime
from sqlalchemy import Integer, String, Float, ForeignKey, Enum, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class TimetableStatus(str, enum.Enum):
    draft = "draft"
    pending_approval = "pending_approval"
    approved = "approved"
    rejected = "rejected"

class TimetableVersion(Base):
    """A generated timetable option. Multiple versions may exist for the same scope."""
    __tablename__ = "timetable_versions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("batches.id"), nullable=True)
    department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id"), nullable=True)
    semester: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[TimetableStatus] = mapped_column(Enum(TimetableStatus), default=TimetableStatus.draft)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)  # Objective value / quality score
    option_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1 = best option
    optimization_focus: Mapped[str | None] = mapped_column(String, nullable=True)  # Strategic focus category
    
    slots = relationship("TimetableSlot", back_populates="timetable_version", cascade="all, delete-orphan")
    approval_logs = relationship("ApprovalLog", back_populates="timetable_version")
    department = relationship("Department")
    batch = relationship("Batch")

class TimetableSlot(Base):
    """A single scheduled class within a timetable version."""
    __tablename__ = "timetable_slots"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timetable_version_id: Mapped[int] = mapped_column(Integer, ForeignKey("timetable_versions.id"), nullable=False)
    day: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday..4=Friday
    period: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-based
    room_id: Mapped[int] = mapped_column(Integer, ForeignKey("rooms.id"), nullable=False)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id"), nullable=False)
    faculty_id: Mapped[int] = mapped_column(Integer, ForeignKey("faculty.id"), nullable=False)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("batches.id"), nullable=False)
    
    timetable_version = relationship("TimetableVersion", back_populates="slots")
    room = relationship("Room")
    subject = relationship("Subject")
    faculty = relationship("Faculty")
    batch = relationship("Batch")

