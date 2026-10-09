import os
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.classroom import ClassMaterial, StudentSubmission
from app.models.batch import Batch
from app.models.subject import Subject
from app.models.faculty import Faculty, FacultySubject
from app.models.timetable import TimetableSlot
from app.models.user import User, UserRole
from app.schemas.classroom import MaterialResponse, SubmissionResponse, BatchSubjectSummary
from app.auth.dependencies import get_current_user, require_role
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api/classroom", tags=["Classroom Materials"])

UPLOAD_DIR = os.path.join("data", "uploads", "classroom")
MATERIALS_DIR = os.path.join(UPLOAD_DIR, "materials")
SUBMISSIONS_DIR = os.path.join(UPLOAD_DIR, "submissions")

os.makedirs(MATERIALS_DIR, exist_ok=True)
os.makedirs(SUBMISSIONS_DIR, exist_ok=True)


def _save_file(file: UploadFile, target_dir: str):
    clean_name = os.path.basename(file.filename or "file")
    unique_prefix = uuid.uuid4().hex[:12]
    disk_name = f"{unique_prefix}_{clean_name}"
    disk_path = os.path.join(target_dir, disk_name)
    
    content = file.file.read()
    with open(disk_path, "wb") as f:
        f.write(content)
    file_size = len(content)
    return clean_name, disk_path, file_size


def _to_submission_response(sub: StudentSubmission) -> SubmissionResponse:
    return SubmissionResponse(
        id=sub.id,
        material_id=sub.material_id,
        student_id=sub.student_id,
        student_name=sub.student_name,
        file_name=sub.file_name,
        file_size=sub.file_size,
        notes=sub.notes,
        status=sub.status,
        submitted_at=sub.submitted_at
    )


def _to_material_response(m: ClassMaterial, db: Session, current_user: Optional[User] = None) -> MaterialResponse:
    sub_count = db.query(StudentSubmission).filter(StudentSubmission.material_id == m.id).count()
    
    my_sub = None
    if current_user:
        user_sub = db.query(StudentSubmission).filter(
            StudentSubmission.material_id == m.id,
            StudentSubmission.student_id == current_user.id
        ).first()
        if user_sub:
            my_sub = _to_submission_response(user_sub)
            
    return MaterialResponse(
        id=m.id,
        title=m.title,
        description=m.description,
        type=m.type,
        batch_id=m.batch_id,
        batch_name=m.batch.name if m.batch else None,
        subject_id=m.subject_id,
        subject_name=m.subject.name if m.subject else None,
        faculty_id=m.faculty_id,
        faculty_name=m.faculty.name if m.faculty else None,
        file_name=m.file_name,
        file_size=m.file_size,
        has_file=bool(m.file_path and os.path.exists(m.file_path)),
        due_date=m.due_date,
        created_at=m.created_at,
        submissions_count=sub_count,
        my_submission=my_sub
    )


@router.post("/materials", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED)
def create_material(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    type: str = Form("material"),  # 'material', 'assignment', 'announcement'
    batch_id: int = Form(...),
    subject_id: int = Form(...),
    due_date: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.faculty, UserRole.hod, UserRole.admin))
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Resolve faculty
    faculty_id = None
    if current_user.linked_faculty_id:
        faculty_id = current_user.linked_faculty_id
    else:
        first_fac = db.query(Faculty).first()
        faculty_id = first_fac.id if first_fac else 1

    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()

    # Enforce teaching authorization: Faculty can ONLY upload work for subjects they teach
    if current_user.role == UserRole.faculty and faculty:
        teaches_via_mapping = db.query(FacultySubject).filter(
            FacultySubject.faculty_id == faculty.id,
            FacultySubject.subject_id == subject_id
        ).first() is not None

        teaches_via_slot = db.query(TimetableSlot).filter(
            TimetableSlot.faculty_id == faculty.id,
            TimetableSlot.subject_id == subject_id
        ).first() is not None

        if not teaches_via_mapping and not teaches_via_slot:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: You are only authorized to upload coursework for subjects you teach. '{subject.name}' is not assigned to your teaching profile."
            )

    # Parse due date if assignment
    parsed_due_date = None
    if due_date and due_date.strip():
        try:
            clean_date_str = due_date.strip().replace('Z', '')
            if 'T' in clean_date_str:
                parsed_due_date = datetime.fromisoformat(clean_date_str)
            else:
                parsed_due_date = datetime.strptime(clean_date_str, "%Y-%m-%d")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid due_date format. Use YYYY-MM-DD or ISO format.")

    # Handle file upload
    file_name, file_path, file_size = None, None, None
    if file and file.filename:
        file_name, file_path, file_size = _save_file(file, MATERIALS_DIR)

    material = ClassMaterial(
        title=title.strip(),
        description=description.strip() if description else None,
        type=type,
        batch_id=batch_id,
        subject_id=subject_id,
        faculty_id=faculty_id,
        file_name=file_name,
        file_path=file_path,
        file_size=file_size,
        due_date=parsed_due_date
    )
    db.add(material)
    db.commit()
    db.refresh(material)

    # In-app notification to students
    fac_name = faculty.name if faculty else "Faculty"
    if type == "assignment":
        due_str = f" (Due: {parsed_due_date.strftime('%b %d, %Y')})" if parsed_due_date else ""
        create_notification(
            db=db,
            title=f"New Assignment: {material.title}",
            message=f"{fac_name} posted an assignment for {batch.name} - {subject.name}{due_str}.",
            type="classroom_assignment",
            role="student",
            link="/student"
        )
    elif type == "material":
        create_notification(
            db=db,
            title=f"New Study Material: {material.title}",
            message=f"{fac_name} uploaded course resources for {batch.name} - {subject.name}.",
            type="classroom_material",
            role="student",
            link="/student"
        )
    else:
        create_notification(
            db=db,
            title=f"Classroom Announcement: {material.title}",
            message=f"{fac_name} posted an announcement for {batch.name} - {subject.name}.",
            type="classroom",
            role="student",
            link="/student"
        )

    return _to_material_response(material, db, current_user)


@router.get("/materials", response_model=List[MaterialResponse])
def get_materials(
    batch_id: Optional[int] = None,
    faculty_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ClassMaterial)
    if batch_id:
        query = query.filter(ClassMaterial.batch_id == batch_id)
    if faculty_id:
        query = query.filter(ClassMaterial.faculty_id == faculty_id)
    elif current_user.role == UserRole.faculty and current_user.linked_faculty_id and not batch_id:
        query = query.filter(ClassMaterial.faculty_id == current_user.linked_faculty_id)

    if subject_id:
        query = query.filter(ClassMaterial.subject_id == subject_id)

    if type:
        query = query.filter(ClassMaterial.type == type)

    materials = query.order_by(ClassMaterial.created_at.desc()).all()
    return [_to_material_response(m, db, current_user) for m in materials]


@router.get("/batches/{batch_id}/subjects", response_model=List[BatchSubjectSummary])
def get_batch_subjects(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Get all subjects matching this batch's department and semester
    subjects = db.query(Subject).filter(
        Subject.department_id == batch.department_id,
        Subject.semester == batch.semester
    ).order_by(Subject.is_lab.asc(), Subject.name.asc()).all()

    all_materials = db.query(ClassMaterial).filter(ClassMaterial.batch_id == batch_id).all()

    student_submissions_map = {}
    if current_user.role == UserRole.student:
        subs = db.query(StudentSubmission).filter(
            StudentSubmission.student_id == current_user.id
        ).all()
        student_submissions_map = {s.material_id: s for s in subs}

    results = []
    for s in subjects:
        subj_materials = [m for m in all_materials if m.subject_id == s.id]
        total_mats = len(subj_materials)
        notes_count = sum(1 for m in subj_materials if m.type == "material")
        assign_count = sum(1 for m in subj_materials if m.type == "assignment")
        ann_count = sum(1 for m in subj_materials if m.type == "announcement")

        pending_assign = 0
        if current_user.role == UserRole.student:
            pending_assign = sum(
                1 for m in subj_materials
                if m.type == "assignment" and m.id not in student_submissions_map
            )

        faculty_name = None
        if s.faculty_members and len(s.faculty_members) > 0:
            faculty_name = s.faculty_members[0].name
        else:
            for m in subj_materials:
                if m.faculty:
                    faculty_name = m.faculty.name
                    break

        results.append(
            BatchSubjectSummary(
                id=s.id,
                name=s.name,
                is_lab=s.is_lab,
                is_elective=s.is_elective,
                sessions_per_week=s.sessions_per_week,
                faculty_name=faculty_name,
                total_materials=total_mats,
                notes_count=notes_count,
                assignment_count=assign_count,
                announcement_count=ann_count,
                pending_assignments_count=pending_assign
            )
        )

    return results


@router.delete("/materials/{id}")
def delete_material(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.faculty, UserRole.hod, UserRole.admin))
):
    material = db.query(ClassMaterial).filter(ClassMaterial.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    if current_user.role == UserRole.faculty and current_user.linked_faculty_id != material.faculty_id:
        raise HTTPException(status_code=403, detail="You can only delete your own materials")

    if material.file_path and os.path.exists(material.file_path):
        try:
            os.remove(material.file_path)
        except OSError:
            pass

    submissions = db.query(StudentSubmission).filter(StudentSubmission.material_id == id).all()
    for sub in submissions:
        if sub.file_path and os.path.exists(sub.file_path):
            try:
                os.remove(sub.file_path)
            except OSError:
                pass

    db.delete(material)
    db.commit()
    return {"detail": "Material and submissions deleted successfully"}


@router.get("/materials/{id}/download")
def download_material_file(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    material = db.query(ClassMaterial).filter(ClassMaterial.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    if not material.file_path or not os.path.exists(material.file_path):
        raise HTTPException(status_code=404, detail="Attached file not found on disk")

    return FileResponse(
        path=material.file_path,
        filename=material.file_name or "download",
        media_type="application/octet-stream"
    )


@router.post("/materials/{id}/submit", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
def submit_assignment(
    id: int,
    file: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    material = db.query(ClassMaterial).filter(ClassMaterial.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if material.type != "assignment":
        raise HTTPException(status_code=400, detail="Submissions are only allowed for assignments")

    student_name = current_user.email.split('@')[0].replace('.', ' ').title()
    if current_user.email == "student.cse@opticlass.edu":
        student_name = "Alex Chen (Roll: CS-2024-042)"

    now = datetime.utcnow()
    sub_status = "submitted"
    if material.due_date and now > material.due_date:
        sub_status = "late"

    file_name, file_path, file_size = _save_file(file, SUBMISSIONS_DIR)

    existing = db.query(StudentSubmission).filter(
        StudentSubmission.material_id == id,
        StudentSubmission.student_id == current_user.id
    ).first()

    if existing:
        if existing.file_path and os.path.exists(existing.file_path):
            try:
                os.remove(existing.file_path)
            except OSError:
                pass
        existing.file_name = file_name
        existing.file_path = file_path
        existing.file_size = file_size
        existing.notes = notes.strip() if notes else None
        existing.status = sub_status
        existing.submitted_at = now
        submission = existing
    else:
        submission = StudentSubmission(
            material_id=id,
            student_id=current_user.id,
            student_name=student_name,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            notes=notes.strip() if notes else None,
            status=sub_status,
            submitted_at=now
        )
        db.add(submission)

    db.commit()
    db.refresh(submission)

    # 1. Notify the assigned faculty member directly
    fac_user = db.query(User).filter(User.linked_faculty_id == material.faculty_id).first() if material.faculty_id else None
    create_notification(
        db=db,
        user_id=fac_user.id if fac_user else None,
        role="faculty" if not fac_user else None,
        title=f"New Submission: {material.title}",
        message=f"{student_name} submitted work for '{material.title}' ({sub_status.upper()}).",
        type="submission_received",
        link="/faculty"
    )

    # 2. Provide instant submission receipt to student
    create_notification(
        db=db,
        user_id=current_user.id,
        role=None,
        title="Submission Confirmed",
        message=f"Your submission for '{material.title}' was successfully received ({sub_status.upper()}).",
        type="submission_receipt",
        link="/student"
    )

    return _to_submission_response(submission)


@router.get("/materials/{id}/submissions", response_model=List[SubmissionResponse])
def get_assignment_submissions(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.faculty, UserRole.hod, UserRole.admin))
):
    material = db.query(ClassMaterial).filter(ClassMaterial.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    submissions = db.query(StudentSubmission).filter(
        StudentSubmission.material_id == id
    ).order_by(StudentSubmission.submitted_at.desc()).all()

    return [_to_submission_response(s) for s in submissions]


@router.get("/submissions/{id}/download")
def download_submission_file(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    sub = db.query(StudentSubmission).filter(StudentSubmission.id == id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    if current_user.role == UserRole.student and sub.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied to other student submissions")

    if not sub.file_path or not os.path.exists(sub.file_path):
        raise HTTPException(status_code=404, detail="Submitted file not found on disk")

    return FileResponse(
        path=sub.file_path,
        filename=sub.file_name or "submission",
        media_type="application/octet-stream"
    )


@router.get("/my-submissions", response_model=List[SubmissionResponse])
def get_my_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    submissions = db.query(StudentSubmission).filter(
        StudentSubmission.student_id == current_user.id
    ).order_by(StudentSubmission.submitted_at.desc()).all()

    return [_to_submission_response(s) for s in submissions]
