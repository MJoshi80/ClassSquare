from typing import List, Dict, Any, Optional
from datetime import date
from sqlalchemy.orm import Session
from app.models.leave import FacultyLeave, LeaveStatus
from app.models.faculty import Faculty
from app.models.timetable import TimetableVersion, TimetableSlot, TimetableStatus
from app.models.department import Department
from app.schemas.leave import (
    LeaveRecommendationResponse, SlotSubstitutionRecommendation, SubstituteCandidate
)

DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

def get_active_timetable_versions(db: Session, department_id: Optional[int] = None) -> List[TimetableVersion]:
    """
    Returns approved timetable versions. If none approved, falls back to latest draft.
    """
    query = db.query(TimetableVersion)
    if department_id:
        query = query.filter(TimetableVersion.department_id == department_id)
    
    approved = query.filter(TimetableVersion.status == TimetableStatus.approved).all()
    if approved:
        return approved
    
    # Fallback to draft versions
    return query.filter(TimetableVersion.status == TimetableStatus.draft).all()

def find_substitute_recommendations(
    db: Session,
    leave: FacultyLeave
) -> LeaveRecommendationResponse:
    """
    Evaluates all slots for the absent faculty on leave.date,
    filtering for qualified, clash-free instructors and ranking by lowest weekly load.
    """
    absent_faculty = db.query(Faculty).filter(Faculty.id == leave.faculty_id).first()
    if not absent_faculty:
        raise ValueError(f"Faculty with ID {leave.faculty_id} not found.")

    weekday_idx = leave.date.weekday()
    weekday_name = DAYS_OF_WEEK[weekday_idx] if weekday_idx < len(DAYS_OF_WEEK) else "Unknown"

    # If weekend, no regular classes scheduled
    if weekday_idx > 4:
        return LeaveRecommendationResponse(
            leave_id=leave.id,
            faculty_id=leave.faculty_id,
            faculty_name=absent_faculty.name,
            date=leave.date,
            weekday_name=weekday_name,
            affected_slots=[],
            total_slots=0
        )

    # 1. Fetch relevant timetable versions
    active_versions = get_active_timetable_versions(db, absent_faculty.department_id)
    version_ids = [v.id for v in active_versions]

    # 2. Find slots taught by absent faculty on this weekday
    slots_query = db.query(TimetableSlot).filter(
        TimetableSlot.faculty_id == leave.faculty_id,
        TimetableSlot.day == weekday_idx
    )
    if version_ids:
        slots_query = slots_query.filter(TimetableSlot.timetable_version_id.in_(version_ids))
    absent_slots = slots_query.all()

    # 3. Pre-fetch faculty list for substitution checks
    all_faculty = db.query(Faculty).all()
    all_departments = {d.id: d for d in db.query(Department).all()}

    # Check who is on approved leave on this specific date
    leaves_on_date = db.query(FacultyLeave).filter(
        FacultyLeave.date == leave.date,
        FacultyLeave.status.in_([LeaveStatus.approved, LeaveStatus.substituted])
    ).all()
    faculty_on_leave_ids = {l.faculty_id for l in leaves_on_date}

    # Pre-calculate weekly workloads from active timetables
    # Map faculty_id -> total slots per week
    weekly_load_map = {f.id: 0 for f in all_faculty}
    daily_load_map = {f.id: 0 for f in all_faculty}

    all_slots_in_active = db.query(TimetableSlot).filter(
        TimetableSlot.timetable_version_id.in_(version_ids) if version_ids else True
    ).all()

    for s in all_slots_in_active:
        if s.faculty_id in weekly_load_map:
            weekly_load_map[s.faculty_id] += 1
            if s.day == weekday_idx:
                daily_load_map[s.faculty_id] += 1

    slot_recommendations: List[SlotSubstitutionRecommendation] = []

    for slot in absent_slots:
        subject_id = slot.subject_id
        period = slot.period

        candidates: List[SubstituteCandidate] = []

        for cand in all_faculty:
            # Rule 1: Cannot be the absent faculty
            if cand.id == leave.faculty_id:
                continue

            # Rule 2: Cannot be on approved leave on that date
            if cand.id in faculty_on_leave_ids:
                continue

            # Rule 3: Must be qualified to teach the subject
            is_qualified = any(s.id == subject_id for s in cand.subjects)
            if not is_qualified:
                continue

            # Rule 4: Must not be teaching another class at that day and period in active timetables
            busy_at_period = any(
                s.faculty_id == cand.id and s.day == weekday_idx and s.period == period
                for s in all_slots_in_active
            )
            if busy_at_period:
                continue

            # Rule 5: Daily load limit check
            current_daily = daily_load_map.get(cand.id, 0)
            if current_daily + 1 > cand.max_classes_per_day:
                continue

            # Rule 6: Weekly load limit check
            current_weekly = weekly_load_map.get(cand.id, 0)
            if current_weekly + 1 > cand.max_classes_per_week:
                continue

            # Candidate is feasible! Calculate ranking score
            is_same_dept = (cand.department_id == absent_faculty.department_id)
            load_ratio = current_weekly / max(cand.max_classes_per_week, 1)
            # Higher score = more recommended (lowest workload gives highest score)
            rank_score = round(100.0 - (load_ratio * 40.0) + (15.0 if is_same_dept else 0.0), 2)

            dept_name = all_departments.get(cand.department_id).name if cand.department_id in all_departments else "Department"

            candidates.append(SubstituteCandidate(
                faculty_id=cand.id,
                faculty_name=cand.name,
                department_id=cand.department_id,
                department_name=dept_name,
                current_weekly_load=current_weekly,
                max_classes_per_week=cand.max_classes_per_week,
                is_same_department=is_same_dept,
                rank_score=rank_score
            ))

        # Sort candidates by rank_score descending (lowest load + same dept first)
        candidates.sort(key=lambda c: c.rank_score, reverse=True)

        slot_recommendations.append(SlotSubstitutionRecommendation(
            slot_id=slot.id,
            day=slot.day,
            period=slot.period,
            subject_id=slot.subject_id,
            subject_name=slot.subject.name if slot.subject else "Subject",
            batch_id=slot.batch_id,
            batch_name=slot.batch.name if slot.batch else "Batch",
            room_id=slot.room_id,
            room_name=slot.room.name if slot.room else "Room",
            is_lab=slot.subject.is_lab if slot.subject else False,
            candidates=candidates
        ))

    return LeaveRecommendationResponse(
        leave_id=leave.id,
        faculty_id=leave.faculty_id,
        faculty_name=absent_faculty.name,
        date=leave.date,
        weekday_name=weekday_name,
        affected_slots=slot_recommendations,
        total_slots=len(slot_recommendations)
    )
