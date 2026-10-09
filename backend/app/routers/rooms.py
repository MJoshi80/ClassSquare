from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.room import Room
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.entities import RoomCreate, RoomUpdate, RoomResponse, ClearCategoryResponse
from app.auth.dependencies import get_current_user, require_role
from app.services.clear_service import clear_entity_records

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])

def _to_response(room: Room) -> RoomResponse:
    return RoomResponse(
        id=room.id,
        name=room.name,
        capacity=room.capacity,
        is_lab=room.is_lab,
        department_id=room.department_id,
        department_name=room.department.name if room.department else "Shared"
    )

@router.get("", response_model=List[RoomResponse])
def get_rooms(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Room)
    if department_id is not None:
        query = query.filter((Room.department_id == department_id) | (Room.department_id.is_(None)))
    rooms = query.all()
    return [_to_response(r) for r in rooms]

@router.get("/{id}", response_model=RoomResponse)
def get_room(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    room = db.query(Room).filter(Room.id == id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return _to_response(room)

@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    data: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    if data.department_id is not None:
        dept = db.query(Department).filter(Department.id == data.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail=f"Department ID {data.department_id} not found")
    
    room = Room(
        name=data.name,
        capacity=data.capacity,
        is_lab=data.is_lab,
        department_id=data.department_id
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return _to_response(room)

@router.put("/{id}", response_model=RoomResponse)
def update_room(
    id: int,
    data: RoomUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    room = db.query(Room).filter(Room.id == id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if data.department_id is not None:
        dept = db.query(Department).filter(Department.id == data.department_id).first()
        if not dept:
            raise HTTPException(status_code=400, detail=f"Department ID {data.department_id} not found")
        room.department_id = data.department_id
    elif data.department_id is None and "department_id" in data.model_dump(exclude_unset=True):
        room.department_id = None
        
    if data.name is not None:
        room.name = data.name
    if data.capacity is not None:
        room.capacity = data.capacity
    if data.is_lab is not None:
        room.is_lab = data.is_lab
        
    db.commit()
    db.refresh(room)
    return _to_response(room)

@router.delete("/clear", response_model=ClearCategoryResponse)
def clear_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin))
):
    count = clear_entity_records("rooms", db)
    return ClearCategoryResponse(
        entity_type="rooms",
        deleted_count=count,
        message=f"Successfully cleared {count} rooms."
    )

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    room = db.query(Room).filter(Room.id == id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    db.delete(room)
    db.commit()
    return None
