import io
import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User, UserRole
from app.models.department import Department, Shift
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.batch import Batch
from app.models.classroom import ClassMaterial, StudentSubmission
from app.auth.jwt import create_access_token
from tests.conftest import TestingSessionLocal

client = TestClient(app)

def _get_user_token(email="faculty@test.com", role=UserRole.faculty, linked_faculty_id=None):
    db = TestingSessionLocal()
    user = User(email=email, password_hash="hash", role=role, linked_faculty_id=linked_faculty_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    user_id = user.id
    db.close()
    return token, user_id

def _setup_entities(db):
    dept = Department(name="Computer Science", shift=Shift.morning)
    db.add(dept)
    db.flush()

    fac = Faculty(name="Dr. Alan Turing", department_id=dept.id, max_classes_per_day=4, max_classes_per_week=16)
    db.add(fac)
    db.flush()

    subj = Subject(name="Data Structures", department_id=dept.id, semester=3, sessions_per_week=4)
    db.add(subj)
    db.flush()

    fac.subjects.append(subj)

    batch = Batch(name="CS-3A", department_id=dept.id, semester=3, shift=Shift.morning, strength=60)
    db.add(batch)
    db.commit()
    return dept, fac, subj, batch

def test_create_and_get_announcement():
    db = TestingSessionLocal()
    dept, fac, subj, batch = _setup_entities(db)
    token, _ = _get_user_token("turing@test.com", UserRole.faculty, linked_faculty_id=fac.id)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create announcement
    res = client.post(
        "/api/classroom/materials",
        data={
            "title": "Welcome to Semester 3",
            "description": "Please review the syllabus on the portal.",
            "type": "announcement",
            "batch_id": str(batch.id),
            "subject_id": str(subj.id),
        },
        headers=headers
    )
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Welcome to Semester 3"
    assert data["type"] == "announcement"
    assert data["batch_name"] == "CS-3A"
    assert data["faculty_name"] == "Dr. Alan Turing"
    assert data["has_file"] is False

    # 2. Get materials for batch
    get_res = client.get(f"/api/classroom/materials?batch_id={batch.id}", headers=headers)
    assert get_res.status_code == 200
    materials = get_res.json()
    assert len(materials) == 1
    assert materials[0]["title"] == "Welcome to Semester 3"

def test_assignment_lifecycle_and_student_submission():
    db = TestingSessionLocal()
    dept, fac, subj, batch = _setup_entities(db)
    fac_token, _ = _get_user_token("turing2@test.com", UserRole.faculty, linked_faculty_id=fac.id)
    stud_token, student_user_id = _get_user_token("student.alex@test.com", UserRole.student)

    # 1. Faculty posts assignment with attached file and due date
    due = (datetime.utcnow() + timedelta(days=5)).isoformat()
    mock_file = io.BytesIO(b"Problem 1: Implement a Red-Black Tree in C++.")
    
    post_res = client.post(
        "/api/classroom/materials",
        data={
            "title": "Assignment 1: Balanced Trees",
            "description": "Submit complete working source code and PDF report.",
            "type": "assignment",
            "batch_id": str(batch.id),
            "subject_id": str(subj.id),
            "due_date": due,
        },
        files={"file": ("Assignment1_Specs.pdf", mock_file, "application/pdf")},
        headers={"Authorization": f"Bearer {fac_token}"}
    )
    assert post_res.status_code == 201
    assignment = post_res.json()
    assert assignment["type"] == "assignment"
    assert assignment["has_file"] is True
    assert assignment["file_name"] == "Assignment1_Specs.pdf"
    assert assignment["due_date"] is not None
    assignment_id = assignment["id"]

    # 2. Download faculty attachment
    dl_res = client.get(f"/api/classroom/materials/{assignment_id}/download", headers={"Authorization": f"Bearer {stud_token}"})
    assert dl_res.status_code == 200
    assert b"Problem 1: Implement a Red-Black Tree" in dl_res.content

    # 3. Student submits assignment
    solution_file = io.BytesIO(b"// Student solution code\nint main() { return 0; }")
    sub_res = client.post(
        f"/api/classroom/materials/{assignment_id}/submit",
        data={"notes": "Completed test cases 1-10."},
        files={"file": ("solution_code.cpp", solution_file, "text/plain")},
        headers={"Authorization": f"Bearer {stud_token}"}
    )
    assert sub_res.status_code == 201
    sub_data = sub_res.json()
    assert sub_data["file_name"] == "solution_code.cpp"
    assert sub_data["status"] == "submitted"
    submission_id = sub_data["id"]

    # 4. Student checks materials feed and sees their own submission
    feed_res = client.get(f"/api/classroom/materials?batch_id={batch.id}", headers={"Authorization": f"Bearer {stud_token}"})
    assert feed_res.status_code == 200
    feed_items = feed_res.json()
    assert feed_items[0]["my_submission"] is not None
    assert feed_items[0]["my_submission"]["file_name"] == "solution_code.cpp"

    # 5. Faculty views all submissions
    sub_list_res = client.get(f"/api/classroom/materials/{assignment_id}/submissions", headers={"Authorization": f"Bearer {fac_token}"})
    assert sub_list_res.status_code == 200
    submissions = sub_list_res.json()
    assert len(submissions) == 1
    assert submissions[0]["id"] == submission_id

    # 6. Faculty downloads student submission
    sub_dl_res = client.get(f"/api/classroom/submissions/{submission_id}/download", headers={"Authorization": f"Bearer {fac_token}"})
    assert sub_dl_res.status_code == 200
    assert b"Student solution code" in sub_dl_res.content

    # 7. Student checks my-submissions
    my_subs_res = client.get("/api/classroom/my-submissions", headers={"Authorization": f"Bearer {stud_token}"})
    assert my_subs_res.status_code == 200
    assert len(my_subs_res.json()) == 1

    # 8. Delete material cascades and cleans up
    del_res = client.delete(f"/api/classroom/materials/{assignment_id}", headers={"Authorization": f"Bearer {fac_token}"})
    assert del_res.status_code == 200

    # Ensure material is gone
    get_again = client.get(f"/api/classroom/materials?batch_id={batch.id}", headers={"Authorization": f"Bearer {stud_token}"})
    assert len(get_again.json()) == 0


def test_batch_subjects_and_subjectwise_filtering():
    db = TestingSessionLocal()
    dept, fac, subj, batch = _setup_entities(db)

    # Add a second subject to the same department and semester
    subj2 = Subject(name="Database Systems", department_id=dept.id, semester=3, sessions_per_week=3)
    db.add(subj2)
    db.flush()
    fac.subjects.append(subj2)
    db.commit()

    token, user_id = _get_user_token("turing_bifurcation@test.com", UserRole.faculty, linked_faculty_id=fac.id)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Post material for Subject 1 (Data Structures)
    client.post(
        "/api/classroom/materials",
        data={
            "title": "Trees and Graphs Lecture",
            "type": "material",
            "batch_id": str(batch.id),
            "subject_id": str(subj.id),
        },
        headers=headers
    )

    # 2. Post assignment for Subject 2 (Database Systems)
    client.post(
        "/api/classroom/materials",
        data={
            "title": "SQL Query Optimization Assignment",
            "type": "assignment",
            "batch_id": str(batch.id),
            "subject_id": str(subj2.id),
            "due_date": (datetime.utcnow() + timedelta(days=3)).isoformat(),
        },
        headers=headers
    )

    # 3. Test get_batch_subjects endpoint
    b_subjects_res = client.get(f"/api/classroom/batches/{batch.id}/subjects", headers=headers)
    assert b_subjects_res.status_code == 200
    b_subjects = b_subjects_res.json()
    assert len(b_subjects) >= 2

    # Check Data Structures subject summary
    ds_sub = next(s for s in b_subjects if s["id"] == subj.id)
    assert ds_sub["name"] == "Data Structures"
    assert ds_sub["notes_count"] == 1
    assert ds_sub["total_materials"] == 1

    # Check Database Systems subject summary
    db_sub = next(s for s in b_subjects if s["id"] == subj2.id)
    assert db_sub["name"] == "Database Systems"
    assert db_sub["assignment_count"] == 1
    assert db_sub["total_materials"] == 1

    # 4. Test subject_id query filtering in get_materials
    ds_materials_res = client.get(f"/api/classroom/materials?batch_id={batch.id}&subject_id={subj.id}", headers=headers)
    assert ds_materials_res.status_code == 200
    ds_materials = ds_materials_res.json()
    assert len(ds_materials) == 1
    assert ds_materials[0]["title"] == "Trees and Graphs Lecture"

    db_materials_res = client.get(f"/api/classroom/materials?batch_id={batch.id}&subject_id={subj2.id}", headers=headers)
    assert db_materials_res.status_code == 200
    db_materials = db_materials_res.json()
    assert len(db_materials) == 1
    assert db_materials[0]["title"] == "SQL Query Optimization Assignment"


def test_faculty_cannot_upload_for_unassigned_subject():
    db = TestingSessionLocal()
    dept, fac, subj, batch = _setup_entities(db)

    # Subject 2 is NOT taught by Dr. Alan Turing
    unassigned_subj = Subject(name="Fluid Mechanics", department_id=dept.id, semester=3, sessions_per_week=3)
    db.add(unassigned_subj)
    db.commit()

    token, user_id = _get_user_token("turing_unauth@test.com", UserRole.faculty, linked_faculty_id=fac.id)
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt to post material for unassigned subject
    res = client.post(
        "/api/classroom/materials",
        data={
            "title": "Unauthorized Lecture Notes",
            "type": "material",
            "batch_id": str(batch.id),
            "subject_id": str(unassigned_subj.id),
        },
        headers=headers
    )

    # Must be rejected with 403 Forbidden!
    assert res.status_code == 403
    assert "You are only authorized to upload coursework for subjects you teach" in res.json()["detail"]
