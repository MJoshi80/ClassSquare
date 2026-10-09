from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.user import User, UserRole
from app.models.department import Department
from app.models.timetable import TimetableVersion, TimetableSlot, TimetableStatus
from app.models.vote import TimetableVote
from app.schemas.voting import VotingSlateResponse, VotingOptionItem, VoteCastResponse
from app.schemas.timetable import TimetableOptionResponse, TimetableSlotResponse
from app.auth.dependencies import get_current_user, require_role
from app.solver.evaluator import evaluate_schedule_metrics

router = APIRouter(prefix="/api/timetable/voting", tags=["Timetable Voting"])

def _build_slate_response(db: Session, dept: Department, semester: int, current_user: User) -> VotingSlateResponse:
    # Fetch all versions for this cohort, ordered by newest first
    all_versions = db.query(TimetableVersion).filter(
        TimetableVersion.department_id == dept.id,
        TimetableVersion.semester == semester
    ).order_by(TimetableVersion.id.desc()).all()

    # Deduplicate strictly to the latest version for each option rank (1, 2, 3) - max 3 options
    rank_map = {}
    for v in all_versions:
        rank = v.option_rank or 1
        if rank in (1, 2, 3) and rank not in rank_map:
            rank_map[rank] = v
    
    versions = [rank_map[r] for r in sorted(rank_map.keys())][:3]

    approved_ver = next((v for v in versions if v.status == TimetableStatus.approved), None)
    is_open = (approved_ver is None) and len(versions) > 0

    votes = db.query(TimetableVote).filter(
        TimetableVote.department_id == dept.id,
        TimetableVote.semester == semester
    ).all()

    total_votes = len(votes)
    user_vote = next((v for v in votes if v.user_id == current_user.id), None)
    user_voted_id = user_vote.timetable_version_id if user_vote else None

    option_items = []
    for v in versions:
        v_votes = sum(1 for vote in votes if vote.timetable_version_id == v.id)
        pct = round((v_votes / total_votes * 100), 1) if total_votes > 0 else 0.0
        
        # Calculate schedule metrics for student preview
        slots = v.slots or []
        distinct_slots = set((s.day, s.period) for s in slots)
        free_count = max(0, 30 - len(distinct_slots))
        subject_names = list(set(s.subject.name for s in slots if s.subject))

        eval_metrics = evaluate_schedule_metrics(
            slots=slots,
            option_rank=v.option_rank or 1,
            score_override=v.score
        )

        option_items.append(VotingOptionItem(
            id=v.id,
            option_rank=v.option_rank or 1,
            score=eval_metrics['score'],
            status=v.status.value,
            vote_count=v_votes,
            vote_percentage=pct,
            is_user_vote=(user_voted_id == v.id),
            slot_count=len(slots),
            free_periods_count=free_count,
            preview_summary={
                "subjects": subject_names[:6],
                "active_days": len(set(s.day for s in slots)),
                "total_periods": len(slots)
            },
            optimization_focus=v.optimization_focus or eval_metrics['optimization_focus'],
            tagline=eval_metrics.get('tagline'),
            top_optimized_constraints=eval_metrics.get('top_optimized_constraints'),
            student_centric_points=eval_metrics.get('student_centric_points')
        ))

    return VotingSlateResponse(
        department_id=dept.id,
        department_name=dept.name,
        semester=semester,
        is_voting_open=is_open,
        approved_version_id=approved_ver.id if approved_ver else None,
        approved_option_rank=approved_ver.option_rank if approved_ver else None,
        total_votes=total_votes,
        user_voted_option_id=user_voted_id,
        options=option_items
    )

@router.get("/slate", response_model=VotingSlateResponse)
def get_voting_slate(
    department_id: int,
    semester: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    return _build_slate_response(db, dept, semester, current_user)

@router.post("/{version_id}/vote", response_model=VoteCastResponse)
def cast_timetable_vote(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.student, UserRole.admin))
):
    version = db.query(TimetableVersion).filter(TimetableVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Timetable option not found")

    dept = version.department
    if not dept:
        raise HTTPException(status_code=400, detail="Option is not associated with a department")

    # Department alignment check for students
    if current_user.role == UserRole.student and current_user.department_id is not None:
        if current_user.department_id != version.department_id:
            raise HTTPException(
                status_code=403,
                detail=f"You belong to {current_user.department.name if current_user.department else 'another department'} and can only vote on timetable options for your department."
            )

    # CRITICAL REQUIREMENT: Check if voting is closed due to HOD approval
    approved_exists = db.query(TimetableVersion).filter(
        TimetableVersion.department_id == version.department_id,
        TimetableVersion.semester == version.semester,
        TimetableVersion.status == TimetableStatus.approved
    ).first()

    if approved_exists:
        raise HTTPException(
            status_code=400,
            detail=f"Voting is closed. The official timetable (Option {approved_exists.option_rank}) has already been approved and published by the HOD."
        )

    # Record or update vote (1 vote per student per department & semester)
    existing_vote = db.query(TimetableVote).filter(
        TimetableVote.user_id == current_user.id,
        TimetableVote.department_id == version.department_id,
        TimetableVote.semester == version.semester
    ).first()

    if existing_vote:
        existing_vote.timetable_version_id = version.id
        existing_vote.voted_at = datetime.utcnow()
    else:
        new_vote = TimetableVote(
            user_id=current_user.id,
            timetable_version_id=version.id,
            department_id=version.department_id,
            semester=version.semester,
            voted_at=datetime.utcnow()
        )
        db.add(new_vote)

    db.commit()

    # Re-build updated slate
    slate = _build_slate_response(db, dept, version.semester, current_user)

    return VoteCastResponse(
        message=f"Vote successfully recorded for Option {version.option_rank}.",
        voted_version_id=version.id,
        slate=slate
    )

@router.get("/{version_id}/preview", response_model=TimetableOptionResponse)
def get_voting_option_preview(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    version = db.query(TimetableVersion).filter(TimetableVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Timetable option not found")

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

    return TimetableOptionResponse(
        id=version.id,
        department_id=version.department_id,
        department_name=version.department.name if version.department else None,
        semester=version.semester,
        option_rank=version.option_rank or 1,
        score=version.score or 0.0,
        status=version.status,
        generated_at=version.generated_at,
        clash_count=0,
        total_slots=len(slots_resp),
        slots=slots_resp
    )

