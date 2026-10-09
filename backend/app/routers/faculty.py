from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.faculty import Faculty, FacultySubject
from app.models.subject import Subject
from app.models.department import Department
from app.models.user import User, UserRole
from app.models.timetable import TimetableSlot, TimetableVersion, TimetableStatus
from app.schemas.entities import FacultyCreate, FacultyUpdate, FacultyResponse, SubjectResponse, ClearCategoryResponse
from app.schemas.timetable import TimetableSlotResponse
from app.auth.dependencies import get_current_user, require_role
from app.services.clear_service import clear_entity_records

router = APIRouter(prefix="/api/faculty", tags=["Faculty"])

def _to_faculty_response(f: Faculty) -> FacultyResponse:
    sub_responses = [
        SubjectResponse(
            id=s.id,
            name=s.name,
            department_id=s.department_id,
            semester=s.semester,
            sessions_per_week=s.sessions_per_week,
            is_lab=s.is_lab,
            is_elective=s.is_elective,
            elective_band_id=s.elective_band_id,
            department_name=s.department.name if s.department else None,
            elective_band_name=s.elective_band.name if s.elective_band else None
        ) for s in f.subjects
    ]
    return FacultyResponse(
        id=f.id,
        name=f.name,
        department_id=f.department_id,
        max_classes_per_day=f.max_classes_per_day,
        max_classes_per_week=f.max_classes_per_week,
        avg_monthly_leaves=f.avg_monthly_leaves,
        department_name=f.department.name if f.department else None,
        subjects=sub_responses,
        subject_ids=[s.id for s in f.subjects]
    )

@router.get("", response_model=List[FacultyResponse])
def get_all_faculty(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Faculty)
    if department_id is not None:
        query = query.filter(Faculty.department_id == department_id)
    faculty_list = query.all()
    return [_to_faculty_response(f) for f in faculty_list]

@router.get("/{id}", response_model=FacultyResponse)
def get_faculty_member(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    f = db.query(Faculty).filter(Faculty.id == id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Faculty member not found")
    return _to_faculty_response(f)

@router.post("", response_model=FacultyResponse, status_code=status.HTTP_201_CREATED)
def create_faculty(
    data: FacultyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    dept = db.query(Department).filter(Department.id == data.department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail=f"Department ID {data.department_id} not found")
    
    faculty = Faculty(
        name=data.name,
        department_id=data.department_id,
        max_classes_per_day=data.max_classes_per_day,
        max_classes_per_week=data.max_classes_per_week,
        avg_monthly_leaves=data.avg_monthly_leaves
    )
    db.add(faculty)
    db.flush()

    if data.subject_ids:
        subjects = db.query(Subject).filter(Subject.id.in_(data.subject_ids)).all()
        found_ids = {s.id for s in subjects}
        missing = set(data.subject_ids) - found_ids
        if missing:
            raise HTTPException(status_code=400, detail=f"Subject IDs not found: {list(missing)}")
        faculty.subjects = subjects

    db.commit()
    db.refresh(faculty)
    return _to_faculty_response(faculty)

@router.put("/{id}", response_model=FacultyResponse)
def update_faculty(
    id: int,
    data: FacultyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    faculty = db.query(Faculty).filter(Faculty.id == id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found")
    
    if data.department_id is not None:
        dept = db.query(Department).filter(Department.id == data.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail=f"Department ID {data.department_id} not found")
        faculty.department_id = data.department_id
    
    if data.name is not None:
        faculty.name = data.name
    if data.max_classes_per_day is not None:
        faculty.max_classes_per_day = data.max_classes_per_day
    if data.max_classes_per_week is not None:
        faculty.max_classes_per_week = data.max_classes_per_week
    if data.avg_monthly_leaves is not None:
        faculty.avg_monthly_leaves = data.avg_monthly_leaves

    if data.subject_ids is not None:
        subjects = db.query(Subject).filter(Subject.id.in_(data.subject_ids)).all()
        found_ids = {s.id for s in subjects}
        missing = set(data.subject_ids) - found_ids
        if missing:
            raise HTTPException(status_code=400, detail=f"Subject IDs not found: {list(missing)}")
        faculty.subjects = subjects

    db.commit()
    db.refresh(faculty)
    return _to_faculty_response(faculty)

@router.delete("/clear", response_model=ClearCategoryResponse)
def clear_faculty(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin))
):
    count = clear_entity_records("faculty", db)
    return ClearCategoryResponse(
        entity_type="faculty",
        deleted_count=count,
        message=f"Successfully cleared {count} faculty records."
    )

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_faculty(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    faculty = db.query(Faculty).filter(Faculty.id == id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found")
    db.delete(faculty)
    db.commit()
    return None

def _get_faculty_schedule_slots(faculty_id: int, db: Session) -> List[TimetableSlotResponse]:
    versions = db.query(TimetableVersion).filter(TimetableVersion.status == TimetableStatus.approved).all()
    if not versions:
        versions = db.query(TimetableVersion).filter(TimetableVersion.status == TimetableStatus.draft).all()

    v_ids = [v.id for v in versions]
    if not v_ids:
        return []

    slots = db.query(TimetableSlot).filter(
        TimetableSlot.timetable_version_id.in_(v_ids),
        TimetableSlot.faculty_id == faculty_id
    ).all()

    return [
        TimetableSlotResponse(
            id=s.id,
            day=s.day,
            period=s.period,
            room_id=s.room_id,
            room_name=s.room.name if s.room else "Room",
            subject_id=s.subject_id,
            subject_name=s.subject.name if s.subject else "Subject",
            faculty_id=s.faculty_id,
            faculty_name=s.faculty.name if s.faculty else "Faculty",
            batch_id=s.batch_id,
            batch_name=s.batch.name if s.batch else "Batch",
            is_lab=s.subject.is_lab if s.subject else False
        )
        for s in slots
    ]

@router.get("/me/schedule", response_model=List[TimetableSlotResponse])
def get_my_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    faculty_id = current_user.linked_faculty_id
    if not faculty_id:
        f = db.query(Faculty).first()
        if f:
            faculty_id = f.id
        else:
            return []
    return _get_faculty_schedule_slots(faculty_id, db)

@router.get("/{id}/schedule", response_model=List[TimetableSlotResponse])
def get_faculty_schedule(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    faculty = db.query(Faculty).filter(Faculty.id == id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found")
    return _get_faculty_schedule_slots(id, db)

