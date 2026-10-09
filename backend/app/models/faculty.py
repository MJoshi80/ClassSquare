from sqlalchemy import Integer, String, Float, ForeignKey, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

# Many-to-many: which faculty can teach which subjects
class FacultySubject(Base):
    __tablename__ = "faculty_subjects"
    
    faculty_id: Mapped[int] = mapped_column(Integer, ForeignKey("faculty.id"), primary_key=True)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id"), primary_key=True)

class Faculty(Base):
    __tablename__ = "faculty"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[int] = mapped_column(Integer, ForeignKey("departments.id"), nullable=False)
    max_classes_per_day: Mapped[int] = mapped_column(Integer, default=4)
    max_classes_per_week: Mapped[int] = mapped_column(Integer, default=18)
    avg_monthly_leaves: Mapped[float] = mapped_column(Float, default=2.0)
    
    department = relationship("Department", back_populates="faculty")
    subjects = relationship("Subject", secondary="faculty_subjects", back_populates="faculty_members")
