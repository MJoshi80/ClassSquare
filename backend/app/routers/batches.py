from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.batch import Batch
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.entities import BatchCreate, BatchUpdate, BatchResponse, ClearCategoryResponse
from app.auth.dependencies import get_current_user, require_role
from app.services.clear_service import clear_entity_records

router = APIRouter(prefix="/api/batches", tags=["Batches"])

def _to_batch_response(b: Batch) -> BatchResponse:
    return BatchResponse(
        id=b.id,
        name=b.name,
        department_id=b.department_id,
        semester=b.semester,
        shift=b.shift,
        strength=b.strength,
        department_name=b.department.name if b.department else None
    )

@router.get("", response_model=List[BatchResponse])
def get_batches(
    department_id: Optional[int] = None,
    semester: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Batch)
    if department_id is not None:
        query = query.filter(Batch.department_id == department_id)
    if semester is not None:
        query = query.filter(Batch.semester == semester)
    batches = query.all()
    return [_to_batch_response(b) for b in batches]

@router.get("/{id}", response_model=BatchResponse)
def get_batch(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = db.query(Batch).filter(Batch.id == id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return _to_batch_response(batch)

@router.post("", response_model=BatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(
    data: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    dept = db.query(Department).filter(Department.id == data.department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail=f"Department ID {data.department_id} not found")
    
    batch = Batch(
        name=data.name,
        department_id=data.department_id,
        semester=data.semester,
        shift=data.shift,
        strength=data.strength
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return _to_batch_response(batch)

@router.put("/{id}", response_model=BatchResponse)
def update_batch(
    id: int,
    data: BatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    batch = db.query(Batch).filter(Batch.id == id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    if data.department_id is not None:
        dept = db.query(Department).filter(Department.id == data.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail=f"Department ID {data.department_id} not found")
        batch.department_id = data.department_id

    if data.name is not None:
        batch.name = data.name
    if data.semester is not None:
        batch.semester = data.semester
    if data.shift is not None:
        batch.shift = data.shift
    if data.strength is not None:
        batch.strength = data.strength

    db.commit()
    db.refresh(batch)
    return _to_batch_response(batch)

@router.delete("/clear", response_model=ClearCategoryResponse)
def clear_batches(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin))
):
    count = clear_entity_records("batches", db)
    return ClearCategoryResponse(
        entity_type="batches",
        deleted_count=count,
        message=f"Successfully cleared {count} batches."
    )

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_batch(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    batch = db.query(Batch).filter(Batch.id == id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    db.delete(batch)
    db.commit()
    return None
