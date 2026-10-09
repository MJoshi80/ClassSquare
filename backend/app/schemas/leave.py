from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from app.models.leave import LeaveStatus

class LeaveCreateRequest(BaseModel):
    faculty_id: int
    date: date
    reason: Optional[str] = None

class LeaveResponse(BaseModel):
    id: int
    faculty_id: int
    faculty_name: str
    date: date
    substitute_faculty_id: Optional[int] = None
    substitute_name: Optional[str] = None
    status: LeaveStatus
    reason: Optional[str] = None
    affected_slots_count: int = 0

    model_config = {"from_attributes": True}

class SubstituteCandidate(BaseModel):
    faculty_id: int
    faculty_name: str
    department_id: int
    department_name: str
    current_weekly_load: int
    max_classes_per_week: int
    is_same_department: bool
    rank_score: float

class SlotSubstitutionRecommendation(BaseModel):
    slot_id: int
    day: int
    period: int
    subject_id: int
    subject_name: str
    batch_id: int
    batch_name: str
    room_id: int
    room_name: str
    is_lab: bool = False
    candidates: List[SubstituteCandidate] = []

class LeaveRecommendationResponse(BaseModel):
    leave_id: int
    faculty_id: int
    faculty_name: str
    date: date
    weekday_name: str
    affected_slots: List[SlotSubstitutionRecommendation] = []
    total_slots: int = 0

class AssignSubstituteRequest(BaseModel):
    substitute_faculty_id: int
