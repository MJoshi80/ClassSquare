from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.subject import Subject, ElectiveBand
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.entities import (
    SubjectCreate, SubjectUpdate, SubjectResponse,
    ElectiveBandCreate, ElectiveBandResponse, ClearCategoryResponse
)
from app.auth.dependencies import get_current_user, require_role
from app.services.clear_service import clear_entity_records

router = APIRouter(prefix="/api/subjects", tags=["Subjects"])

def _to_subject_response(s: Subject) -> SubjectResponse:
    return SubjectResponse(
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
    )

# --- Elective Bands ---
@router.get("/bands/all", response_model=List[ElectiveBandResponse])
def get_elective_bands(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ElectiveBand).all()

@router.post("/bands", response_model=ElectiveBandResponse, status_code=status.HTTP_201_CREATED)
def create_elective_band(
    data: ElectiveBandCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    existing = db.query(ElectiveBand).filter(ElectiveBand.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Elective Band '{data.name}' already exists")
    band = ElectiveBand(name=data.name)
    db.add(band)
    db.commit()
    db.refresh(band)
    return band

# --- Subjects ---
@router.get("", response_model=List[SubjectResponse])
def get_subjects(
    department_id: Optional[int] = None,
    semester: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Subject)
    if department_id is not None:
        query = query.filter(Subject.department_id == department_id)
    if semester is not None:
        query = query.filter(Subject.semester == semester)
    subjects = query.all()
    return [_to_subject_response(s) for s in subjects]

@router.get("/{id}", response_model=SubjectResponse)
def get_subject(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sub = db.query(Subject).filter(Subject.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    return _to_subject_response(sub)

@router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    data: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    dept = db.query(Department).filter(Department.id == data.department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail=f"Department ID {data.department_id} not found")
    
    if data.elective_band_id is not None:
        band = db.query(ElectiveBand).filter(ElectiveBand.id == data.elective_band_id).first()
        if not band:
            raise HTTPException(status_code=400, detail=f"Elective Band ID {data.elective_band_id} not found")

    subject = Subject(
        name=data.name,
        department_id=data.department_id,
        semester=data.semester,
        sessions_per_week=data.sessions_per_week,
        is_lab=data.is_lab,
        is_elective=data.is_elective,
        elective_band_id=data.elective_band_id
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return _to_subject_response(subject)

@router.put("/{id}", response_model=SubjectResponse)
def update_subject(
    id: int,
    data: SubjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    sub = db.query(Subject).filter(Subject.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    if data.department_id is not None:
        dept = db.query(Department).filter(Department.id == data.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail=f"Department ID {data.department_id} not found")
        sub.department_id = data.department_id

    if data.elective_band_id is not None:
        band = db.query(ElectiveBand).filter(ElectiveBand.id == data.elective_band_id).first()
        if not band:
            raise HTTPException(status_code=400, detail=f"Elective Band ID {data.elective_band_id} not found")
        sub.elective_band_id = data.elective_band_id
    elif data.elective_band_id is None and "elective_band_id" in data.model_dump(exclude_unset=True):
        sub.elective_band_id = None

    if data.name is not None:
        sub.name = data.name
    if data.semester is not None:
        sub.semester = data.semester
    if data.sessions_per_week is not None:
        sub.sessions_per_week = data.sessions_per_week
    if data.is_lab is not None:
        sub.is_lab = data.is_lab
    if data.is_elective is not None:
        sub.is_elective = data.is_elective

    db.commit()
    db.refresh(sub)
    return _to_subject_response(sub)

@router.delete("/clear", response_model=ClearCategoryResponse)
def clear_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin))
):
    count = clear_entity_records("subjects", db)
    return ClearCategoryResponse(
        entity_type="subjects",
        deleted_count=count,
        message=f"Successfully cleared {count} subjects."
    )

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    sub = db.query(Subject).filter(Subject.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(sub)
    db.commit()
    return None
