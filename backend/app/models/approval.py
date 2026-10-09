import enum
from datetime import datetime
from sqlalchemy import Integer, String, ForeignKey, Enum, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class ApprovalAction(str, enum.Enum):
    approved = "approved"
    rejected = "rejected"
    comment = "comment"

class ApprovalLog(Base):
    __tablename__ = "approval_logs"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    timetable_version_id: Mapped[int] = mapped_column(Integer, ForeignKey("timetable_versions.id"), nullable=False)
    reviewer_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    action: Mapped[ApprovalAction] = mapped_column(Enum(ApprovalAction), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    timetable_version = relationship("TimetableVersion", back_populates="approval_logs")
