from app.services.notification_service import create_notification
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.timetable import TimetableVersion, TimetableSlot, TimetableStatus
from app.models.approval import ApprovalLog, ApprovalAction
from app.models.room import Room
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.batch import Batch
from app.models.user import User, UserRole
from app.models.department import Shift
from app.schemas.timetable import (
    TimetableGenerateRequest, TimetableGenerateResponse,
    TimetableOptionResponse, TimetableSlotResponse,
    ApprovalActionRequest, ApprovalLogResponse,
    SimulateEditRequest, SimulateEditResponse, SlotUpdateRequest
)
from app.solver.scheduler import generate_timetable_options
from app.solver.evaluator import evaluate_schedule_metrics
from app.auth.dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/timetable", tags=["Timetable Engine"])

def _format_version_response(version: TimetableVersion) -> TimetableOptionResponse:
    slots_resp = []
    for s in version.slots:
        slots_resp.append(TimetableSlotResponse(
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
        ))

    eval_metrics = evaluate_schedule_metrics(
        slots=version.slots or [],
        option_rank=version.option_rank or 1,
        score_override=version.score
    )
    score = eval_metrics['score']
    focus = version.optimization_focus or eval_metrics['optimization_focus']

    return TimetableOptionResponse(
        id=version.id,
        department_id=version.department_id,
        department_name=version.department.name if version.department else None,
        semester=version.semester,
        option_rank=version.option_rank or 1,
        score=score,
        status=version.status,
        generated_at=version.generated_at,
        clash_count=0,
        total_slots=len(slots_resp),
        optimization_focus=focus,
        tagline=eval_metrics.get('tagline'),
        top_optimized_constraints=eval_metrics.get('top_optimized_constraints'),
        student_centric_points=eval_metrics.get('student_centric_points'),
        constraint_breakdown=eval_metrics.get('constraint_breakdown'),
        metrics_summary=eval_metrics.get('metrics_summary'),
        slots=slots_resp
    )

@router.post("/generate", response_model=TimetableGenerateResponse)
def generate_timetable(
    req: TimetableGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    result = generate_timetable_options(
        db=db,
        department_id=req.department_id,
        semester=req.semester,
        shift=req.shift,
        num_options=3
    )
    return result

@router.get("/versions", response_model=List[TimetableOptionResponse])
def get_timetable_versions(
    department_id: Optional[int] = None,
    semester: Optional[int] = None,
    status: Optional[TimetableStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TimetableVersion)
    if department_id is not None:
        query = query.filter(TimetableVersion.department_id == department_id)
    if semester is not None:
        query = query.filter(TimetableVersion.semester == semester)
    if status is not None:
        query = query.filter(TimetableVersion.status == status)
    versions = query.order_by(TimetableVersion.generated_at.desc()).all()
    if department_id is not None and semester is not None:
        rank_map = {}
        for v in versions:
            rank = v.option_rank or 1
            if rank in (1, 2, 3) and rank not in rank_map:
                rank_map[rank] = v
        versions = [rank_map[r] for r in sorted(rank_map.keys())][:3]
    return [_format_version_response(v) for v in versions]

@router.get("/{id}", response_model=TimetableOptionResponse)
def get_timetable_version(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    version = db.query(TimetableVersion).filter(TimetableVersion.id == id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Timetable version not found")
    return _format_version_response(version)

@router.post("/{id}/approve", response_model=TimetableOptionResponse)
def approve_timetable(
    id: int,
    req: ApprovalActionRequest = ApprovalActionRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    version = db.query(TimetableVersion).filter(TimetableVersion.id == id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Timetable version not found")

    # Mark previously approved versions for this same department/semester back to draft/archived
    if version.department_id:
        prev_approved = db.query(TimetableVersion).filter(
            TimetableVersion.department_id == version.department_id,
            TimetableVersion.semester == version.semester,
            TimetableVersion.status == TimetableStatus.approved,
            TimetableVersion.id != version.id
        ).all()
        for p in prev_approved:
            p.status = TimetableStatus.draft

    version.status = TimetableStatus.approved

    # Write to ApprovalLog
    log = ApprovalLog(
        timetable_version_id=version.id,
        reviewer_id=current_user.id,
        action=ApprovalAction.approved,
        comment=req.comment or "Timetable approved and published.",
        timestamp=datetime.utcnow()
    )
    db.add(log)
    db.commit()
    db.refresh(version)

    dept_name = version.department.name if version.department else "Department"

    # 1. Student Academic Schedule & Voting Closed Alert
    create_notification(
        db=db,
        title=f"Timetable Approved: Voting Closed ({dept_name} Sem {version.semester})",
        message=f"Official timetable Option {version.option_rank} has been approved by the HOD. Student voting has concluded and schedule is now live.",
        type="timetable_published",
        role="student",
        link="/student"
    )
    # 2. Student Study-Gap Productivity Alert
    create_notification(
        db=db,
        title=f"Study-Gap Productivity Windows: Sem {version.semester}",
        message="Your schedule includes designated study gaps for library access and self-study.",
        type="study_gap",
        role="student",
        link="/student"
    )
    # 3. Faculty Teaching Schedule Alert
    create_notification(
        db=db,
        title=f"Teaching Schedule Active: {dept_name} Sem {version.semester}",
        message="Official timetable is now active. Weekly teaching hours and room allocations are synchronized.",
        type="timetable_published",
        role="faculty",
        link="/faculty"
    )
    # 4. HOD Departmental Status Alert
    create_notification(
        db=db,
        title=f"Department Timetable Approved: {dept_name} Sem {version.semester}",
        message="Official semester schedule has been approved and published for departmental cohorts.",
        type="timetable_published",
        role="hod",
        link="/hod"
    )
    # 5. Admin Technical Optimization Notice (Admin-only)
    create_notification(
        db=db,
        title=f"Optimization Engine: Timetable Published ({dept_name} Sem {version.semester})",
        message=f"Schedule Option {version.option_rank} approved by {current_user.email}. Solver validated with 0 room/faculty clashes.",
        type="system",
        role="admin",
        link="/admin"
    )

    return _format_version_response(version)

@router.post("/{id}/reject", response_model=TimetableOptionResponse)
def reject_timetable(
    id: int,
    req: ApprovalActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    version = db.query(TimetableVersion).filter(TimetableVersion.id == id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Timetable version not found")

    version.status = TimetableStatus.rejected

    log = ApprovalLog(
        timetable_version_id=version.id,
        reviewer_id=current_user.id,
        action=ApprovalAction.rejected,
        comment=req.comment or "Timetable rejected by reviewer.",
        timestamp=datetime.utcnow()
    )
    db.add(log)
    db.commit()
    db.refresh(version)

    dept_name = version.department.name if version.department else "Department"
    # HOD notification - non-technical academic review note
    create_notification(
        db=db,
        title=f"Timetable Revision Requested: {dept_name} Sem {version.semester}",
        message=f"Schedule draft was returned for revision. Reviewer note: {req.comment or 'Please review slot distribution.'}",
        type="timetable_rejected",
        role="hod",
        link="/hod"
    )
    # Admin notification - technical solver & audit notice (Admin-only)
    create_notification(
        db=db,
        title=f"Solver Audit: Timetable Rejected ({dept_name} Sem {version.semester})",
        message=f"Option {version.option_rank} rejected by {current_user.email}. Reason: {req.comment or 'Revision required.'}",
        type="system",
        role="admin",
        link="/admin"
    )

    return _format_version_response(version)

@router.get("/{id}/logs", response_model=List[ApprovalLogResponse])
def get_approval_logs(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logs = db.query(ApprovalLog).filter(ApprovalLog.timetable_version_id == id).order_by(ApprovalLog.timestamp.desc()).all()
    resp = []
    for l in logs:
        reviewer = db.query(User).filter(User.id == l.reviewer_id).first()
        resp.append(ApprovalLogResponse(
            id=l.id,
            timetable_version_id=l.timetable_version_id,
            reviewer_id=l.reviewer_id,
            reviewer_email=reviewer.email if reviewer else "reviewer",
            action=l.action,
            comment=l.comment,
            timestamp=l.timestamp
        ))
    return resp

@router.post("/{id}/simulate-edit", response_model=SimulateEditResponse)
def simulate_edit_slot(
    id: int,
    req: SimulateEditRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    """
    Instant local clash check when an HOD manually overrides a slot in the What-If Sandbox.
    Validates hard constraints without needing a full CP-SAT solver re-run.
    """
    version = db.query(TimetableVersion).filter(TimetableVersion.id == id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Timetable version not found")

    target_slot = db.query(TimetableSlot).filter(
        TimetableSlot.id == req.slot_id,
        TimetableSlot.timetable_version_id == id
    ).first()
    if not target_slot:
        raise HTTPException(status_code=404, detail="Slot not found in this timetable version")

    candidate_day = req.new_day if req.new_day is not None else target_slot.day
    candidate_period = req.new_period if req.new_period is not None else target_slot.period
    candidate_room_id = req.new_room_id if req.new_room_id is not None else target_slot.room_id
    candidate_faculty_id = req.new_faculty_id if req.new_faculty_id is not None else target_slot.faculty_id

    clashes = []

    room = db.query(Room).filter(Room.id == candidate_room_id).first()
    faculty = db.query(Faculty).filter(Faculty.id == candidate_faculty_id).first()
    batch = db.query(Batch).filter(Batch.id == target_slot.batch_id).first()
    subject = db.query(Subject).filter(Subject.id == target_slot.subject_id).first()

    # 1. Capacity check
    if room and batch and room.capacity < batch.strength:
        clashes.append(f"Capacity shortfall: Room '{room.name}' (cap {room.capacity}) cannot accommodate Batch '{batch.name}' ({batch.strength} students).")

    # 2. Lab suitability check
    if subject and subject.is_lab and room and not room.is_lab:
        clashes.append(f"Room type mismatch: Subject '{subject.name}' is a lab subject but '{room.name}' is not designated as a laboratory.")

    # 3. Faculty qualification check
    if faculty and subject:
        is_qualified = any(s.id == subject.id for s in faculty.subjects)
        if not is_qualified:
            clashes.append(f"Qualification mismatch: Instructor '{faculty.name}' is not qualified to teach '{subject.name}'.")

    # 4. Other slots in this version at candidate (day, period)
    other_slots = db.query(TimetableSlot).filter(
        TimetableSlot.timetable_version_id == id,
        TimetableSlot.id != target_slot.id,
        TimetableSlot.day == candidate_day,
        TimetableSlot.period == candidate_period
    ).all()

    for s in other_slots:
        if s.room_id == candidate_room_id:
            other_b = s.batch.name if s.batch else f"Batch {s.batch_id}"
            clashes.append(f"Room collision: Room '{room.name}' is already occupied by {other_b} at Day {candidate_day}, Period {candidate_period}.")
        if s.faculty_id == candidate_faculty_id:
            other_sub = s.subject.name if s.subject else f"Subject {s.subject_id}"
            clashes.append(f"Faculty collision: Instructor '{faculty.name}' is already teaching {other_sub} at Day {candidate_day}, Period {candidate_period}.")
        if s.batch_id == target_slot.batch_id:
            other_sub = s.subject.name if s.subject else f"Subject {s.subject_id}"
            clashes.append(f"Batch collision: Batch '{batch.name}' already has {other_sub} scheduled at Day {candidate_day}, Period {candidate_period}.")

    return SimulateEditResponse(
        has_clashes=len(clashes) > 0,
        clash_messages=clashes,
        is_valid_change=len(clashes) == 0
    )

@router.put("/slots/{slot_id}", response_model=TimetableSlotResponse)
def update_timetable_slot(
    slot_id: int,
    req: SlotUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    slot = db.query(TimetableSlot).filter(TimetableSlot.id == slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    if req.room_id is not None:
        r = db.query(Room).filter(Room.id == req.room_id).first()
        if not r:
            raise HTTPException(status_code=400, detail="Invalid room ID")
        slot.room_id = req.room_id

    if req.faculty_id is not None:
        f = db.query(Faculty).filter(Faculty.id == req.faculty_id).first()
        if not f:
            raise HTTPException(status_code=400, detail="Invalid faculty ID")
        slot.faculty_id = req.faculty_id

    if req.day is not None:
        slot.day = req.day
    if req.period is not None:
        slot.period = req.period

    db.commit()
    db.refresh(slot)

    return TimetableSlotResponse(
        id=slot.id,
        day=slot.day,
        period=slot.period,
        room_id=slot.room_id,
        room_name=slot.room.name if slot.room else "Room",
        subject_id=slot.subject_id,
        subject_name=slot.subject.name if slot.subject else "Subject",
        faculty_id=slot.faculty_id,
        faculty_name=slot.faculty.name if slot.faculty else "Faculty",
        batch_id=slot.batch_id,
        batch_name=slot.batch.name if slot.batch else "Batch",
        is_lab=slot.subject.is_lab if slot.subject else False
    )

@router.get("/batch/{batch_id}")
def get_batch_schedule(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    version = (
        db.query(TimetableVersion)
        .filter(
            TimetableVersion.department_id == batch.department_id,
            TimetableVersion.semester == batch.semester,
            TimetableVersion.status == TimetableStatus.approved
        )
        .first()
    )
    if not version:
        version = (
            db.query(TimetableVersion)
            .filter(
                TimetableVersion.department_id == batch.department_id,
                TimetableVersion.semester == batch.semester
            )
            .order_by(TimetableVersion.id.desc())
            .first()
        )

    if not version:
        return {
            "batch_id": batch.id,
            "batch_name": batch.name,
            "department_name": batch.department.name if batch.department else None,
            "semester": batch.semester,
            "timetable_id": None,
            "status": "none",
            "total_classes": 0,
            "free_periods": 30,
            "total_gap_periods": 0,
            "gap_hours": 0,
            "longest_break": 0,
            "daily_gap_analysis": [],
            "gap_analysis": [],
            "slots": []
        }

    slots_resp = []
    day_slots = {d: [] for d in range(5)}
    for s in version.slots:
        if s.batch_id == batch_id:
            day_slots[s.day].append(s.period)
            slots_resp.append(TimetableSlotResponse(
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
                batch_name=batch.name,
                is_lab=s.subject.is_lab if s.subject else False
            ))

    days_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    morning_times = ["09:00 - 10:00", "10:00 - 11:00", "11:15 - 12:15", "12:15 - 01:15", "02:00 - 03:00", "03:00 - 04:00"]
    evening_times = ["01:00 - 02:00", "02:00 - 03:00", "03:15 - 04:15", "04:15 - 05:15", "05:30 - 06:30", "06:30 - 07:30"]
    is_evening = getattr(batch, "shift", None) == Shift.evening
    p_times = evening_times if is_evening else morning_times

    daily_gap_analysis = []
    gap_analysis = []
    total_gaps = 0
    longest_gap = 0

    for d in range(5):
        scheduled = sorted(day_slots[d])
        gaps = []
        if len(scheduled) > 1:
            for p in range(min(scheduled) + 1, max(scheduled)):
                if p not in scheduled:
                    gaps.append(p)
        if len(gaps) > longest_gap:
            longest_gap = len(gaps)
        total_gaps += len(gaps)

        daily_gap_analysis.append({
            "day": d,
            "day_name": days_names[d],
            "scheduled_count": len(scheduled),
            "scheduled_periods": scheduled,
            "gap_periods": gaps,
            "gap_count": len(gaps)
        })

        if gaps:
            time_windows = []
            for p in gaps:
                idx = p - 1 if p >= 1 else p
                if 0 <= idx < len(p_times):
                    time_windows.append(f"Period {p} ({p_times[idx]})")
                else:
                    time_windows.append(f"Period {p}")
            gap_analysis.append({
                "day": days_names[d],
                "gap_periods": len(gaps),
                "time_window": ", ".join(time_windows)
            })

    return {
        "batch_id": batch.id,
        "batch_name": batch.name,
        "department_name": batch.department.name if batch.department else None,
        "semester": batch.semester,
        "timetable_id": version.id,
        "status": version.status,
        "total_classes": len(slots_resp),
        "free_periods": 30 - len(slots_resp),
        "total_gap_periods": total_gaps,
        "gap_hours": total_gaps,
        "longest_break": longest_gap,
        "daily_gap_analysis": daily_gap_analysis,
        "gap_analysis": gap_analysis,
        "slots": slots_resp
    }
