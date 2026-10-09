from datetime import datetime
from sqlalchemy import Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class TimetableVote(Base):
    '''Tracks a student's vote for a candidate timetable version within a department & semester.'''
    __tablename__ = 'timetable_votes'
    __table_args__ = (
        UniqueConstraint('user_id', 'department_id', 'semester', name='uq_user_department_semester_vote'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    timetable_version_id: Mapped[int] = mapped_column(Integer, ForeignKey('timetable_versions.id', ondelete='CASCADE'), nullable=False, index=True)
    department_id: Mapped[int] = mapped_column(Integer, ForeignKey('departments.id'), nullable=False, index=True)
    semester: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    voted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship('User')
    timetable_version = relationship('TimetableVersion')
    department = relationship('Department')
