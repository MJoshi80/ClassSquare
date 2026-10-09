from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    material_id: int
    student_id: int
    student_name: str
    file_name: str
    file_size: Optional[int] = None
    notes: Optional[str] = None
    status: str
    submitted_at: datetime

class MaterialResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    type: str
    batch_id: int
    batch_name: Optional[str] = None
    subject_id: int
    subject_name: Optional[str] = None
    faculty_id: int
    faculty_name: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    has_file: bool = False
    due_date: Optional[datetime] = None
    created_at: datetime
    submissions_count: int = 0
    my_submission: Optional[SubmissionResponse] = None

class BatchSubjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_lab: bool = False
    is_elective: bool = False
    sessions_per_week: int = 3
    faculty_name: Optional[str] = None
    total_materials: int = 0
    notes_count: int = 0
    assignment_count: int = 0
    announcement_count: int = 0
    pending_assignments_count: int = 0
