import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User, UserRole
from app.models.department import Department, Shift
from app.models.room import Room
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.batch import Batch
from app.models.timetable import TimetableVersion, TimetableSlot, TimetableStatus
from app.auth.jwt import create_access_token
from tests.conftest import TestingSessionLocal

client = TestClient(app)

def _create_user_token(email: str, role: UserRole, department_id: int | None = None):
    db = TestingSessionLocal()
    user = User(
        email=email,
        password_hash="fakehash",
        role=role,
        department_id=department_id
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    user_id = user.id
    db.close()
    return token, user_id

def _setup_departments():
    db = TestingSessionLocal()
    dept_cse = Department(name="Computer Science & Engineering", shift=Shift.morning)
    dept_me = Department(name="Mechanical Engineering", shift=Shift.evening)
    db.add_all([dept_cse, dept_me])
    db.commit()
    db.refresh(dept_cse)
    db.refresh(dept_me)
    dept_cse_id = dept_cse.id
    dept_me_id = dept_me.id
    db.close()
    return dept_cse_id, dept_me_id

def test_voting_slate_open_when_drafts_exist():
    dept_cse_id, _ = _setup_departments()
    db = TestingSessionLocal()

    # Create 2 candidate draft options
    v1 = TimetableVersion(department_id=dept_cse_id, semester=5, status=TimetableStatus.draft, option_rank=1, score=92.5)
    v2 = TimetableVersion(department_id=dept_cse_id, semester=5, status=TimetableStatus.draft, option_rank=2, score=88.0)
    db.add_all([v1, v2])
    db.commit()
    db.close()

    stu_token, _ = _create_user_token("stu.cse1@test.com", UserRole.student, department_id=dept_cse_id)
    headers = {"Authorization": f"Bearer {stu_token}"}

    res = client.get(f"/api/timetable/voting/slate?department_id={dept_cse_id}&semester=5", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["department_id"] == dept_cse_id
    assert data["semester"] == 5
    assert data["is_voting_open"] is True
    assert data["approved_version_id"] is None
    assert data["total_votes"] == 0
    assert data["user_voted_option_id"] is None
    assert len(data["options"]) == 2
    assert data["options"][0]["option_rank"] == 1
    assert data["options"][0]["vote_count"] == 0
    assert data["options"][0]["vote_percentage"] == 0.0
    assert data["options"][0]["is_user_vote"] is False

def test_student_cast_vote_and_update():
    dept_cse_id, _ = _setup_departments()
    db = TestingSessionLocal()

    v1 = TimetableVersion(department_id=dept_cse_id, semester=5, status=TimetableStatus.draft, option_rank=1, score=95.0)
    v2 = TimetableVersion(department_id=dept_cse_id, semester=5, status=TimetableStatus.draft, option_rank=2, score=89.0)
    db.add_all([v1, v2])
    db.commit()
    db.refresh(v1)
    db.refresh(v2)
    v1_id, v2_id = v1.id, v2.id
    db.close()

    stu1_token, stu1_id = _create_user_token("stu1@test.com", UserRole.student, department_id=dept_cse_id)
    stu2_token, stu2_id = _create_user_token("stu2@test.com", UserRole.student, department_id=dept_cse_id)

    # 1. Student 1 votes for Option 1
    h1 = {"Authorization": f"Bearer {stu1_token}"}
    res1 = client.post(f"/api/timetable/voting/{v1_id}/vote", headers=h1)
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["voted_version_id"] == v1_id
    assert d1["slate"]["total_votes"] == 1
    assert d1["slate"]["user_voted_option_id"] == v1_id

    opt1 = next(o for o in d1["slate"]["options"] if o["id"] == v1_id)
    assert opt1["vote_count"] == 1
    assert opt1["vote_percentage"] == 100.0
    assert opt1["is_user_vote"] is True

    # 2. Student 2 votes for Option 2
    h2 = {"Authorization": f"Bearer {stu2_token}"}
    res2 = client.post(f"/api/timetable/voting/{v2_id}/vote", headers=h2)
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["slate"]["total_votes"] == 2
    opt1 = next(o for o in d2["slate"]["options"] if o["id"] == v1_id)
    opt2 = next(o for o in d2["slate"]["options"] if o["id"] == v2_id)
    assert opt1["vote_count"] == 1
    assert opt1["vote_percentage"] == 50.0
    assert opt2["vote_count"] == 1
    assert opt2["vote_percentage"] == 50.0
    assert opt2["is_user_vote"] is True

    # 3. Student 1 changes vote to Option 2 (single vote per student rule - update choice)
    res3 = client.post(f"/api/timetable/voting/{v2_id}/vote", headers=h1)
    assert res3.status_code == 200
    d3 = res3.json()
    assert d3["slate"]["total_votes"] == 2  # Total remains 2 (not 3)
    opt1 = next(o for o in d3["slate"]["options"] if o["id"] == v1_id)
    opt2 = next(o for o in d3["slate"]["options"] if o["id"] == v2_id)
    assert opt1["vote_count"] == 0
    assert opt1["vote_percentage"] == 0.0
    assert opt2["vote_count"] == 2
    assert opt2["vote_percentage"] == 100.0
    assert opt2["is_user_vote"] is True

def test_department_eligibility_enforcement():
    dept_cse_id, dept_me_id = _setup_departments()
    db = TestingSessionLocal()

    v_cse = TimetableVersion(department_id=dept_cse_id, semester=5, status=TimetableStatus.draft, option_rank=1, score=90.0)
    db.add(v_cse)
    db.commit()
    db.refresh(v_cse)
    v_cse_id = v_cse.id
    db.close()

    # Student belongs to Mechanical Engineering
    me_student_token, _ = _create_user_token("stu.me@test.com", UserRole.student, department_id=dept_me_id)
    headers = {"Authorization": f"Bearer {me_student_token}"}

    # Attempt to vote on CSE timetable option
    res = client.post(f"/api/timetable/voting/{v_cse_id}/vote", headers=headers)
    assert res.status_code == 403
    assert "only vote on timetable options for your department" in res.json()["detail"]

def test_voting_automatically_locks_on_hod_approval():
    dept_cse_id, _ = _setup_departments()
    db = TestingSessionLocal()

    v1 = TimetableVersion(department_id=dept_cse_id, semester=5, status=TimetableStatus.draft, option_rank=1, score=95.0)
    v2 = TimetableVersion(department_id=dept_cse_id, semester=5, status=TimetableStatus.draft, option_rank=2, score=91.0)
    db.add_all([v1, v2])
    db.commit()
    db.refresh(v1)
    db.refresh(v2)
    v1_id, v2_id = v1.id, v2.id
    db.close()

    stu_token, _ = _create_user_token("stu.vote@test.com", UserRole.student, department_id=dept_cse_id)
    hod_token, _ = _create_user_token("hod.cse@test.com", UserRole.hod, department_id=dept_cse_id)
    stu_headers = {"Authorization": f"Bearer {stu_token}"}
    hod_headers = {"Authorization": f"Bearer {hod_token}"}

    # Student votes while drafts are open
    res_vote = client.post(f"/api/timetable/voting/{v1_id}/vote", headers=stu_headers)
    assert res_vote.status_code == 200

    # HOD approves Option 2 as the official schedule
    res_approve = client.post(
        f"/api/timetable/{v2_id}/approve",
        json={"comment": "Selected Option 2 as official schedule."},
        headers=hod_headers
    )
    assert res_approve.status_code == 200
    assert res_approve.json()["status"] == "approved"

    # Verify slate is now locked and closed
    res_slate = client.get(f"/api/timetable/voting/slate?department_id={dept_cse_id}&semester=5", headers=stu_headers)
    assert res_slate.status_code == 200
    slate_data = res_slate.json()
    assert slate_data["is_voting_open"] is False
    assert slate_data["approved_version_id"] == v2_id
    assert slate_data["approved_option_rank"] == 2

    # Subsequent vote attempt by student must fail with HTTP 400
    res_late_vote = client.post(f"/api/timetable/voting/{v1_id}/vote", headers=stu_headers)
    assert res_late_vote.status_code == 400
    assert "Voting is closed" in res_late_vote.json()["detail"]

def test_option_preview_endpoint():
    dept_cse_id, _ = _setup_departments()
    db = TestingSessionLocal()

    room = Room(name="LH-101", capacity=60, is_lab=False, department_id=dept_cse_id)
    fac = Faculty(name="Dr. Alan Turing", department_id=dept_cse_id)
    subj = Subject(name="Algorithms", department_id=dept_cse_id, semester=5, sessions_per_week=3)
    batch = Batch(name="CS-5A", department_id=dept_cse_id, semester=5, shift=Shift.morning, strength=50)
    db.add_all([room, fac, subj, batch])
    db.flush()

    v1 = TimetableVersion(department_id=dept_cse_id, semester=5, status=TimetableStatus.draft, option_rank=1, score=96.0)
    db.add(v1)
    db.flush()

    slot = TimetableSlot(
        timetable_version_id=v1.id,
        day=0,
        period=1,
        room_id=room.id,
        subject_id=subj.id,
        faculty_id=fac.id,
        batch_id=batch.id
    )
    db.add(slot)
    db.commit()
    db.refresh(v1)
    v1_id = v1.id
    db.close()

    stu_token, _ = _create_user_token("stu.preview@test.com", UserRole.student, department_id=dept_cse_id)
    headers = {"Authorization": f"Bearer {stu_token}"}

    res = client.get(f"/api/timetable/voting/{v1_id}/preview", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == v1_id
    assert data["option_rank"] == 1
    assert data["total_slots"] == 1
    assert data["slots"][0]["subject_name"] == "Algorithms"
    assert data["slots"][0]["faculty_name"] == "Dr. Alan Turing"
