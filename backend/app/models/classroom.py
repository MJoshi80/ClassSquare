from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.database import Base
from datetime import datetime
from typing import Optional, List

class ClassMaterial(Base):
    __tablename__ = 'class_materials'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 'material' (lecture notes/slides), 'assignment' (homework with deadline), 'announcement' (notice)
    type: Mapped[str] = mapped_column(String(50), nullable=False, default='material')
    
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey('batches.id', ondelete='CASCADE'), nullable=False, index=True)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey('subjects.id', ondelete='CASCADE'), nullable=False, index=True)
    faculty_id: Mapped[int] = mapped_column(Integer, ForeignKey('faculty.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # File attachment
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    # Deadline for assignments
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    # Relationships
    batch = relationship('Batch')
    subject = relationship('Subject')
    faculty = relationship('Faculty')
    submissions = relationship('StudentSubmission', back_populates='material', cascade='all, delete-orphan')

class StudentSubmission(Base):
    __tablename__ = 'student_submissions'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    material_id: Mapped[int] = mapped_column(Integer, ForeignKey('class_materials.id', ondelete='CASCADE'), nullable=False, index=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    student_name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Submitted File
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default='submitted', nullable=False)  # 'submitted', 'late'
    submitted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    material = relationship('ClassMaterial', back_populates='submissions')
    student = relationship('User')
