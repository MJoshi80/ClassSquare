from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.entities import DepartmentCreate, DepartmentUpdate, DepartmentResponse, ClearCategoryResponse
from app.auth.dependencies import get_current_user, require_role
from app.services.clear_service import clear_entity_records

router = APIRouter(prefix="/api/departments", tags=["Departments"])

@router.get("", response_model=List[DepartmentResponse])
def get_departments(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Department).all()

@router.get("/{id}", response_model=DepartmentResponse)
def get_department(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    return dept

@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin))
):
    existing = db.query(Department).filter(Department.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Department '{data.name}' already exists")
    dept = Department(name=data.name, shift=data.shift)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.put("/{id}", response_model=DepartmentResponse)
def update_department(
    id: int,
    data: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin))
):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    if data.name is not None and data.name != dept.name:
        existing = db.query(Department).filter(Department.name == data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Department '{data.name}' already exists")
        dept.name = data.name
    if data.shift is not None:
        dept.shift = data.shift
    db.commit()
    db.refresh(dept)
    return dept

@router.delete("/clear", response_model=ClearCategoryResponse)
def clear_departments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin))
):
    count = clear_entity_records("departments", db)
    return ClearCategoryResponse(
        entity_type="departments",
        deleted_count=count,
        message=f"Successfully cleared {count} departments."
    )

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin))
):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    db.delete(dept)
    db.commit()
    return None
