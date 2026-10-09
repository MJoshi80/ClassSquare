import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import User, UserRole
from passlib.context import CryptContext
from tests.conftest import TestingSessionLocal

client = TestClient(app)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _create_admin():
    db = TestingSessionLocal()
    admin = User(
        email="admin@test.com",
        password_hash=pwd_context.hash("adminpass"),
        role=UserRole.admin,
    )
    db.add(admin)
    db.commit()
    db.close()

def _login_admin():
    _create_admin()
    resp = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "adminpass"})
    assert resp.status_code == 200
    return resp.json()["access_token"]

class TestLogin:
    def test_login_success(self):
        _create_admin()
        resp = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "adminpass"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["role"] == "admin"
    
    def test_login_wrong_password(self):
        _create_admin()
        resp = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "wrong"})
        assert resp.status_code == 401
    
    def test_login_nonexistent_user(self):
        resp = client.post("/api/auth/login", json={"email": "nobody@test.com", "password": "x"})
        assert resp.status_code == 401

class TestRegister:
    def test_register_as_admin(self):
        token = _login_admin()
        resp = client.post(
            "/api/auth/register",
            json={"email": "hod@test.com", "password": "hodpass", "role": "hod"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        assert resp.json()["role"] == "hod"
    
    def test_register_duplicate_email(self):
        token = _login_admin()
        client.post(
            "/api/auth/register",
            json={"email": "dup@test.com", "password": "pass", "role": "student"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.post(
            "/api/auth/register",
            json={"email": "dup@test.com", "password": "pass", "role": "student"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
    
    def test_register_without_auth(self):
        resp = client.post(
            "/api/auth/register",
            json={"email": "x@test.com", "password": "pass", "role": "student"},
        )
        assert resp.status_code == 401
    
    def test_register_as_non_admin(self):
        token = _login_admin()
        client.post(
            "/api/auth/register",
            json={"email": "faculty@test.com", "password": "fpass", "role": "faculty"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.post("/api/auth/login", json={"email": "faculty@test.com", "password": "fpass"})
        faculty_token = resp.json()["access_token"]
        resp = client.post(
            "/api/auth/register",
            json={"email": "new@test.com", "password": "pass", "role": "student"},
            headers={"Authorization": f"Bearer {faculty_token}"},
        )
        assert resp.status_code == 403

class TestMe:
    def test_get_me(self):
        token = _login_admin()
        resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "admin@test.com"
    
    def test_get_me_no_token(self):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401
