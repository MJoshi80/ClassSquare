import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User, UserRole
from app.models.department import Department, Shift
from app.models.room import Room
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.batch import Batch
from app.models.timetable import TimetableVersion, TimetableSlot, TimetableStatus
from app.models.approval import ApprovalLog, ApprovalAction
from app.auth.jwt import create_access_token
from tests.conftest import TestingSessionLocal

client = TestClient(app)

def _get_hod_token():
    db = TestingSessionLocal()
    hod = User(email="hod@test.com", password_hash="fakehash", role=UserRole.hod)
    db.add(hod)
    db.commit()
    db.refresh(hod)
    token = create_access_token({"sub": str(hod.id), "role": hod.role.value})
    db.close()
    return token

def test_approve_and_reject_workflow():
    db = TestingSessionLocal()
    token = _get_hod_token()
    headers = {"Authorization": f"Bearer {token}"}

    dept = Department(name="Electronics", shift=Shift.morning)
    db.add(dept)
    db.flush()

    # Create dummy timetable version
    v1 = TimetableVersion(department_id=dept.id, semester=4, status=TimetableStatus.draft, option_rank=1, score=10.0)
    db.add(v1)
    db.commit()

    # 1. Approve
    res = client.post(f"/api/timetable/{v1.id}/approve", json={"comment": "LGTM! Approved for publish."}, headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "approved"

    # Verify log
    logs_res = client.get(f"/api/timetable/{v1.id}/logs", headers=headers)
    assert logs_res.status_code == 200
    assert len(logs_res.json()) == 1
    assert logs_res.json()[0]["action"] == "approved"
    assert logs_res.json()[0]["comment"] == "LGTM! Approved for publish."

    # 2. Reject
    res_rej = client.post(f"/api/timetable/{v1.id}/reject", json={"comment": "Needs adjustments on lab slots."}, headers=headers)
    assert res_rej.status_code == 200
    assert res_rej.json()["status"] == "rejected"

def test_simulate_edit_clash_detection():
    """
    Tests what-if simulation:
    Slot 1: Batch 1 in Room A with Faculty 1 at Day 0, Period 1
    Slot 2: Batch 2 in Room B with Faculty 2 at Day 0, Period 1
    Try to move Slot 2 into Room A or assign to Faculty 1 -> MUST detect collision instantly.
    """
    db = TestingSessionLocal()
    token = _get_hod_token()
    headers = {"Authorization": f"Bearer {token}"}

    dept = Department(name="Civil Eng", shift=Shift.morning)
    db.add(dept)
    db.flush()

    room_a = Room(name="LH-A", capacity=60, is_lab=False, department_id=dept.id)
    room_b = Room(name="LH-B", capacity=60, is_lab=False, department_id=dept.id)
    db.add_all([room_a, room_b])
    db.flush()

    sub1 = Subject(name="Fluid Mechanics", department_id=dept.id, semester=4, sessions_per_week=3, is_lab=False)
    sub2 = Subject(name="Structural Analysis", department_id=dept.id, semester=4, sessions_per_week=3, is_lab=False)
    db.add_all([sub1, sub2])
    db.flush()

    fac1 = Faculty(name="Dr. Euler", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    fac1.subjects = [sub1]
    fac2 = Faculty(name="Dr. Bernoulli", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    fac2.subjects = [sub2]
    db.add_all([fac1, fac2])
    db.flush()

    b1 = Batch(name="CE-4A", department_id=dept.id, semester=4, shift=Shift.morning, strength=50)
    b2 = Batch(name="CE-4B", department_id=dept.id, semester=4, shift=Shift.morning, strength=50)
    db.add_all([b1, b2])
    db.flush()

    v = TimetableVersion(department_id=dept.id, semester=4, status=TimetableStatus.draft, option_rank=1, score=5.0)
    db.add(v)
    db.flush()

    # Slot 1
    s1 = TimetableSlot(timetable_version_id=v.id, day=0, period=1, room_id=room_a.id, subject_id=sub1.id, faculty_id=fac1.id, batch_id=b1.id)
    # Slot 2
    s2 = TimetableSlot(timetable_version_id=v.id, day=0, period=2, room_id=room_b.id, subject_id=sub2.id, faculty_id=fac2.id, batch_id=b2.id)
    db.add_all([s1, s2])
    db.commit()

    # Test 1: Moving Slot 2 to Day 0, Period 1 with Room A -> Room collision with Slot 1!
    sim_payload = {
        "slot_id": s2.id,
        "new_day": 0,
        "new_period": 1,
        "new_room_id": room_a.id
    }
    res = client.post(f"/api/timetable/{v.id}/simulate-edit", json=sim_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["has_clashes"] is True
    assert any("Room collision" in msg for msg in data["clash_messages"])

    # Test 2: Assigning Faculty 1 to Slot 2 at Day 0, Period 1 -> Faculty collision!
    sim_payload_fac = {
        "slot_id": s2.id,
        "new_day": 0,
        "new_period": 1,
        "new_faculty_id": fac1.id
    }
    res_fac = client.post(f"/api/timetable/{v.id}/simulate-edit", json=sim_payload_fac, headers=headers)
    assert res_fac.status_code == 200
    data_fac = res_fac.json()
    assert data_fac["has_clashes"] is True
    assert any("Faculty collision" in msg for msg in data_fac["clash_messages"])

    # Test 3: Valid move to free slot (Day 1, Period 1)
    sim_valid = {
        "slot_id": s2.id,
        "new_day": 1,
        "new_period": 1,
        "new_room_id": room_b.id,
        "new_faculty_id": fac2.id
    }
    res_val = client.post(f"/api/timetable/{v.id}/simulate-edit", json=sim_valid, headers=headers)
    assert res_val.status_code == 200
    data_val = res_val.json()
    assert data_val["has_clashes"] is False
    assert data_val["is_valid_change"] is True
