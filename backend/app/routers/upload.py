import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.database import get_db
from app.models.department import Department, Shift
from app.models.room import Room
from app.models.faculty import Faculty
from app.models.subject import Subject, ElectiveBand
from app.models.batch import Batch
from app.models.user import User, UserRole
from app.schemas.entities import (
    UploadPreviewResponse, UploadCommitRequest, UploadCommitResponse, RowError, ClearCategoryResponse
)
from app.auth.dependencies import require_role
from app.services.clear_service import clear_entity_records

router = APIRouter(prefix="/api/upload", tags=["Bulk Upload & Ingestion"])

ALLOWED_ENTITIES = ["departments", "rooms", "faculty", "subjects", "batches"]

TEMPLATES = {
    "departments": "name,shift\nComputer Science,morning\nMechanical Engineering,evening\n",
    "rooms": "name,capacity,is_lab,department_name\nLab-101,40,true,Computer Science\nLH-201,70,false,\n",
    "faculty": "name,department_name,max_classes_per_day,max_classes_per_week,avg_monthly_leaves,qualified_subjects\nDr. Alan Turing,Computer Science,4,16,1.5,Operating Systems;Data Structures\nProf. Ada Lovelace,Computer Science,3,14,2.0,Algorithms\n",
    "subjects": "name,department_name,semester,sessions_per_week,is_lab,is_elective,elective_band_name\nData Structures,Computer Science,3,4,false,false,\nAI Lab,Computer Science,5,3,true,false,\nCyber Law,Computer Science,5,3,false,true,Open Elective Band A\n",
    "batches": "name,department_name,semester,shift,strength\nCS-3A,Computer Science,3,morning,60\nCS-5B,Computer Science,5,morning,55\nME-3A,Mechanical Engineering,3,evening,65\n"
}

@router.get("/template/{entity_type}")
def get_template(entity_type: str):
    entity_type = entity_type.lower()
    if entity_type not in TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Invalid entity type. Allowed: {ALLOWED_ENTITIES}")
    
    csv_data = TEMPLATES[entity_type]
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={entity_type}_template.csv"}
    )

def _read_file_to_df(file: UploadFile) -> pd.DataFrame:
    content = file.file.read()
    filename = file.filename.lower() if file.filename else ""
    try:
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(content))
        else:
            df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
    
    df = df.fillna("")
    # Strip whitespace from column names and string values
    df.columns = [str(c).strip().lower() for c in df.columns]
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].astype(str).str.strip()
    return df

@router.post("/preview", response_model=UploadPreviewResponse)
async def preview_upload(
    entity_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    entity_type = entity_type.lower()
    if entity_type not in ALLOWED_ENTITIES:
        raise HTTPException(status_code=400, detail=f"Invalid entity type. Allowed: {ALLOWED_ENTITIES}")

    df = _read_file_to_df(file)
    total_rows = len(df)
    valid_rows = []
    invalid_rows = []

    # Pre-fetch lookup caches
    dept_map = {d.name.lower(): d for d in db.query(Department).all()}
    band_map = {b.name.lower(): b for b in db.query(ElectiveBand).all()}
    sub_map = {s.name.lower(): s for s in db.query(Subject).all()}

    for index, row in df.iterrows():
        row_dict = row.to_dict()
        errors = []

        if entity_type == "departments":
            name = str(row_dict.get("name", "")).strip()
            shift_str = str(row_dict.get("shift", "morning")).strip().lower()
            if not name:
                errors.append("Department name is required.")
            elif name.lower() in dept_map:
                errors.append(f"Department '{name}' already exists.")
            if shift_str not in ["morning", "evening"]:
                errors.append(f"Invalid shift '{shift_str}'. Must be 'morning' or 'evening'.")

        elif entity_type == "rooms":
            name = str(row_dict.get("name", "")).strip()
            cap_val = row_dict.get("capacity")
            is_lab_str = str(row_dict.get("is_lab", "false")).strip().lower()
            dept_name = str(row_dict.get("department_name", "")).strip()

            if not name:
                errors.append("Room name is required.")
            try:
                capacity = int(cap_val)
                if capacity <= 0:
                    errors.append("Capacity must be greater than 0.")
            except (ValueError, TypeError):
                errors.append("Capacity must be a valid positive integer.")

            if dept_name and dept_name.lower() not in dept_map:
                errors.append(f"Department '{dept_name}' not found.")

        elif entity_type == "faculty":
            name = str(row_dict.get("name", "")).strip()
            dept_name = str(row_dict.get("department_name", "")).strip()
            max_day = row_dict.get("max_classes_per_day", 4)
            max_week = row_dict.get("max_classes_per_week", 18)
            leaves = row_dict.get("avg_monthly_leaves", 2.0)
            qualified_subjects = str(row_dict.get("qualified_subjects", "")).strip()

            if not name:
                errors.append("Faculty name is required.")
            if not dept_name:
                errors.append("Department name is required.")
            elif dept_name.lower() not in dept_map:
                errors.append(f"Department '{dept_name}' not found.")

            try:
                m_day = int(max_day)
                m_week = int(max_week)
                if m_day <= 0 or m_week <= 0:
                    errors.append("Class load limits must be positive integers.")
                elif m_day > m_week:
                    errors.append("Max classes per day cannot exceed max classes per week.")
            except (ValueError, TypeError):
                errors.append("Max classes per day/week must be valid integers.")

            if qualified_subjects:
                subs = [s.strip() for s in qualified_subjects.split(";") if s.strip()]
                for s in subs:
                    if s.lower() not in sub_map:
                        errors.append(f"Qualified subject '{s}' does not exist in the system.")

        elif entity_type == "subjects":
            name = str(row_dict.get("name", "")).strip()
            dept_name = str(row_dict.get("department_name", "")).strip()
            sem_val = row_dict.get("semester")
            sess_val = row_dict.get("sessions_per_week")
            is_elec_str = str(row_dict.get("is_elective", "false")).strip().lower()
            band_name = str(row_dict.get("elective_band_name", "")).strip()

            if not name:
                errors.append("Subject name is required.")
            if not dept_name:
                errors.append("Department name is required.")
            elif dept_name.lower() not in dept_map:
                errors.append(f"Department '{dept_name}' not found.")

            try:
                sem = int(sem_val)
                if sem < 1 or sem > 12:
                    errors.append("Semester must be between 1 and 12.")
            except (ValueError, TypeError):
                errors.append("Semester must be an integer.")

            try:
                sess = int(sess_val)
                if sess < 1 or sess > 20:
                    errors.append("Sessions per week must be between 1 and 20.")
            except (ValueError, TypeError):
                errors.append("Sessions per week must be an integer.")

            if is_elec_str in ["true", "1", "yes"] and band_name:
                # If band name doesn't exist yet, we will auto-create or validate
                pass

        elif entity_type == "batches":
            name = str(row_dict.get("name", "")).strip()
            dept_name = str(row_dict.get("department_name", "")).strip()
            sem_val = row_dict.get("semester")
            shift_str = str(row_dict.get("shift", "morning")).strip().lower()
            str_val = row_dict.get("strength")

            if not name:
                errors.append("Batch name is required.")
            if not dept_name:
                errors.append("Department name is required.")
            elif dept_name.lower() not in dept_map:
                errors.append(f"Department '{dept_name}' not found.")

            try:
                sem = int(sem_val)
                if sem < 1 or sem > 12:
                    errors.append("Semester must be between 1 and 12.")
            except (ValueError, TypeError):
                errors.append("Semester must be an integer.")

            if shift_str not in ["morning", "evening"]:
                errors.append(f"Invalid shift '{shift_str}'. Must be 'morning' or 'evening'.")

            try:
                st = int(str_val)
                if st <= 0:
                    errors.append("Strength must be greater than 0.")
            except (ValueError, TypeError):
                errors.append("Strength must be a valid positive integer.")

        if errors:
            invalid_rows.append(RowError(row_index=index + 1, errors=errors, data=row_dict))
        else:
            valid_rows.append(row_dict)

    return UploadPreviewResponse(
        entity_type=entity_type,
        total_rows=total_rows,
        valid_count=len(valid_rows),
        error_count=len(invalid_rows),
        valid_rows=valid_rows,
        invalid_rows=invalid_rows
    )

@router.post("/commit", response_model=UploadCommitResponse)
def commit_upload(
    req: UploadCommitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin, UserRole.hod))
):
    entity_type = req.entity_type.lower()
    if entity_type not in ALLOWED_ENTITIES:
        raise HTTPException(status_code=400, detail=f"Invalid entity type. Allowed: {ALLOWED_ENTITIES}")

    dept_map = {d.name.lower(): d for d in db.query(Department).all()}
    sub_map = {s.name.lower(): s for s in db.query(Subject).all()}
    band_map = {b.name.lower(): b for b in db.query(ElectiveBand).all()}

    inserted = 0

    if entity_type == "departments":
        for row in req.rows:
            name = str(row.get("name", "")).strip()
            shift_val = Shift(row.get("shift", "morning").lower())
            dept = Department(name=name, shift=shift_val)
            db.add(dept)
            inserted += 1

    elif entity_type == "rooms":
        for row in req.rows:
            name = str(row.get("name", "")).strip()
            capacity = int(row.get("capacity", 0))
            is_lab = str(row.get("is_lab", "false")).lower() in ["true", "1", "yes"]
            dept_name = str(row.get("department_name", "")).strip()
            dept = dept_map.get(dept_name.lower()) if dept_name else None

            room = Room(name=name, capacity=capacity, is_lab=is_lab, department_id=dept.id if dept else None)
            db.add(room)
            inserted += 1

    elif entity_type == "subjects":
        for row in req.rows:
            name = str(row.get("name", "")).strip()
            dept_name = str(row.get("department_name", "")).strip()
            dept = dept_map[dept_name.lower()]
            sem = int(row.get("semester"))
            sess = int(row.get("sessions_per_week", 3))
            is_lab = str(row.get("is_lab", "false")).lower() in ["true", "1", "yes"]
            is_elec = str(row.get("is_elective", "false")).lower() in ["true", "1", "yes"]
            band_name = str(row.get("elective_band_name", "")).strip()
            
            band_id = None
            if is_elec and band_name:
                if band_name.lower() in band_map:
                    band_id = band_map[band_name.lower()].id
                else:
                    new_band = ElectiveBand(name=band_name)
                    db.add(new_band)
                    db.flush()
                    band_map[band_name.lower()] = new_band
                    band_id = new_band.id

            subj = Subject(
                name=name,
                department_id=dept.id,
                semester=sem,
                sessions_per_week=sess,
                is_lab=is_lab,
                is_elective=is_elec,
                elective_band_id=band_id
            )
            db.add(subj)
            inserted += 1

    elif entity_type == "faculty":
        for row in req.rows:
            name = str(row.get("name", "")).strip()
            dept_name = str(row.get("department_name", "")).strip()
            dept = dept_map[dept_name.lower()]
            max_day = int(row.get("max_classes_per_day", 4))
            max_week = int(row.get("max_classes_per_week", 18))
            leaves = float(row.get("avg_monthly_leaves", 2.0))
            qualified_subjects = str(row.get("qualified_subjects", "")).strip()

            fac = Faculty(
                name=name,
                department_id=dept.id,
                max_classes_per_day=max_day,
                max_classes_per_week=max_week,
                avg_monthly_leaves=leaves
            )
            db.add(fac)
            db.flush()

            if qualified_subjects:
                subs = [s.strip() for s in qualified_subjects.split(";") if s.strip()]
                matched_subs = [sub_map[s.lower()] for s in subs if s.lower() in sub_map]
                fac.subjects = matched_subs
            inserted += 1

    elif entity_type == "batches":
        for row in req.rows:
            name = str(row.get("name", "")).strip()
            dept_name = str(row.get("department_name", "")).strip()
            dept = dept_map[dept_name.lower()]
            sem = int(row.get("semester"))
            shift_val = Shift(row.get("shift", "morning").lower())
            strength = int(row.get("strength"))

            b = Batch(
                name=name,
                department_id=dept.id,
                semester=sem,
                shift=shift_val,
                strength=strength
            )
            db.add(b)
            inserted += 1

    db.commit()
    return UploadCommitResponse(
        entity_type=entity_type,
        inserted_count=inserted,
        message=f"Successfully imported {inserted} {entity_type} records."
    )

@router.delete("/clear/{entity_type}", response_model=ClearCategoryResponse)
def clear_entity_data(
    entity_type: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin))
):
    count = clear_entity_records(entity_type, db)
    return ClearCategoryResponse(
        entity_type=entity_type,
        deleted_count=count,
        message=f"Successfully cleared {count} {entity_type} records."
    )

