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
from app.models.notification import Notification
from app.services.notification_service import create_notification
from app.models.timetable import TimetableVersion, TimetableSlot, TimetableStatus
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

def test_notification_flow():
    db = TestingSessionLocal()
    token = _get_token("admin_notif@test.com", UserRole.admin)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create notifications via service
    notif1 = create_notification(
        db=db,
        title="Timetable Update",
        message="CSE Semester 3 Timetable Approved",
        type="timetable_published",
        role="all"
    )
    notif2 = create_notification(
        db=db,
        title="Admin Alert",
        message="System Maintenance",
        type="info",
        role="admin"
    )

    # 2. Get unread count
    resp = client.get("/api/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["unread_count"] >= 2

    # 3. Get notifications list
    resp = client.get("/api/notifications", headers=headers)
    assert resp.status_code == 200
    notifs = resp.json()
    assert len(notifs) >= 2
    titles = [n["title"] for n in notifs]
    assert "Timetable Update" in titles
    assert "Admin Alert" in titles

    # 4. Mark one as read
    target_id = notif1.id
    resp = client.post(f"/api/notifications/{target_id}/read", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["is_read"] is True

    # 5. Mark all as read
    resp = client.post("/api/notifications/read-all", headers=headers)
    assert resp.status_code == 200
    
    # 6. Verify unread count is 0
    resp = client.get("/api/notifications/unread-count", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["unread_count"] == 0
    db.close()

def test_export_and_batch_schedule_flow():
    db = TestingSessionLocal()
    token = _get_token("hod_export@test.com", UserRole.hod)
    headers = {"Authorization": f"Bearer {token}"}

    # Setup test department, room, faculty, subject, batch
    dept = Department(name="Information Technology", shift=Shift.morning)
    db.add(dept)
    db.commit()

    room = Room(name="IT-Lab-1", capacity=60, is_lab=True, department_id=dept.id)
    db.add(room)

    faculty = Faculty(name="Dr. Alan Turing", department_id=dept.id)
    db.add(faculty)

    subj = Subject(name="Operating Systems", sessions_per_week=3, is_lab=False, department_id=dept.id, semester=3)
    db.add(subj)

    batch = Batch(name="IT-3A", department_id=dept.id, semester=3, strength=45)
    db.add(batch)
    db.commit()

    # Create an approved timetable version with slots
    version = TimetableVersion(
        department_id=dept.id,
        semester=3,
        option_rank=1,
        score=95.0,
        status=TimetableStatus.approved
    )
    db.add(version)
    db.commit()

    slot1 = TimetableSlot(
        timetable_version_id=version.id,
        batch_id=batch.id,
        day=0,  # Monday
        period=1,
        subject_id=subj.id,
        faculty_id=faculty.id,
        room_id=room.id
    )
    slot2 = TimetableSlot(
        timetable_version_id=version.id,
        batch_id=batch.id,
        day=0,  # Monday
        period=3,  # Notice period 2 is a gap!
        subject_id=subj.id,
        faculty_id=faculty.id,
        room_id=room.id
    )
    db.add_all([slot1, slot2])
    db.commit()

    # 1. Test Batch Schedule & Gap-Time Analysis endpoint
    resp = client.get(f"/api/timetable/batch/{batch.id}")
    assert resp.status_code == 200
    bdata = resp.json()
    assert bdata["batch_name"] == "IT-3A"
    assert bdata["total_classes"] == 2
    assert bdata["free_periods"] == 28
    assert bdata["total_gap_periods"] == 1  # Period 2 was empty between 1 and 3 on Monday!
    assert len(bdata["slots"]) == 2

    # 2. Test CSV Export
    resp = client.get(f"/api/export/timetable/{version.id}/csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Operating Systems" in resp.text
    assert "IT-3A" in resp.text

    # 3. Test Excel Export
    resp = client.get(f"/api/export/timetable/{version.id}/excel")
    assert resp.status_code == 200
    assert "spreadsheetml.sheet" in resp.headers["content-type"]
    assert len(resp.content) > 1000  # Valid binary Excel file

    # 4. Test iCal Export (Timetable)
    resp = client.get(f"/api/export/timetable/{version.id}/ical")
    assert resp.status_code == 200
    assert "text/calendar" in resp.headers["content-type"]
    ical_text = resp.text
    assert "BEGIN:VCALENDAR" in ical_text
    assert "BEGIN:VEVENT" in ical_text
    assert "RRULE:FREQ=WEEKLY" in ical_text
    assert "Operating Systems" in ical_text
    assert "END:VCALENDAR" in ical_text

    # 5. Test Batch iCal Export
    resp = client.get(f"/api/export/batch/{batch.id}/ical")
    assert resp.status_code == 200
    assert "BEGIN:VCALENDAR" in resp.text
    assert "IT-3A" in resp.text

    # 6. Test Faculty iCal Export
    resp = client.get(f"/api/export/faculty/{faculty.id}/ical")
    assert resp.status_code == 200
    assert "BEGIN:VCALENDAR" in resp.text
    assert "Dr. Alan Turing" in resp.text
    db.close()


def test_new_feature_notifications():
    db = TestingSessionLocal()
    # 1. Create student and faculty users
    fac_token = _get_token("faculty_notif@test.com", UserRole.faculty)
    stu_token = _get_token("student_notif@test.com", UserRole.student)
    fac_user = db.query(User).filter(User.email == "faculty_notif@test.com").first()
    stu_user = db.query(User).filter(User.email == "student_notif@test.com").first()

    # 2. Seed notifications for new features
    # Student notifications
    create_notification(
        db=db,
        title="Study-Gap Productivity Windows Available",
        message="1-hr library productivity window on Tuesday.",
        type="study_gap",
        role="student",
        link="/student"
    )
    create_notification(
        db=db,
        title="New Assignment: Red-Black Tree Balancing",
        message="Assignment 2 posted for Batch CS-3A.",
        type="classroom_assignment",
        role="student",
        link="/student"
    )
    create_notification(
        db=db,
        user_id=stu_user.id,
        title="Submission Confirmed",
        message="Assignment 2 successfully received.",
        type="submission_receipt",
        link="/student"
    )

    # Faculty notification (direct)
    create_notification(
        db=db,
        user_id=fac_user.id,
        title="New Submission: Red-Black Tree Implementation",
        message="Student submitted work.",
        type="submission_received",
        link="/faculty"
    )

    # Technical system notification (admin only)
    create_notification(
        db=db,
        title="Constraint Engine Optimization Complete",
        message="OR-Tools solver resolved all constraints with 0 clashes.",
        type="system",
        role="all"  # Even if mistakenly set to 'all', non-admin users must NOT receive it
    )

    # 3. Check student feed
    stu_resp = client.get("/api/notifications", headers={"Authorization": f"Bearer {stu_token}"})
    assert stu_resp.status_code == 200
    stu_notifs = stu_resp.json()
    stu_types = [n["type"] for n in stu_notifs]
    assert "study_gap" in stu_types
    assert "classroom_assignment" in stu_types
    assert "submission_receipt" in stu_types
    assert "submission_received" not in stu_types  # Faculty-only notification
    assert "system" not in stu_types  # Non-admin cannot receive technical system notifications

    # 4. Check faculty feed
    fac_resp = client.get("/api/notifications", headers={"Authorization": f"Bearer {fac_token}"})
    assert fac_resp.status_code == 200
    fac_notifs = fac_resp.json()
    fac_types = [n["type"] for n in fac_notifs]
    assert "submission_received" in fac_types
    assert "submission_receipt" not in fac_types  # Student private receipt
    assert "system" not in fac_types  # Non-admin cannot receive technical system notifications

    # 5. Check admin feed
    admin_token = _get_token("admin_system_check@test.com", UserRole.admin)
    admin_resp = client.get("/api/notifications", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_resp.status_code == 200
    admin_notifs = admin_resp.json()
    admin_types = [n["type"] for n in admin_notifs]
    assert "system" in admin_types  # Admin CAN receive technical system notifications
    db.close()

