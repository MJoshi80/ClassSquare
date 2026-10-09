from pydantic import BaseModel, Field
from typing import Optional, List, Any
from app.models.department import Shift

# ================= Department Schemas =================
class DepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    shift: Shift = Shift.morning

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    shift: Optional[Shift] = None

class DepartmentResponse(DepartmentBase):
    id: int
    model_config = {"from_attributes": True}


# ================= Room Schemas =================
class RoomBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    capacity: int = Field(..., gt=0)
    is_lab: bool = False
    department_id: Optional[int] = None

class RoomCreate(RoomBase):
    pass

class RoomUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    capacity: Optional[int] = Field(None, gt=0)
    is_lab: Optional[bool] = None
    department_id: Optional[int] = None

class RoomResponse(RoomBase):
    id: int
    department_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ================= Elective Band & Subject Schemas =================
class ElectiveBandBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

class ElectiveBandCreate(ElectiveBandBase):
    pass

class ElectiveBandResponse(ElectiveBandBase):
    id: int
    model_config = {"from_attributes": True}


class SubjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    department_id: int
    semester: int = Field(..., ge=1, le=12)
    sessions_per_week: int = Field(..., ge=1, le=20)
    is_lab: bool = False
    is_elective: bool = False
    elective_band_id: Optional[int] = None

class SubjectCreate(SubjectBase):
    pass

class SubjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    department_id: Optional[int] = None
    semester: Optional[int] = Field(None, ge=1, le=12)
    sessions_per_week: Optional[int] = Field(None, ge=1, le=20)
    is_lab: Optional[bool] = None
    is_elective: Optional[bool] = None
    elective_band_id: Optional[int] = None

class SubjectResponse(SubjectBase):
    id: int
    department_name: Optional[str] = None
    elective_band_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ================= Faculty Schemas =================
class FacultyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    department_id: int
    max_classes_per_day: int = Field(default=4, ge=1, le=10)
    max_classes_per_week: int = Field(default=18, ge=1, le=50)
    avg_monthly_leaves: float = Field(default=2.0, ge=0.0)

class FacultyCreate(FacultyBase):
    subject_ids: List[int] = []

class FacultyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    department_id: Optional[int] = None
    max_classes_per_day: Optional[int] = Field(None, ge=1, le=10)
    max_classes_per_week: Optional[int] = Field(None, ge=1, le=50)
    avg_monthly_leaves: Optional[float] = Field(None, ge=0.0)
    subject_ids: Optional[List[int]] = None

class FacultyResponse(FacultyBase):
    id: int
    department_name: Optional[str] = None
    subjects: List[SubjectResponse] = []
    subject_ids: List[int] = []
    model_config = {"from_attributes": True}


# ================= Batch Schemas =================
class BatchBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    department_id: int
    semester: int = Field(..., ge=1, le=12)
    shift: Shift = Shift.morning
    strength: int = Field(..., gt=0)

class BatchCreate(BatchBase):
    pass

class BatchUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    department_id: Optional[int] = None
    semester: Optional[int] = Field(None, ge=1, le=12)
    shift: Optional[Shift] = None
    strength: Optional[int] = Field(None, gt=0)

class BatchResponse(BatchBase):
    id: int
    department_name: Optional[str] = None
    model_config = {"from_attributes": True}


# ================= Bulk Upload Schemas =================
class RowError(BaseModel):
    row_index: int
    errors: List[str]
    data: dict

class UploadPreviewResponse(BaseModel):
    entity_type: str
    total_rows: int
    valid_count: int
    error_count: int
    valid_rows: List[dict]
    invalid_rows: List[RowError]

class UploadCommitRequest(BaseModel):
    entity_type: str
    rows: List[dict]

class UploadCommitResponse(BaseModel):
    entity_type: str
    inserted_count: int
    message: str

class ClearCategoryResponse(BaseModel):
    entity_type: str
    deleted_count: int
    message: str

