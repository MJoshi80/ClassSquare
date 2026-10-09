import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User, UserRole
from app.models.department import Department, Shift
from app.models.room import Room
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.batch import Batch
from app.auth.jwt import create_access_token
from tests.conftest import TestingSessionLocal

client = TestClient(app)

def _get_admin_token():
    db = TestingSessionLocal()
    admin = User(email="admin@test.com", password_hash="fakehash", role=UserRole.admin)
    db.add(admin)
    db.commit()
    db.refresh(admin)
    token = create_access_token({"sub": str(admin.id), "role": admin.role.value})
    db.close()
    return token

def test_generate_timetable_success_zero_clashes():
    db = TestingSessionLocal()
    token = _get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    dept = Department(name="Computer Science", shift=Shift.morning)
    db.add(dept)
    db.flush()

    room_lh = Room(name="LH-101", capacity=60, is_lab=False, department_id=dept.id)
    room_lab = Room(name="Lab-1", capacity=40, is_lab=True, department_id=dept.id)
    db.add_all([room_lh, room_lab])
    db.flush()

    sub_algo = Subject(name="Algorithms", department_id=dept.id, semester=3, sessions_per_week=3, is_lab=False)
    sub_os = Subject(name="Operating Systems", department_id=dept.id, semester=3, sessions_per_week=3, is_lab=False)
    sub_os_lab = Subject(name="OS Lab", department_id=dept.id, semester=3, sessions_per_week=2, is_lab=True)
    db.add_all([sub_algo, sub_os, sub_os_lab])
    db.flush()

    fac1 = Faculty(name="Dr. Turing", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    fac1.subjects = [sub_algo]

    fac2 = Faculty(name="Dr. Ritchie", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    fac2.subjects = [sub_os, sub_os_lab]

    db.add_all([fac1, fac2])
    db.flush()

    batch = Batch(name="CS-3A", department_id=dept.id, semester=3, shift=Shift.morning, strength=35)
    db.add(batch)
    db.commit()

    payload = {"department_id": dept.id, "semester": 3}
    res = client.post("/api/timetable/generate", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "SUCCESS"
    assert len(data["options"]) >= 1

    option = data["options"][0]
    assert option["clash_count"] == 0
    slots = option["slots"]
    assert len(slots) == (3 + 3 + 2)

    # 1. No faculty double-booked
    faculty_time_slots = [(s["faculty_id"], s["day"], s["period"]) for s in slots]
    assert len(faculty_time_slots) == len(set(faculty_time_slots))

    # 2. No room double-booked
    room_time_slots = [(s["room_id"], s["day"], s["period"]) for s in slots]
    assert len(room_time_slots) == len(set(room_time_slots))

    # 3. No batch double-booked
    batch_time_slots = [(s["batch_id"], s["day"], s["period"]) for s in slots]
    assert len(batch_time_slots) == len(set(batch_time_slots))

    # 4. Lab subject placed in lab room
    for s in slots:
        if s["is_lab"]:
            assert s["room_id"] == room_lab.id

    # 5. Optimization score and constraint breakdown assertions
    assert option["score"] >= 80.0
    assert option["optimization_focus"] is not None
    assert len(option["optimization_focus"]) > 0
    assert option["top_optimized_constraints"] is not None
    assert len(option["top_optimized_constraints"]) >= 3
    assert option["constraint_breakdown"] is not None
    assert "student_continuity" in option["constraint_breakdown"]
    assert "faculty_compactness" in option["constraint_breakdown"]

def test_generate_timetable_infeasible_diagnostics():
    db = TestingSessionLocal()
    token = _get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    dept = Department(name="Mechanical Eng", shift=Shift.morning)
    db.add(dept)
    db.flush()

    room_small = Room(name="LH-Small", capacity=40, is_lab=False, department_id=dept.id)
    db.add(room_small)
    db.flush()

    subj = Subject(name="Thermodynamics", department_id=dept.id, semester=3, sessions_per_week=3, is_lab=False)
    db.add(subj)
    db.flush()

    fac = Faculty(name="Dr. Carnot", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    fac.subjects = [subj]
    db.add(fac)
    db.flush()

    batch_huge = Batch(name="ME-Large", department_id=dept.id, semester=3, shift=Shift.morning, strength=75)
    db.add(batch_huge)
    db.commit()

    payload = {"department_id": dept.id, "semester": 3}
    res = client.post("/api/timetable/generate", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "INFEASIBLE"
    assert len(data["options"]) == 0
    assert data["diagnostic_suggestions"] is not None
    assert len(data["diagnostic_suggestions"]) > 0
    assert any("Room capacity bottleneck" in s or "exceeds" in s for s in data["diagnostic_suggestions"])
