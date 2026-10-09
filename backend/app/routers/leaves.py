from app.services.notification_service import create_notification
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.database import get_db
from app.models.leave import FacultyLeave, LeaveStatus
from app.models.faculty import Faculty
from app.models.user import User, UserRole
from app.models.timetable import TimetableSlot
from app.schemas.leave import (
    LeaveCreateRequest, LeaveResponse,
    LeaveRecommendationResponse, AssignSubstituteRequest
)
from app.solver.substitution import find_substitute_recommendations, get_active_timetable_versions
from app.auth.dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/leaves", tags=["Faculty Leaves & Substitution"])

def _to_leave_response(l: FacultyLeave, db: Session) -> LeaveResponse:
    # Calculate how many scheduled class slots are affected on this date
    weekday_idx = l.date.weekday()
    affected_count = 0
    if weekday_idx <= 4:
        active_versions = get_active_timetable_versions(db)
        v_ids = [v.id for v in active_versions]
        if v_ids:
            affected_count = db.query(TimetableSlot).filter(
                TimetableSlot.timetable_version_id.in_(v_ids),
                TimetableSlot.faculty_id == l.faculty_id,
                TimetableSlot.day == weekday_idx
            ).count()

    return LeaveResponse(
        id=l.id,
        faculty_id=l.faculty_id,
        faculty_name=l.faculty.name if l.faculty else f"Faculty {l.faculty_id}",
        date=l.date,
        substitute_faculty_id=l.substitute_faculty_id,
        substitute_name=l.substitute.name if l.substitute else None,
        status=l.status,
        affected_slots_count=affected_count
    )

@router.post("", response_model=LeaveResponse, status_code=status.HTTP_201_CREATED)
def apply_leave(
    req: LeaveCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    faculty = db.query(Faculty).filter(Faculty.id == req.faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty member not found")

    # If current user is faculty role, ensure they are applying for themselves
    if current_user.role == UserRole.faculty and current_user.linked_faculty_id != req.faculty_id:
        raise HTTPException(status_code=403, detail="Faculty members can only apply for their own leave")

    # Check duplicate leave for same date
    existing = db.query(FacultyLeave).filter(
        FacultyLeave.faculty_id == req.faculty_id,
        FacultyLeave.date == req.date,
        FacultyLeave.status != LeaveStatus.rejected
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Leave request already exists for {req.date}")

    leave = FacultyLeave(
        faculty_id=req.faculty_id,
        date=req.date,
        status=LeaveStatus.pending
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    create_notification(
        db=db,
        title=f"Leave Request: {faculty.name}",
        message=f"{faculty.name} submitted a leave request for {req.date}.",
        type="leave_applied",
        role="hod",
        link="/hod"
    )

    return _to_leave_response(leave, db)

@router.get("", response_model=List[LeaveResponse])
def get_leaves(
    faculty_id: Optional[int] = None,
    status: Optional[LeaveStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(FacultyLeave)
    if faculty_id is not None:
        query = query.filter(FacultyLeave.faculty_id == faculty_id)
    elif current_user.role == UserRole.faculty and current_user.linked_faculty_id:
        query = query.filter(FacultyLeave.faculty_id == current_user.linked_faculty_id)
    
    if status is not None:
        query = query.filter(FacultyLeave.status == status)

    leaves = query.order_by(FacultyLeave.date.desc()).all()
    return [_to_leave_response(l, db) for l in leaves]

@router.get("/{id}", response_model=LeaveResponse)
def get_leave(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    leave = db.query(FacultyLeave).filter(FacultyLeave.id == id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    return _to_leave_response(leave, db)

@router.post("/{id}/approve", response_model=LeaveResponse)
def approve_leave(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    leave = db.query(FacultyLeave).filter(FacultyLeave.id == id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    leave.status = LeaveStatus.approved
    db.commit()
    db.refresh(leave)

    orig_user = db.query(User).filter(User.linked_faculty_id == leave.faculty_id).first()
    create_notification(
        db=db,
        user_id=orig_user.id if orig_user else None,
        role="faculty" if not orig_user else None,
        title="Leave Request Approved",
        message=f"Your leave application for {leave.date} has been approved.",
        type="leave_status",
        link="/faculty"
    )

    return _to_leave_response(leave, db)

@router.post("/{id}/reject", response_model=LeaveResponse)
def reject_leave(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    leave = db.query(FacultyLeave).filter(FacultyLeave.id == id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    leave.status = LeaveStatus.rejected
    db.commit()
    db.refresh(leave)

    orig_user = db.query(User).filter(User.linked_faculty_id == leave.faculty_id).first()
    create_notification(
        db=db,
        user_id=orig_user.id if orig_user else None,
        role="faculty" if not orig_user else None,
        title="Leave Request Rejected",
        message=f"Your leave application for {leave.date} was rejected.",
        type="leave_status",
        link="/faculty"
    )

    return _to_leave_response(leave, db)

@router.get("/{id}/recommendations", response_model=LeaveRecommendationResponse)
def get_substitute_recommendations(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    leave = db.query(FacultyLeave).filter(FacultyLeave.id == id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    recs = find_substitute_recommendations(db, leave)
    return recs

@router.post("/{id}/substitute", response_model=LeaveResponse)
def assign_substitute(
    id: int,
    req: AssignSubstituteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    leave = db.query(FacultyLeave).filter(FacultyLeave.id == id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    substitute = db.query(Faculty).filter(Faculty.id == req.substitute_faculty_id).first()
    if not substitute:
        raise HTTPException(status_code=404, detail="Substitute faculty not found")

    if substitute.id == leave.faculty_id:
        raise HTTPException(status_code=400, detail="Cannot assign absent faculty as their own substitute")

    leave.substitute_faculty_id = substitute.id
    leave.status = LeaveStatus.substituted
    db.commit()
    db.refresh(leave)

    sub_user = db.query(User).filter(User.linked_faculty_id == substitute.id).first()
    orig_user = db.query(User).filter(User.linked_faculty_id == leave.faculty_id).first()

    # 1. Notify substitute faculty
    create_notification(
        db=db,
        user_id=sub_user.id if sub_user else None,
        role="faculty" if not sub_user else None,
        title="Substitution Duty Assigned",
        message=f"You have been assigned to cover classes for {leave.faculty.name} on {leave.date}.",
        type="substitution_assigned",
        link="/faculty"
    )

    # 2. Notify faculty on leave of their confirmed substitute
    create_notification(
        db=db,
        user_id=orig_user.id if orig_user else None,
        role="faculty" if not orig_user else None,
        title="Substitute Assigned for Your Leave",
        message=f"{substitute.name} has been assigned to cover your classes on {leave.date}.",
        type="substitution_assigned",
        link="/faculty"
    )

    # 3. Notify cohort students
    create_notification(
        db=db,
        title=f"Schedule Update: Substitution on {leave.date}",
        message=f"{substitute.name} will substitute teach classes on {leave.date}.",
        type="substitution_assigned",
        role="student",
        link="/student"
    )

    return _to_leave_response(leave, db)
