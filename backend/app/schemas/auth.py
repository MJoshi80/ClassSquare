from pydantic import BaseModel, EmailStr
from app.models.user import UserRole

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    email: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    role: UserRole
    linked_faculty_id: int | None = None

class UserResponse(BaseModel):
    id: int
    email: str
    role: UserRole
    linked_faculty_id: int | None = None
    
    model_config = {"from_attributes": True}
