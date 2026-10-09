from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.models.timetable import TimetableStatus
from app.models.department import Shift
from app.models.approval import ApprovalAction

class TimetableGenerateRequest(BaseModel):
    department_id: int
    semester: Optional[int] = None
    shift: Optional[Shift] = None

class TimetableSlotResponse(BaseModel):
    id: Optional[int] = None
    day: int
    period: int
    room_id: int
    room_name: str
    subject_id: int
    subject_name: str
    faculty_id: int
    faculty_name: str
    batch_id: int
    batch_name: str
    is_lab: bool = False

    model_config = {"from_attributes": True}

class TimetableOptionResponse(BaseModel):
    id: int
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    semester: Optional[int] = None
    option_rank: int
    score: float
    status: TimetableStatus
    generated_at: datetime
    clash_count: int = 0
    total_slots: int
    optimization_focus: Optional[str] = None
    tagline: Optional[str] = None
    top_optimized_constraints: Optional[List[dict]] = None
    student_centric_points: Optional[List[dict]] = None
    constraint_breakdown: Optional[dict] = None
    metrics_summary: Optional[dict] = None
    slots: List[TimetableSlotResponse]

    model_config = {"from_attributes": True}

class TimetableGenerateResponse(BaseModel):
    status: str
    message: str
    options: List[TimetableOptionResponse] = []
    diagnostic_suggestions: Optional[List[str]] = None

# ================= Review & What-If Schemas =================
class ApprovalActionRequest(BaseModel):
    comment: Optional[str] = None

class ApprovalLogResponse(BaseModel):
    id: int
    timetable_version_id: int
    reviewer_id: int
    reviewer_email: Optional[str] = None
    action: ApprovalAction
    comment: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}

class SimulateEditRequest(BaseModel):
    slot_id: int
    new_room_id: Optional[int] = None
    new_faculty_id: Optional[int] = None
    new_day: Optional[int] = None
    new_period: Optional[int] = None

class SimulateEditResponse(BaseModel):
    has_clashes: bool
    clash_messages: List[str]
    is_valid_change: bool

class SlotUpdateRequest(BaseModel):
    room_id: Optional[int] = None
    faculty_id: Optional[int] = None
    day: Optional[int] = None
    period: Optional[int] = None
