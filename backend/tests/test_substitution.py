import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User, UserRole
from app.models.department import Department, Shift
from app.models.room import Room
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.batch import Batch
from app.models.timetable import TimetableVersion, TimetableSlot, TimetableStatus
from app.models.leave import FacultyLeave, LeaveStatus
from app.auth.jwt import create_access_token
from tests.conftest import TestingSessionLocal

client = TestClient(app)

def _get_token(email="admin@test.com", role=UserRole.admin, linked_faculty_id=None):
    db = TestingSessionLocal()
    user = User(email=email, password_hash="fakehash", role=role, linked_faculty_id=linked_faculty_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    db.close()
    return token

def test_leave_application_and_approval():
    db = TestingSessionLocal()
    token = _get_token("hod@test.com", UserRole.hod)
    headers = {"Authorization": f"Bearer {token}"}

    dept = Department(name="IT", shift=Shift.morning)
    db.add(dept)
    db.flush()

    fac = Faculty(name="Prof. Sharma", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    db.add(fac)
    db.commit()

    target_date = date.today() + timedelta(days=3)

    # 1. Apply for leave
    apply_res = client.post("/api/leaves", json={
        "faculty_id": fac.id,
        "date": target_date.isoformat()
    }, headers=headers)
    assert apply_res.status_code == 201
    leave_data = apply_res.json()
    assert leave_data["status"] == "pending"
    assert leave_data["faculty_id"] == fac.id
    leave_id = leave_data["id"]

    # 2. Approve leave
    app_res = client.post(f"/api/leaves/{leave_id}/approve", headers=headers)
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "approved"

    # 3. Reject leave
    rej_res = client.post(f"/api/leaves/{leave_id}/reject", headers=headers)
    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "rejected"

def test_intelligent_substitute_recommendation_and_assignment():
    """
    Sets up:
    - Faculty A: Absent teacher
    - Faculty B: Qualified, current weekly load = 2
    - Faculty C: Qualified, current weekly load = 8
    - Faculty D: NOT qualified
    Verifies:
    1. Faculty D is excluded.
    2. Faculty B is ranked higher than Faculty C (lower workload equity).
    3. Assignment transitions leave to substituted status.
    """
    db = TestingSessionLocal()
    token = _get_token("hod2@test.com", UserRole.hod)
    headers = {"Authorization": f"Bearer {token}"}

    dept = Department(name="Computer Eng", shift=Shift.morning)
    db.add(dept)
    db.flush()

    room = Room(name="LH-1", capacity=60, is_lab=False, department_id=dept.id)
    sub_math = Subject(name="Discrete Math", department_id=dept.id, semester=3, sessions_per_week=3, is_lab=False)
    sub_physics = Subject(name="Physics", department_id=dept.id, semester=3, sessions_per_week=3, is_lab=False)
    batch = Batch(name="CE-3", department_id=dept.id, semester=3, shift=Shift.morning, strength=40)
    db.add_all([room, sub_math, sub_physics, batch])
    db.flush()

    # Faculty A (absent)
    fac_a = Faculty(name="Dr. Euler", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    fac_a.subjects = [sub_math]

    # Faculty B (qualified, low load)
    fac_b = Faculty(name="Dr. Gauss", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    fac_b.subjects = [sub_math]

    # Faculty C (qualified, higher load)
    fac_c = Faculty(name="Dr. Newton", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    fac_c.subjects = [sub_math]

    # Faculty D (unqualified)
    fac_d = Faculty(name="Dr. Faraday", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    fac_d.subjects = [sub_physics]

    db.add_all([fac_a, fac_b, fac_c, fac_d])
    db.flush()

    # Setup approved timetable version
    v = TimetableVersion(department_id=dept.id, semester=3, status=TimetableStatus.approved, option_rank=1, score=1.0)
    db.add(v)
    db.flush()

    # Slot for Faculty A on Monday (day 0), Period 1
    slot_a = TimetableSlot(timetable_version_id=v.id, day=0, period=1, room_id=room.id, subject_id=sub_math.id, faculty_id=fac_a.id, batch_id=batch.id)
    
    # 2 slots for Faculty B across the week
    slot_b1 = TimetableSlot(timetable_version_id=v.id, day=1, period=2, room_id=room.id, subject_id=sub_math.id, faculty_id=fac_b.id, batch_id=batch.id)
    slot_b2 = TimetableSlot(timetable_version_id=v.id, day=2, period=3, room_id=room.id, subject_id=sub_math.id, faculty_id=fac_b.id, batch_id=batch.id)

    # 6 slots for Faculty C across the week
    slots_c = [
        TimetableSlot(timetable_version_id=v.id, day=d, period=p, room_id=room.id, subject_id=sub_math.id, faculty_id=fac_c.id, batch_id=batch.id)
        for d in [1, 2, 3] for p in [1, 2]
    ]

    db.add_all([slot_a, slot_b1, slot_b2] + slots_c)
    db.commit()

    # Target Monday date
    today = date.today()
    days_until_monday = (0 - today.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    target_monday = today + timedelta(days=days_until_monday)

    # Faculty A applies for leave on target_monday
    leave = FacultyLeave(faculty_id=fac_a.id, date=target_monday, status=LeaveStatus.approved)
    db.add(leave)
    db.commit()

    # Request recommendations
    rec_res = client.get(f"/api/leaves/{leave.id}/recommendations", headers=headers)
    assert rec_res.status_code == 200
    rec_data = rec_res.json()

    assert rec_data["total_slots"] == 1
    slot_rec = rec_data["affected_slots"][0]
    candidate_ids = [c["faculty_id"] for c in slot_rec["candidates"]]

    # Assert unqualified Faculty D is excluded
    assert fac_d.id not in candidate_ids

    # Assert both B and C are present
    assert fac_b.id in candidate_ids
    assert fac_c.id in candidate_ids

    # Assert Faculty B is ranked #1 (higher score) due to lower workload
    assert slot_rec["candidates"][0]["faculty_id"] == fac_b.id
    assert slot_rec["candidates"][0]["rank_score"] > slot_rec["candidates"][1]["rank_score"]

    # Assign Faculty B as substitute
    sub_res = client.post(f"/api/leaves/{leave.id}/substitute", json={
        "substitute_faculty_id": fac_b.id
    }, headers=headers)
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] == "substituted"
    assert sub_res.json()["substitute_faculty_id"] == fac_b.id

def test_faculty_personal_schedule():
    db = TestingSessionLocal()
    token = _get_token("faculty_user@test.com", UserRole.faculty)
    headers = {"Authorization": f"Bearer {token}"}

    dept = Department(name="Chemical Eng", shift=Shift.morning)
    db.add(dept)
    db.flush()

    fac = Faculty(name="Dr. Haber", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    room = Room(name="LH-Chem", capacity=50, is_lab=False, department_id=dept.id)
    subj = Subject(name="Kinetics", department_id=dept.id, semester=4, sessions_per_week=2, is_lab=False)
    batch = Batch(name="CH-4", department_id=dept.id, semester=4, shift=Shift.morning, strength=30)
    db.add_all([fac, room, subj, batch])
    db.flush()

    v = TimetableVersion(department_id=dept.id, semester=4, status=TimetableStatus.approved, option_rank=1, score=1.0)
    db.add(v)
    db.flush()

    slot1 = TimetableSlot(timetable_version_id=v.id, day=1, period=2, room_id=room.id, subject_id=subj.id, faculty_id=fac.id, batch_id=batch.id)
    slot2 = TimetableSlot(timetable_version_id=v.id, day=3, period=4, room_id=room.id, subject_id=subj.id, faculty_id=fac.id, batch_id=batch.id)
    db.add_all([slot1, slot2])
    db.commit()

    # Query schedule for this faculty member
    res = client.get(f"/api/faculty/{fac.id}/schedule", headers=headers)
    assert res.status_code == 200
    slots = res.json()
    assert len(slots) == 2
    assert slots[0]["faculty_name"] == "Dr. Haber"
    assert slots[0]["subject_name"] == "Kinetics"
