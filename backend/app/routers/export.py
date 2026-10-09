import io
import csv
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import pandas as pd

from app.database import get_db
from app.models.timetable import TimetableVersion, TimetableSlot, TimetableStatus
from app.models.batch import Batch
from app.models.faculty import Faculty
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/export", tags=["Export & Calendar Sync"])

DAYS_MAP = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday"}
DAYS_ICAL = {0: "MO", 1: "TU", 2: "WE", 3: "TH", 4: "FR"}

PERIOD_TIMES = {
    1: ("09:00:00", "10:00:00"),
    2: ("10:00:00", "11:00:00"),
    3: ("11:00:00", "12:00:00"),
    4: ("12:00:00", "13:00:00"),
    5: ("14:00:00", "15:00:00"),
    6: ("15:00:00", "16:00:00"),
}

def _get_next_weekday(start_date: date, weekday: int) -> date:
    """Return next date matching weekday (0=Mon...4=Fri)."""
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days_ahead)

def _build_ical_content(slots, title: str) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//OptiClass AI//AI Timetable Scheduler//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{title}",
    ]

    base_date = date.today()
    for s in slots:
        day_idx = s.day
        period_idx = s.period
        time_pair = PERIOD_TIMES.get(period_idx, ("09:00:00", "10:00:00"))
        first_date = _get_next_weekday(base_date, day_idx)

        dtstart_str = f"{first_date.strftime('%Y%m%d')}T{time_pair[0].replace(':', '')}"
        dtend_str = f"{first_date.strftime('%Y%m%d')}T{time_pair[1].replace(':', '')}"
        dtstamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        uid = f"slot-{s.id}-{dtstart_str}@opticlass.edu"

        subject_name = s.subject.name if s.subject else "Class"
        is_lab = s.subject.is_lab if s.subject else False
        summary = f"{'[LAB] ' if is_lab else ''}{subject_name}"
        faculty_name = s.faculty.name if s.faculty else "Instructor"
        room_name = s.room.name if s.room else "Room"
        batch_name = s.batch.name if s.batch else "Batch"
        location = f"{room_name} ({'Lab' if is_lab else 'Classroom'})"
        description = f"Subject: {subject_name}\nFaculty: {faculty_name}\nCohort: {batch_name}\nPeriod: {period_idx}"

        byday = DAYS_ICAL.get(day_idx, "MO")

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{dtstamp}",
            f"DTSTART:{dtstart_str}",
            f"DTEND:{dtend_str}",
            f"RRULE:FREQ=WEEKLY;COUNT=16;BYDAY={byday}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description}",
            f"LOCATION:{location}",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ])

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"

@router.get("/timetable/{id}/csv")
def export_timetable_csv(id: int, db: Session = Depends(get_db)):
    version = db.query(TimetableVersion).filter(TimetableVersion.id == id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Timetable not found")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Day", "Period", "Time", "Cohort", "Subject Code", "Subject Name", "Type", "Faculty", "Room", "Capacity"])

    for s in version.slots:
        times = PERIOD_TIMES.get(s.period, ("09:00", "10:00"))
        writer.writerow([
            DAYS_MAP.get(s.day, f"Day {s.day}"),
            f"Period {s.period}",
            f"{times[0][:5]} - {times[1][:5]}",
            s.batch.name if s.batch else "",
            getattr(s.subject, "code", ""),
            s.subject.name if s.subject else "",
            "LAB" if s.subject and s.subject.is_lab else "THEORY",
            s.faculty.name if s.faculty else "",
            s.room.name if s.room else "",
            s.room.capacity if s.room else "",
        ])

    output.seek(0)
    filename = f"timetable_{version.department.name if version.department else 'dept'}_sem{version.semester}_opt{version.option_rank}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/timetable/{id}/excel")
def export_timetable_excel(id: int, db: Session = Depends(get_db)):
    version = db.query(TimetableVersion).filter(TimetableVersion.id == id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Timetable not found")

    # Sheet 1: Tabular data
    rows = []
    for s in version.slots:
        times = PERIOD_TIMES.get(s.period, ("09:00", "10:00"))
        rows.append({
            "Day": DAYS_MAP.get(s.day, f"Day {s.day}"),
            "Period": f"Period {s.period}",
            "Time": f"{times[0][:5]} - {times[1][:5]}",
            "Batch": s.batch.name if s.batch else "",
            "Subject Code": getattr(s.subject, "code", ""),
            "Subject Name": s.subject.name if s.subject else "",
            "Type": "LAB" if s.subject and s.subject.is_lab else "THEORY",
            "Faculty": s.faculty.name if s.faculty else "",
            "Room": s.room.name if s.room else "",
        })

    df_slots = pd.DataFrame(rows)

    # Sheet 2: Grid matrix per batch
    grid_rows = []
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    periods = [1, 2, 3, 4, 5, 6]

    batches = list(set([s.batch for s in version.slots if s.batch]))
    for b in batches:
        for d_idx, day_name in enumerate(days):
            row_dict = {"Batch": b.name, "Day": day_name}
            for p in periods:
                matching = [s for s in version.slots if s.batch_id == b.id and s.day == d_idx and s.period == p]
                if matching:
                    m = matching[0]
                    sub = m.subject.name if m.subject else "Class"
                    fac = m.faculty.name if m.faculty else ""
                    rm = m.room.name if m.room else ""
                    row_dict[f"Period {p}"] = f"{sub} ({fac}, {rm})"
                else:
                    row_dict[f"Period {p}"] = "FREE"
            grid_rows.append(row_dict)

    df_grid = pd.DataFrame(grid_rows)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df_grid.to_excel(writer, sheet_name="Timetable Grid", index=False)
        df_slots.to_excel(writer, sheet_name="Slot List", index=False)

    output.seek(0)
    filename = f"timetable_sem{version.semester}_opt{version.option_rank}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/timetable/{id}/ical")
def export_timetable_ical(id: int, db: Session = Depends(get_db)):
    version = db.query(TimetableVersion).filter(TimetableVersion.id == id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Timetable not found")

    dept_name = version.department.name if version.department else "Department"
    title = f"{dept_name} Semester {version.semester} Schedule"
    ical_text = _build_ical_content(version.slots, title)

    filename = f"timetable_sem{version.semester}_opt{version.option_rank}.ics"
    return Response(
        content=ical_text,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/batch/{batch_id}/ical")
def export_batch_ical(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Find approved timetable version for this batch's department and semester
    version = (
        db.query(TimetableVersion)
        .filter(
            TimetableVersion.department_id == batch.department_id,
            TimetableVersion.semester == batch.semester,
            TimetableVersion.status == TimetableStatus.approved
        )
        .first()
    )
    if not version:
        # Fallback to latest generated version
        version = (
            db.query(TimetableVersion)
            .filter(
                TimetableVersion.department_id == batch.department_id,
                TimetableVersion.semester == batch.semester
            )
            .order_by(TimetableVersion.id.desc())
            .first()
        )

    if not version:
        raise HTTPException(status_code=404, detail="No schedule found for this batch")

    batch_slots = [s for s in version.slots if s.batch_id == batch_id]
    title = f"{batch.name} Timetable"
    ical_text = _build_ical_content(batch_slots, title)

    filename = f"{batch.name}_schedule.ics"
    return Response(
        content=ical_text,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/faculty/{faculty_id}/ical")
def export_faculty_ical(faculty_id: int, db: Session = Depends(get_db)):
    faculty = db.query(Faculty).filter(Faculty.id == faculty_id).first()
    if not faculty:
        raise HTTPException(status_code=404, detail="Faculty not found")

    approved_versions = (
        db.query(TimetableVersion)
        .filter(TimetableVersion.status == TimetableStatus.approved)
        .all()
    )

    faculty_slots = []
    for v in approved_versions:
        for s in v.slots:
            if s.faculty_id == faculty_id:
                faculty_slots.append(s)

    title = f"{faculty.name} Teaching Schedule"
    ical_text = _build_ical_content(faculty_slots, title)

    filename = f"{faculty.name.replace(' ', '_')}_schedule.ics"
    return Response(
        content=ical_text,
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
