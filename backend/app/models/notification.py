from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    role = Column(String(50), nullable=True, index=True)  # 'all', 'admin', 'hod', 'faculty', 'student'
    title = Column(String(200), nullable=False)
    message = Column(String(1000), nullable=False)
    type = Column(String(50), nullable=False, default="info")  # 'timetable_published', 'substitution_assigned', 'leave_status', 'leave_applied', 'info'
    link = Column(String(200), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", backref="notifications")
