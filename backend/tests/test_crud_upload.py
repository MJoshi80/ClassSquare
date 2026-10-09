import pytest
import io
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User, UserRole
from app.auth.jwt import create_access_token
from tests.conftest import TestingSessionLocal

client = TestClient(app)

def _get_admin_token():
    db = TestingSessionLocal()
    admin = User(
        email="admin@test.com",
        password_hash="fakehash",
        role=UserRole.admin,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    token = create_access_token({"sub": str(admin.id), "role": admin.role.value})
    db.close()
    return token

def test_crud_department_and_room():
    token = _get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Department
    res = client.post("/api/departments", json={"name": "Computer Science", "shift": "morning"}, headers=headers)
    assert res.status_code == 201
    dept_id = res.json()["id"]

    # 2. Get Department
    res = client.get(f"/api/departments/{dept_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Computer Science"

    # 3. Create Room
    res = client.post("/api/rooms", json={
        "name": "Lab-101",
        "capacity": 50,
        "is_lab": True,
        "department_id": dept_id
    }, headers=headers)
    assert res.status_code == 201
    assert res.json()["capacity"] == 50
    assert res.json()["is_lab"] is True

    # 4. List Rooms
    res = client.get("/api/rooms", headers=headers)
    assert res.status_code == 200
    assert len(res.json()) == 1

def test_csv_upload_preview_and_commit():
    token = _get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create department first via API
    client.post("/api/departments", json={"name": "Computer Science", "shift": "morning"}, headers=headers)

    # 2. Upload Rooms CSV with 1 valid row, 2 invalid rows
    csv_content = (
        "name,capacity,is_lab,department_name\n"
        "Room A,60,false,Computer Science\n"
        "Room Bad,-5,true,Computer Science\n"
        "Room UnknownDept,40,false,NonExistentDept\n"
    )
    
    file_payload = {"file": ("rooms.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    res = client.post("/api/upload/preview?entity_type=rooms", files=file_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 3
    assert data["valid_count"] == 1
    assert data["error_count"] == 2
    assert "Capacity must be greater than 0." in data["invalid_rows"][0]["errors"]
    assert "Department 'NonExistentDept' not found." in data["invalid_rows"][1]["errors"]

    # 3. Commit only the valid rows
    commit_payload = {
        "entity_type": "rooms",
        "rows": data["valid_rows"]
    }
    commit_res = client.post("/api/upload/commit", json=commit_payload, headers=headers)
    assert commit_res.status_code == 200
    assert commit_res.json()["inserted_count"] == 1

    # 4. Verify rooms count
    rooms_res = client.get("/api/rooms", headers=headers)
    assert len(rooms_res.json()) == 1
    assert rooms_res.json()[0]["name"] == "Room A"

def test_template_download():
    res = client.get("/api/upload/template/faculty")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "max_classes_per_day" in res.text
