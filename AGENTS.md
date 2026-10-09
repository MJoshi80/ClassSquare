# ClassSquare — Agent Onboarding Document

> **Purpose:** This file gives a fresh AI agent (or collaborator) complete context on the
> ClassSquare project — architecture, design decisions, known quirks, and exactly where to
> find things — so development can resume immediately without needing the previous
> conversation history.

---

## 1. What Is ClassSquare?

**ClassSquare** is an autonomous academic timetable scheduling platform built for Indian
engineering colleges. It uses Google OR-Tools CP-SAT to generate multiple clash-free
timetable options for a department/semester, then presents them to faculty, students, and
the Head of Department (HOD) through role-specific dashboards.

**Core value proposition:**

- A department HOD uploads institutional data (rooms, faculty, subjects, batches) once.
- The system runs a constraint-satisfaction solver and offers up to 3 distinct, zero-clash
  timetable options in seconds.
- Students can vote on options via a "Democracy" tab (only visible when voting is open).
- The HOD can perform What-If slot swaps in a sandbox before approving.
- Faculty receive real-time substitution recommendations when a colleague applies for leave.

**This is a college project / hackathon entry.** The tech is real and working; the scope is
scoped to one department at a time (solver runs per `department_id + semester`).

---

## 2. Branding & Naming History

| Old name (do NOT use) | Current name |
|---|---|
| smay-anusaran | ClassSquare |
| OptiClass AI | ClassSquare |
| opticlass-ai-frontend | classsquare-frontend (package.json) |
| opticlass-api | classsquare-api (render.yaml) |
| smay-backend/frontend | classsquare-backend/frontend (docker-compose.yml) |
| smay.db | classsquare.db (docker-compose volume) |

> **Exception:** The default admin seed email (`admin@opticlass.edu`) and the
> `localStorage` token key (`opticlass_token`) are intentionally kept as-is for demo
> consistency. Do **not** change these without updating all references.

---

## 3. Repository Layout

```
ClassSquare/
│
├── backend/                        # FastAPI Python 3.11 backend
│   ├── app/
│   │   ├── main.py                 # App entry point; seeds default admin on startup
│   │   ├── database.py             # SQLAlchemy engine + SessionLocal (SQLite)
│   │   ├── config.py               # Pydantic Settings: SECRET_KEY, DB_URL, token expiry
│   │   ├── auth/
│   │   │   ├── jwt.py              # create_access_token(), decode_token()
│   │   │   └── dependencies.py     # get_current_user, require_role(UserRole.X) FastAPI deps
│   │   ├── models/                 # SQLAlchemy ORM (declarative, mapped_column style)
│   │   │   ├── user.py             # User: email, password_hash, role, department_id, linked_faculty_id
│   │   │   ├── department.py       # Department: name, shift (Shift enum: morning/evening)
│   │   │   ├── room.py             # Room: name, capacity, is_lab, department_id (nullable = shared)
│   │   │   ├── faculty.py          # Faculty + FacultySubject M2M join table
│   │   │   ├── subject.py          # Subject + ElectiveBand (for NEP open electives)
│   │   │   ├── batch.py            # Batch + FixedSlot (admin-pinned mandatory time slots)
│   │   │   ├── timetable.py        # TimetableVersion + TimetableSlot (see §7)
│   │   │   ├── approval.py         # ApprovalLog, ApprovalAction enum
│   │   │   ├── leave.py            # FacultyLeave, LeaveStatus enum
│   │   │   ├── notification.py     # Notification (per-user, in-app bell icon)
│   │   │   ├── classroom.py        # ClassMaterial + StudentSubmission
│   │   │   └── vote.py             # TimetableVote (student picks one version)
│   │   ├── routers/                # One router per entity, ALL prefixed /api/...
│   │   │   ├── auth.py             # POST /api/auth/login, /register
│   │   │   ├── departments.py      # CRUD /api/departments
│   │   │   ├── rooms.py            # CRUD /api/rooms
│   │   │   ├── faculty.py          # CRUD /api/faculty (includes subject-mapping patch)
│   │   │   ├── subjects.py         # CRUD /api/subjects + /api/elective-bands
│   │   │   ├── batches.py          # CRUD /api/batches
│   │   │   ├── upload.py           # POST /preview & /commit; DELETE /api/upload/clear/{entity}
│   │   │   ├── timetable.py        # POST /generate; GET /versions; approval; simulate-edit
│   │   │   ├── leaves.py           # Faculty leave apply + HOD approve/reject
│   │   │   ├── notifications.py    # GET /api/notifications; PATCH mark-read
│   │   │   ├── export.py           # GET iCal, Excel, CSV exports
│   │   │   ├── classroom.py        # POST materials; GET/POST submissions
│   │   │   └── voting.py           # POST open/close/cast/results for timetable vote
│   │   ├── schemas/                # Pydantic v2 request + response models
│   │   │   ├── auth.py             # LoginRequest, TokenResponse, UserOut
│   │   │   ├── entities.py         # DeptCreate/Out, RoomCreate/Out, ... UploadPreviewResponse
│   │   │   ├── timetable.py        # TimetableVersionOut, TimetableSlotOut, GenerateRequest
│   │   │   ├── leave.py            # LeaveCreate, LeaveOut, LeaveApproval
│   │   │   ├── voting.py           # VoteCreate, VotingStatusOut, VotingResultsOut
│   │   │   ├── classroom.py        # MaterialCreate, SubmissionCreate
│   │   │   └── notification.py     # NotificationOut
│   │   ├── services/
│   │   │   ├── clear_service.py    # clear_entity_records(db, entity_type) — cascading DELETE
│   │   │   └── notification_service.py  # create_notification() helper
│   │   └── solver/
│   │       ├── model.py            # TimetableModel — CP-SAT formulation, 8 hard constraints
│   │       ├── scheduler.py        # generate_timetable_options() orchestrator (see §8)
│   │       ├── evaluator.py        # evaluate_schedule_metrics() — quality score + focus label
│   │       ├── diagnostics.py      # run_infeasibility_diagnostics() — plain-English bottleneck messages
│   │       └── substitution.py     # Substitute scoring: 100 - (load/max*50) + (same_dept*20)
│   ├── seed_demo.py                # Full institutional seeder (invokes solver, stores approved timetable)
│   ├── Dockerfile                  # python:3.11-slim, uvicorn on port 8000
│   ├── requirements.txt
│   ├── tests/                      # 31 pytest tests — all must pass before any merge
│   │   ├── conftest.py
│   │   └── test_*.py
│   └── data/                       # SQLite DB + uploaded files (gitignored entirely)
│
├── frontend/                       # React 18 + Vite 5 SPA
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.js           # Axios instance; JWT interceptor; 401 → redirect to login
│   │   │   ├── entities.js         # get/create/update/delete for all 5 entity types
│   │   │   ├── timetable.js        # generate, listVersions, approve, simulateEdit
│   │   │   ├── voting.js           # openVoting, closeVoting, castVote, getResults
│   │   │   ├── leave.js            # applyLeave, listLeaves, approveLeave
│   │   │   ├── export.js           # downloadIcal, downloadExcel
│   │   │   ├── notifications.js    # getNotifications, markRead
│   │   │   └── classroom.js        # getMaterials, postMaterial, getSubmissions, submit
│   │   ├── components/
│   │   │   ├── TimetableGrid.jsx   # Compact timetable cell grid; click-to-expand shows faculty+venue+swap btn
│   │   │   ├── WhatIfSlotModal.jsx # HOD sandbox: drag-to-swap, sub-50ms clash check
│   │   │   ├── EntityModal.jsx     # Add / Edit modal for all 5 entity types; uses ENTITY_LABELS dict
│   │   │   ├── CsvUploadModal.jsx  # 2-step CSV/Excel bulk upload (preview → commit)
│   │   │   ├── ApprovalModal.jsx   # HOD timetable approval confirmation
│   │   │   ├── SubstituteModal.jsx # Substitution recommendations list
│   │   │   ├── VotingOptionPreviewModal.jsx  # Full timetable preview for a voting option
│   │   │   ├── CreateMaterialModal.jsx       # Faculty posts classroom material
│   │   │   ├── SubmissionsModal.jsx          # Faculty views student submissions
│   │   │   ├── SubmitAssignmentModal.jsx     # Student submits assignment
│   │   │   ├── TimetableSyncExportMenu.jsx   # iCal / Excel export dropdown
│   │   │   ├── NotificationDropdown.jsx      # Bell icon notification list
│   │   │   ├── Navbar.jsx                    # Top nav (logo + role label + notifications + logout)
│   │   │   ├── ClassSquareLogo.jsx           # SVG branding logo (use this — not OptiClassLogo)
│   │   │   ├── OptiClassLogo.jsx             # OLD — do not use for new UI
│   │   │   ├── Icons.jsx                     # All custom SVG icon components
│   │   │   ├── ProtectedRoute.jsx            # Role-gated route wrapper
│   │   │   └── ErrorBoundary.jsx             # React error boundary
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx        # Blue gradient, ClassSquareLogo centred, purple login button
│   │   │   ├── AdminDashboard.jsx   # 5-tab entity CRUD + CSV upload + Clear Data danger footers
│   │   │   ├── HodDashboard.jsx     # Solver card, What-If sandbox, voting oversight, leave approval
│   │   │   ├── FacultyDashboard.jsx # Personal schedule, leave application, iCal export, classroom
│   │   │   └── StudentDashboard.jsx # Compact timetable, Democracy voting tab (conditional), assignments
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx      # Global auth state; reads/writes opticlass_token in localStorage
│   │   ├── theme.js                 # MUI v5 theme; background.default = '#e0f2fe'
│   │   ├── index.css               # Tailwind base; body { background: #e0f2fe }
│   │   ├── App.jsx                  # React Router routes (/, /hod, /faculty, /student)
│   │   └── main.jsx                 # React DOM render entry
│   ├── package.json                 # name: "classsquare-frontend", React 18, MUI v5, Vite 5
│   ├── vite.config.js               # Dev: proxy /api → http://localhost:8000
│   ├── vercel.json                  # SPA catch-all rewrite → /index.html
│   ├── tailwind.config.js           # Tailwind content paths
│   └── Dockerfile                   # Multi-stage: node:20-alpine build → nginx:alpine serve on port 80
│
├── demo_seed_data/                  # 5 CSVs for live demo upload via the Admin UI
│   ├── 01_departments.csv           # 4 departments (CS, EE, ME, CE)
│   ├── 02_rooms.csv                 # 20 rooms/labs
│   ├── 03_subjects.csv              # 39 subjects (2 NEP elective bands)
│   ├── 04_faculty.csv               # 21 faculty with qualified_subjects column
│   └── 05_batches.csv               # 9 batches, morning + evening shifts
│
├── docs/
│   └── DESIGN_SYSTEM.md            # UI/UX guidelines (palette, spacing, MUI usage rules)
│
├── docker-compose.yml              # classsquare-backend (port 8000) + classsquare-frontend (port 3000)
├── render.yaml                     # Render.com blueprint: classsquare-api + classsquare-frontend
├── run.bat                         # Windows 1-click: activates venv + starts uvicorn + vite
├── run.sh                          # Unix equivalent of run.bat
├── README.md                       # Public-facing docs (tech stack, demo accounts, deployment)
├── .gitignore                      # Excludes: venv, node_modules, *.db, .env, .gemini/, screenshots
└── AGENTS.md                       # ← This file
```

---

## 4. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React 18 | Functional components, hooks only |
| Build tool | Vite 5 | Dev proxy `/api` → `localhost:8000` |
| UI component library | MUI (Material-UI) v5 | Theme in `theme.js` |
| CSS utility | Tailwind CSS v3 | Co-used with MUI; see `tailwind.config.js` |
| HTTP client | Axios | `api/client.js` attaches JWT on every request |
| State management | React Context | Auth only; no Redux |
| Backend framework | FastAPI (Python 3.11) | Async-capable, Pydantic v2 schemas |
| ORM | SQLAlchemy 2.x | `mapped_column` / `Mapped` declarative style |
| Database | SQLite (development) | File at `backend/data/smay.db` (gitignored) |
| Auth | JWT (python-jose) + bcrypt | 24h token expiry; RBAC via FastAPI depends |
| Scheduler | Google OR-Tools CP-SAT | `ortools` Python package; see `solver/model.py` |
| Data ingestion | pandas | Parses CSV/Excel in `upload.py` |
| Tests | pytest + httpx | 31 tests; run `pytest backend/tests/` |
| Containerisation | Docker + docker-compose | Two containers: backend + nginx-fronted frontend |
| Deployment | Vercel (frontend) + Render (backend) | `vercel.json` + `render.yaml` already configured |

---

## 5. How to Run Locally

### Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Unix:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On first start, `main.py` lifespan creates all tables and seeds:
- **Admin:** `admin@opticlass.edu` / `admin123`

Interactive API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173
# /api calls are proxied to http://localhost:8000
```

### Build check (before committing)

```bash
cd frontend && npm run build   # must have 0 errors
cd .. && pytest backend/tests/ # must show: 31 passed
```

### Docker (full stack)

```bash
docker-compose up --build
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

---

## 6. User Roles & Dashboards

### 6a. Admin (`UserRole.admin`)

**Dashboard:** `AdminDashboard.jsx`

Tabs: Departments | Rooms | Faculty | Subjects | Batches

**Capabilities:**
- Full CRUD on all 5 entity types (individual Add / Edit / Delete via `EntityModal.jsx`)
- Bulk CSV/Excel upload via `CsvUploadModal.jsx` (preview-first, then commit)
- Download CSV template for any entity type
- **Clear Data** — danger zone footer per tab; triggers cascading delete via `clear_service.py`
- The "Add Faculty" / "Add Batch" button labels come from `categoryMeta[activeTab].addLabel`
  — do NOT use `activeTab.slice(0, -1)` as that clips the last character (was a bug, now fixed)

**Admin seeded on startup:** `admin@opticlass.edu` / `admin123`

---

### 6b. HOD (`UserRole.hod`)

**Dashboard:** `HodDashboard.jsx` (~800+ lines, most complex page)

**Capabilities:**
- **Solver card:** Select department + semester → "Solve Timetable" → calls
  `POST /api/timetable/generate` → shows up to 3 option cards
- **Option cards:** Each card shows `score`, `optimization_focus`, `tagline`,
  `student_centric_points` (3 bullet points), `top_optimized_constraints`
- **Timetable grid:** `TimetableGrid.jsx`; cells are compact by default; click expands to show
  faculty name, room, and the **"Simulate / Swap"** button (no emoji — that was removed)
- **What-If sandbox:** `WhatIfSlotModal.jsx` — HOD drags a slot to a new time; frontend
  does a clash check client-side in <50ms before calling `POST /api/timetable/simulate-edit`
- **Approve:** Moves version from `draft` → `approved`; sends notifications to all faculty/students
- **Democracy:** HOD can open/close student voting on the 3 options
- **Leave approval:** HOD reviews faculty leave requests; approves/rejects
- **Substitution:** When a leave is approved, `GET /api/timetable/substitute-recommendations`
  returns ranked substitutes using `substitution.py` scoring

**HOD account (created via Admin after upload):** `hod@cs.edu` / `hod123` (example)

---

### 6c. Faculty (`UserRole.faculty`)

**Dashboard:** `FacultyDashboard.jsx`

**Capabilities:**
- View personal weekly timetable (only their own slots from the approved version)
- Apply for leave (date range + reason) → creates `FacultyLeave` record
- Export timetable as iCal (`.ics`) or Excel
- Classroom tab: post materials, view student submissions

**Faculty account (created via Admin or CSV upload):** `faculty@cs.edu` / `faculty123` (example)

---

### 6d. Student (`UserRole.student`)

**Dashboard:** `StudentDashboard.jsx`

**Capabilities:**
- View batch timetable (compact grid; click cell to expand)
- **Democracy tab** — only visible when HOD has opened voting; shows up to 3 options with
  3 student-centric bullet points each; student picks one option and submits vote
- Assignments tab: view materials posted by faculty, submit assignments

**Student account:** `student@cs.edu` / `student123` (example)

---

## 7. Database Schema (Key Models)

All models use SQLAlchemy 2.x `Mapped[T]` / `mapped_column()` style.

### Core entities

```
Department(id, name, shift: Shift)                        # shift ∈ {morning, evening}
Room(id, name, capacity, is_lab, department_id?)          # department_id NULL = shared room
Faculty(id, name, department_id, max_classes_per_day,
        max_classes_per_week, avg_monthly_leaves)
  └─ FacultySubject(faculty_id, subject_id)               # M2M join table
Subject(id, name, department_id, semester, sessions_per_week,
        is_lab, is_elective, elective_band_id?)
  └─ ElectiveBand(id, name)                               # NEP open elective groupings
Batch(id, name, department_id, semester, shift, strength)
  └─ FixedSlot(id, batch_id, subject_id, day, period, room_id)  # Pinned mandatory slots
```

### Auth

```
User(id, email, password_hash, role: UserRole,
     department_id?, linked_faculty_id?)
# UserRole ∈ {admin, hod, faculty, student}
```

### Timetable

```
TimetableVersion(id, department_id, semester, status: TimetableStatus,
                 generated_at, score, option_rank, optimization_focus)
# TimetableStatus ∈ {draft, pending_approval, approved, rejected}

TimetableSlot(id, timetable_version_id, day, period,
              room_id, subject_id, faculty_id, batch_id)
# day: 0=Mon … 4=Fri; period: 1-based (1–6)
```

### Other

```
ApprovalLog(id, timetable_version_id, actioned_by, action: ApprovalAction, notes, timestamp)
FacultyLeave(id, faculty_id, start_date, end_date, reason, status: LeaveStatus)
Notification(id, user_id, message, is_read, created_at)
ClassMaterial(id, faculty_id, batch_id, title, content, created_at)
StudentSubmission(id, material_id, student_id, content, submitted_at)
TimetableVote(id, timetable_version_id, student_id, cast_at)
```

---

## 8. The CP-SAT Solver

### Entry point

```python
# backend/app/solver/scheduler.py
generate_timetable_options(
    db: Session,
    department_id: int,
    semester: int = None,
    shift: Shift = None,
    num_options: int = 3
) -> Dict[str, Any]
```

**Critical notes:**
- Does **NOT** accept `batch_ids` as a parameter.
- Returns `{'status': 'SUCCESS', 'options': [...], 'message': ..., 'diagnostic_suggestions': None}`
  when at least one feasible schedule is found.
- Returns `{'status': 'INFEASIBLE', 'options': [], 'diagnostic_suggestions': [...]}` on failure.
- The status string is `"SUCCESS"` — not `"OPTIMAL"` or `"FEASIBLE"`.

### 8 Hard Constraints (enforced in `model.py`)

| # | Constraint |
|---|---|
| 1 | No faculty double-booked in the same (day, period) |
| 2 | No room double-booked in the same (day, period) |
| 3 | No batch double-booked in the same (day, period) |
| 4 | Room capacity ≥ batch strength |
| 5 | Faculty must be qualified for the subject (via `FacultySubject` M2M) |
| 6 | Lab subjects require `is_lab=True` rooms |
| 7 | Fixed special-class slots (FixedSlot) are strictly respected |
| 8 | Faculty daily & weekly teaching load limits (`max_classes_per_day`, `max_classes_per_week`) |
| — | Each session instance must be assigned exactly once |

### Soft Optimisation

Three solver runs with different perturbation weights produce 3 distinct options:

| Pass | Seed | Focus |
|---|---|---|
| 1 | 42 | faculty_gap×3, student_gap×4, load_balance×2, early_lab×1 |
| 2 | 107 | faculty_gap×5, student_gap×2, load_balance×4, early_lab×2 |
| 3 | 999 | faculty_gap×2, student_gap×5, load_balance×1, early_lab×3 |

Each pass has a 6-second CP-SAT time limit (`max_time_seconds=6.0`).

### Option card data shape (what the frontend receives)

```json
{
  "id": 42,
  "option_rank": 1,
  "score": 87.3,
  "status": "draft",
  "generated_at": "2026-09-05T...",
  "clash_count": 0,
  "total_slots": 44,
  "optimization_focus": "Student Comfort",
  "tagline": "Balanced mornings, gap-free afternoons",
  "top_optimized_constraints": ["No student free periods", "Lab sessions in morning"],
  "student_centric_points": ["Continuous class blocks", "Labs before lunch", "Minimal cross-room travel"],
  "constraint_breakdown": {...},
  "metrics_summary": {...},
  "slots": [...]
}
```

---

## 9. API Conventions

### Auth

- Login: `POST /api/auth/login` with `{ email, password }` → `{ access_token, token_type, role }`
- Token stored in `localStorage` as `opticlass_token`
- All subsequent requests: `Authorization: Bearer <token>` header (added by `api/client.js`)
- RBAC: FastAPI dependencies `require_role(UserRole.admin)` etc. in each router

### Bulk Upload Flow (Admin)

1. `POST /api/upload/preview?entity_type=faculty` — upload file → returns `{ valid_rows, invalid_rows, total_rows }`
2. User reviews the preview table in `CsvUploadModal.jsx`
3. `POST /api/upload/commit` with `{ entity_type, rows: valid_rows }` — inserts all valid rows

**CSV column schemas** (from `upload.py` TEMPLATES):

| Entity | Columns |
|---|---|
| departments | `name`, `shift` |
| rooms | `name`, `capacity`, `is_lab`, `department_name` |
| faculty | `name`, `department_name`, `max_classes_per_day`, `max_classes_per_week`, `avg_monthly_leaves`, `qualified_subjects` (semicolon-separated) |
| subjects | `name`, `department_name`, `semester`, `sessions_per_week`, `is_lab`, `is_elective`, `elective_band_name` |
| batches | `name`, `department_name`, `semester`, `shift`, `strength` |

### Clear Data

- `DELETE /api/upload/clear/{entity_type}` (admin only)
- `entity_type` ∈ `{departments, rooms, faculty, subjects, batches}`
- Cascading — e.g. clearing departments will orphan faculty/batches/rooms (their FK becomes null or row is deleted based on relationship cascade)
- Implemented in `clear_service.py` → `clear_entity_records(db, entity_type)`

### Timetable Endpoints

- `POST /api/timetable/generate` — body: `{ department_id, semester, num_options? }`
- `GET /api/timetable/versions?department_id=X&semester=Y` — list all versions
- `POST /api/timetable/approve/{version_id}` — HOD approves
- `POST /api/timetable/simulate-edit` — sandbox slot swap; returns clash count only (does not persist)

### Export

- `GET /api/export/ical/{version_id}` → `.ics` file download
- `GET /api/export/excel/{version_id}` → `.xlsx` file download

---

## 10. Design Decisions & Rules

These decisions were made deliberately — do NOT reverse them without understanding the reason.

| Decision | What | Why |
|---|---|---|
| Background colour | `#e0f2fe` (light sky blue) | User explicitly chose this; set in both `theme.js` (MUI) and `index.css` (Tailwind body) |
| No emojis in buttons | "Simulate / Swap" button has no ⚡ emoji | User asked; looks unprofessional |
| Timetable cells compact | Click to expand → see faculty, room, Swap button | Fits all periods on one screen |
| Max 3 options | Solver generates exactly 3 (or fewer if INFEASIBLE) | More would overwhelm HOD decision; old unapproved versions are purged before each solve |
| Student democracy | Only 3 student-centric points per option | Keeps the voting card concise; removed percentage scores, kept raw vote counts |
| Login button | Purple (`primary` theme colour) | Part of login redesign; gradient background is blue |
| `addLabel` in AdminDashboard | `categoryMeta[activeTab].addLabel` not `activeTab.slice(0,-1)` | `slice(0,-1)` was clipping last char ("Add facult" / "Add batche") — this is a fixed bug |
| Same fix in EntityModal | Uses `ENTITY_LABELS` dict | Same root cause — avoid `.slice()` on entity type strings |
| `OptiClassLogo.jsx` kept | Not deleted | May be referenced somewhere; `ClassSquareLogo.jsx` is the current one |

---

## 11. Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@opticlass.edu` | `admin123` |
| HOD | (create via Admin portal, assign HOD role) | `hod123` |
| Faculty | (create via Admin portal, assign Faculty role) | `faculty123` |
| Student | (create via Admin portal, assign Student role) | `student123` |

Admin is auto-seeded on startup. All other roles must be created through the Admin dashboard
or registered via `POST /api/auth/register`.

---

## 12. Demo Seed Data Upload Sequence

The `demo_seed_data/` folder contains 5 validated CSVs. Upload them **in order** via the
Admin dashboard → Bulk Upload:

1. `01_departments.csv` — must be first (others reference department names)
2. `02_rooms.csv`
3. `03_subjects.csv` — includes elective band names
4. `04_faculty.csv` — includes `qualified_subjects` (semicolon-separated subject names)
5. `05_batches.csv`

After all 5 uploads, go to the HOD dashboard, select a department + semester, and click
"Solve Timetable". The CP-SAT solver should return 3 options (validated during seed generation).

> **Note:** `Dr. Claude Shannon` in the faculty CSV is a historical computer scientist name
> (Claude Shannon invented information theory). The name contains "claude" but is NOT an
> AI artifact — it is intentional.

---

## 13. Tests

```bash
# From repo root:
pytest backend/tests/ -v
# Expected: 31 passed, ~3 warnings (SQLAlchemy deprecation warnings — harmless)
```

Test files:
- `test_auth.py` — login, token validation
- `test_departments.py`, `test_rooms.py`, `test_faculty.py`, `test_subjects.py`, `test_batches.py`
- `test_upload.py` — CSV preview + commit
- `test_solver.py` — solver feasibility with minimal data
- `conftest.py` — shared fixtures (in-memory SQLite, test client)

---

## 14. Deployment

### Vercel (frontend)

1. Import the `frontend/` subfolder into Vercel
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add env var: `VITE_API_URL=https://your-render-backend.onrender.com`
5. `vercel.json` already contains the SPA rewrite rule

### Render (backend)

`render.yaml` is already configured with:
- Service: `classsquare-api` (Python, uvicorn)
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Env var: `SECRET_KEY` (add in Render dashboard)

### Docker (self-hosted)

```bash
docker-compose up --build
```

---

## 15. Known Issues & Watch-Outs

| Issue | Status | Detail |
|---|---|---|
| `database.py` default DB name | Minor cosmetic | Default path still says `smay.db`; Docker volume was updated to `classsquare.db` but `database.py` env-var default may say `smay.db` — fine for development |
| `.pytest_cache` at root | Should be gitignored | `.gitignore` covers it but git may have already tracked it if committed before — run `git rm -r --cached .pytest_cache` if it shows in `git status` |
| `test_shared.db` at root | Leftover | May appear after running tests from root; is gitignored |
| `OptiClassLogo.jsx` | Dead component | Not deleted in case some page imports it; check before removing |
| Solver status = `"SUCCESS"` | API contract | Do NOT check for `"OPTIMAL"` or `"FEASIBLE"` in frontend — the scheduler always returns `"SUCCESS"` |
| `linked_faculty_id` on User | Foreign key | Links a `UserRole.faculty` user account to a `Faculty` record; must be set for faculty dashboard to show correct timetable |
| Voting tab visibility | Conditional render | Student sees Democracy tab ONLY when `voting_open === true` from the backend; do not always render it |
| HOD solver — semester filter | Nullable | `semester=None` fetches ALL semesters for the department — usually not what you want; always pass a semester |

---

## 16. Adding New Features — Where to Look

| Task | Files to touch |
|---|---|
| New entity type (e.g. Exam) | `models/exam.py` → `routers/exam.py` → `schemas/entities.py` → `api/entities.js` → `AdminDashboard.jsx` |
| New API endpoint | `routers/<file>.py` → register in `main.py` → add to `api/<file>.js` |
| New timetable constraint | `solver/model.py` `build_model()` → update `solver/diagnostics.py` if it affects infeasibility messages |
| Change UI colours | `theme.js` (MUI) AND `index.css` (Tailwind body) — both must match |
| New button label | Add to `categoryMeta` in `AdminDashboard.jsx` AND `ENTITY_LABELS` in `EntityModal.jsx` — never use `.slice(0,-1)` |
| New user role | `models/user.py` UserRole enum → auth dependencies → new route guard → new page in `App.jsx` |
| Modify CSV upload format | `routers/upload.py` TEMPLATES dict + parsing logic |

---

## 17. Git Hygiene

The `.gitignore` excludes all of the following — **do not commit them**:

- `venv/`, `node_modules/`, `frontend/dist/`
- `*.db`, `backend/data/*.db`, `test*.db`
- `.env`, `.env.*` (but `*.env.example` is committed)
- `.gemini/`, `.cursor/`, `.windsurf/`, `GEMINI.md`, `CLAUDE.md`
- `edge_*.png`, `screen_*.png`, `screenshot*.png`
- `.pytest_cache/`, `__pycache__/`, `scratch/`, `tmp/`, `temp/`

---

## 18. What Was Last Worked On

The most recent development work (in order):

1. ✅ Login page redesign (blue gradient, ClassSquare logo, purple button)
2. ✅ HOD solver: 3 options max, compact timetable cells, click-to-expand
3. ✅ Student Democracy tab — only 3 bullet points, raw vote counts, conditional visibility
4. ✅ Admin Clear Data — danger zone footer per entity tab, confirmation modal, cascading delete
5. ✅ Background colour set to `#e0f2fe` across all pages
6. ✅ Fixed "Add facult" / "Add batche" truncation bug in AdminDashboard + EntityModal
7. ✅ Removed `⚡` emoji from "Simulate / Swap" button in TimetableGrid
8. ✅ Created `demo_seed_data/` — 5 validated CSVs
9. ✅ Full README rewrite with ClassSquare branding
10. ✅ GitHub cleanup: deleted test DBs, screenshots, moved GEMINI.md → docs/DESIGN_SYSTEM.md
11. ✅ Updated branding: docker-compose, render.yaml, package.json, main.py FastAPI title
12. ✅ All 31 tests passing; `npm run build` clean (0 errors)

**The next things to work on** (user has not specified yet):
- Setting up the GitHub remote repository and pushing (user needs to install Git first via winget)
- Deployment to Vercel + Render
- Any additional feature requests

---

*Last updated: session ending 2026-10-05. Generated to give a fresh agent full context.*
