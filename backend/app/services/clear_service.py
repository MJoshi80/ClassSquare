from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.department import Department
from app.models.room import Room
from app.models.faculty import Faculty, FacultySubject
from app.models.subject import Subject
from app.models.batch import Batch, FixedSlot
from app.models.timetable import TimetableVersion, TimetableSlot
from app.models.classroom import ClassMaterial, StudentSubmission
from app.models.leave import FacultyLeave
from app.models.vote import TimetableVote
from app.models.approval import ApprovalLog
from app.models.user import User

ALLOWED_ENTITIES = ["departments", "rooms", "faculty", "subjects", "batches"]

def clear_entity_records(entity_type: str, db: Session) -> int:
    """
    Safely clears all records for a given entity type while cleaning up
    referencing foreign keys and cascading relations.
    Returns the count of deleted primary records.
    """
    entity_type = entity_type.lower()
    if entity_type not in ALLOWED_ENTITIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity type '{entity_type}'. Allowed: {ALLOWED_ENTITIES}"
        )

    if entity_type == "rooms":
        room_ids = [r[0] for r in db.query(Room.id).all()]
        if not room_ids:
            return 0
        db.query(FixedSlot).filter(FixedSlot.room_id.in_(room_ids)).delete(synchronize_session=False)
        db.query(TimetableSlot).filter(TimetableSlot.room_id.in_(room_ids)).delete(synchronize_session=False)
        deleted = db.query(Room).filter(Room.id.in_(room_ids)).delete(synchronize_session=False)
        db.commit()
        return deleted

    elif entity_type == "faculty":
        fac_ids = [f[0] for f in db.query(Faculty.id).all()]
        if not fac_ids:
            return 0
        db.query(FacultyLeave).filter(
            (FacultyLeave.faculty_id.in_(fac_ids)) | (FacultyLeave.substitute_faculty_id.in_(fac_ids))
        ).delete(synchronize_session=False)
        db.query(User).filter(User.linked_faculty_id.in_(fac_ids)).update(
            {User.linked_faculty_id: None}, synchronize_session=False
        )
        db.query(FacultySubject).filter(FacultySubject.faculty_id.in_(fac_ids)).delete(synchronize_session=False)
        db.query(TimetableSlot).filter(TimetableSlot.faculty_id.in_(fac_ids)).delete(synchronize_session=False)
        mat_ids = [m[0] for m in db.query(ClassMaterial.id).filter(ClassMaterial.faculty_id.in_(fac_ids)).all()]
        if mat_ids:
            db.query(StudentSubmission).filter(StudentSubmission.material_id.in_(mat_ids)).delete(synchronize_session=False)
            db.query(ClassMaterial).filter(ClassMaterial.id.in_(mat_ids)).delete(synchronize_session=False)
        deleted = db.query(Faculty).filter(Faculty.id.in_(fac_ids)).delete(synchronize_session=False)
        db.commit()
        return deleted

    elif entity_type == "subjects":
        sub_ids = [s[0] for s in db.query(Subject.id).all()]
        if not sub_ids:
            return 0
        mat_ids = [m[0] for m in db.query(ClassMaterial.id).filter(ClassMaterial.subject_id.in_(sub_ids)).all()]
        if mat_ids:
            db.query(StudentSubmission).filter(StudentSubmission.material_id.in_(mat_ids)).delete(synchronize_session=False)
            db.query(ClassMaterial).filter(ClassMaterial.id.in_(mat_ids)).delete(synchronize_session=False)
        db.query(FixedSlot).filter(FixedSlot.subject_id.in_(sub_ids)).delete(synchronize_session=False)
        db.query(FacultySubject).filter(FacultySubject.subject_id.in_(sub_ids)).delete(synchronize_session=False)
        db.query(TimetableSlot).filter(TimetableSlot.subject_id.in_(sub_ids)).delete(synchronize_session=False)
        deleted = db.query(Subject).filter(Subject.id.in_(sub_ids)).delete(synchronize_session=False)
        db.commit()
        return deleted

    elif entity_type == "batches":
        batch_ids = [b[0] for b in db.query(Batch.id).all()]
        if not batch_ids:
            return 0
        mat_ids = [m[0] for m in db.query(ClassMaterial.id).filter(ClassMaterial.batch_id.in_(batch_ids)).all()]
        if mat_ids:
            db.query(StudentSubmission).filter(StudentSubmission.material_id.in_(mat_ids)).delete(synchronize_session=False)
            db.query(ClassMaterial).filter(ClassMaterial.id.in_(mat_ids)).delete(synchronize_session=False)
        db.query(FixedSlot).filter(FixedSlot.batch_id.in_(batch_ids)).delete(synchronize_session=False)
        db.query(TimetableSlot).filter(TimetableSlot.batch_id.in_(batch_ids)).delete(synchronize_session=False)
        v_ids = [v[0] for v in db.query(TimetableVersion.id).filter(TimetableVersion.batch_id.in_(batch_ids)).all()]
        if v_ids:
            db.query(TimetableVote).filter(TimetableVote.timetable_version_id.in_(v_ids)).delete(synchronize_session=False)
            db.query(ApprovalLog).filter(ApprovalLog.timetable_version_id.in_(v_ids)).delete(synchronize_session=False)
            db.query(TimetableSlot).filter(TimetableSlot.timetable_version_id.in_(v_ids)).delete(synchronize_session=False)
            db.query(TimetableVersion).filter(TimetableVersion.id.in_(v_ids)).delete(synchronize_session=False)
        deleted = db.query(Batch).filter(Batch.id.in_(batch_ids)).delete(synchronize_session=False)
        db.commit()
        return deleted

    elif entity_type == "departments":
        dept_ids = [d[0] for d in db.query(Department.id).all()]
        if not dept_ids:
            return 0
        db.query(User).filter(User.department_id.in_(dept_ids)).update(
            {User.department_id: None}, synchronize_session=False
        )
        clear_entity_records("batches", db)
        clear_entity_records("subjects", db)
        clear_entity_records("faculty", db)
        clear_entity_records("rooms", db)

        v_ids = [v[0] for v in db.query(TimetableVersion.id).filter(TimetableVersion.department_id.in_(dept_ids)).all()]
        if v_ids:
            db.query(TimetableVote).filter(TimetableVote.timetable_version_id.in_(v_ids)).delete(synchronize_session=False)
            db.query(ApprovalLog).filter(ApprovalLog.timetable_version_id.in_(v_ids)).delete(synchronize_session=False)
            db.query(TimetableSlot).filter(TimetableSlot.timetable_version_id.in_(v_ids)).delete(synchronize_session=False)
            db.query(TimetableVersion).filter(TimetableVersion.id.in_(v_ids)).delete(synchronize_session=False)
        db.query(TimetableVote).filter(TimetableVote.department_id.in_(dept_ids)).delete(synchronize_session=False)

        deleted = db.query(Department).filter(Department.id.in_(dept_ids)).delete(synchronize_session=False)
        db.commit()
        return deleted

    return 0
