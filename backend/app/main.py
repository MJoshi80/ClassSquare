import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.database import init_db, SessionLocal, get_db
from app.models.user import User, UserRole
from app.models.department import Department
from app.models.room import Room
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.batch import Batch
from app.auth.dependencies import get_current_user
from app.routers import auth, departments, rooms, faculty, subjects, batches, upload, timetable, leaves, notifications, export, classroom, voting

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables and seed default admin if needed."""
    os.makedirs("data", exist_ok=True)
    init_db()
    
    # Seed default admin user if none exists
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == UserRole.admin).first()
        if not admin:
            default_admin = User(
                email="admin@opticlass.edu",
                password_hash=pwd_context.hash("admin123"),
                role=UserRole.admin,
            )
            db.add(default_admin)
            db.commit()
            print("[SEED] Default admin created: admin@opticlass.edu / admin123")
        else:
            print("[SEED] Admin user already exists, skipping seed.")
    finally:
        db.close()
    
    yield  # App runs here

app = FastAPI(
    title="ClassSquare API",
    description="Autonomous Academic Timetable & Scheduling Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React frontend and iframe embedding
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(departments.router)
app.include_router(rooms.router)
app.include_router(faculty.router)
app.include_router(subjects.router)
app.include_router(batches.router)
app.include_router(upload.router)
app.include_router(timetable.router)
app.include_router(leaves.router)
app.include_router(notifications.router)
app.include_router(export.router)
app.include_router(classroom.router)
app.include_router(voting.router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "opticlass-ai"}

@app.get("/api/stats/overview", tags=["System Admin"])
def get_overview_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {
        "departments_count": db.query(Department).count(),
        "rooms_count": db.query(Room).count(),
        "faculty_count": db.query(Faculty).count(),
        "subjects_count": db.query(Subject).count(),
        "batches_count": db.query(Batch).count(),
    }

@app.post("/api/admin/seed-demo", tags=["System Admin"])
def seed_demo_endpoint():
    """Trigger seeding of official demo curriculum and schedules."""
    try:
        from seed_demo import seed
        seed()
        return {"status": "success", "message": "Demo data successfully seeded."}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

# Optional single-container static frontend mounting (if frontend/dist exists)
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if not os.path.exists(frontend_dist):
    frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))

if os.path.exists(frontend_dist):
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse

    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="spa_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't hijack API routes or Swagger docs
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            return None
        candidate = os.path.join(frontend_dist, full_path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
