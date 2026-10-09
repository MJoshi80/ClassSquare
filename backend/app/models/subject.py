from sqlalchemy import Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class ElectiveBand(Base):
    """Groups cross-department NEP 2020 major/minor electives that share a common floating time slot."""
    __tablename__ = "elective_bands"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    
    subjects = relationship("Subject", back_populates="elective_band")

class Subject(Base):
    __tablename__ = "subjects"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[int] = mapped_column(Integer, ForeignKey("departments.id"), nullable=False)
    semester: Mapped[int] = mapped_column(Integer, nullable=False)
    sessions_per_week: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    is_lab: Mapped[bool] = mapped_column(Boolean, default=False)
    is_elective: Mapped[bool] = mapped_column(Boolean, default=False)
    elective_band_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("elective_bands.id"), nullable=True)
    
    department = relationship("Department", back_populates="subjects")
    elective_band = relationship("ElectiveBand", back_populates="subjects")
    faculty_members = relationship("Faculty", secondary="faculty_subjects", back_populates="subjects")
