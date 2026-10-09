from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.department import Department, Shift
from app.models.room import Room
from app.models.faculty import Faculty
from app.models.subject import Subject
from app.models.batch import Batch, FixedSlot
from app.models.timetable import TimetableVersion, TimetableSlot, TimetableStatus
from app.solver.model import TimetableModel
from app.solver.diagnostics import run_infeasibility_diagnostics
from app.solver.evaluator import evaluate_schedule_metrics

def generate_timetable_options(
    db: Session,
    department_id: int,
    semester: int = None,
    shift: Shift = None,
    num_options: int = 3
) -> Dict[str, Any]:
    """
    High-level timetable generation orchestrator:
    - Fetches relevant database records
    - Solves CP-SAT model across 3 distinct perturbation configurations
    - Persists versions and slots in database
    - Runs diagnostic analysis if infeasible
    """
    # 1. Query relevant entities
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        return {
            'status': 'ERROR',
            'message': f'Department ID {department_id} not found.',
            'options': [],
            'diagnostic_suggestions': None
        }

    # Fetch rooms (department specific + shared)
    rooms_query = db.query(Room).filter((Room.department_id == department_id) | (Room.department_id.is_(None)))
    rooms = rooms_query.all()

    # Fetch batches
    batch_query = db.query(Batch).filter(Batch.department_id == department_id)
    if semester is not None:
        batch_query = batch_query.filter(Batch.semester == semester)
    if shift is not None:
        batch_query = batch_query.filter(Batch.shift == shift)
    batches = batch_query.all()

    # Fetch subjects
    subj_query = db.query(Subject).filter(Subject.department_id == department_id)
    if semester is not None:
        subj_query = subj_query.filter(Subject.semester == semester)
    subjects = subj_query.all()

    # Fetch faculty
    faculty = db.query(Faculty).filter(Faculty.department_id == department_id).all()

    # Fetch fixed slots
    fixed_slots = db.query(FixedSlot).all()

    # Sanity checks
    if not batches:
        return {
            'status': 'INFEASIBLE',
            'message': 'No student batches found for the specified department/semester.',
            'options': [],
            'diagnostic_suggestions': ['Please configure at least one student batch before generating timetables.']
        }
    if not subjects:
        return {
            'status': 'INFEASIBLE',
            'message': 'No curriculum subjects found for the specified department/semester.',
            'options': [],
            'diagnostic_suggestions': ['Please configure subjects for the required semester.']
        }
    if not rooms:
        return {
            'status': 'INFEASIBLE',
            'message': 'No classrooms or laboratories available.',
            'options': [],
            'diagnostic_suggestions': ['Please add at least one lecture room or lab to the system.']
        }
    if not faculty:
        return {
            'status': 'INFEASIBLE',
            'message': 'No faculty members configured for this department.',
            'options': [],
            'diagnostic_suggestions': ['Please register faculty members and map their qualified subjects.']
        }

    # 2. Run solver passes to generate distinct options
    # Perturb soft constraint weights and random seeds to obtain distinct schedules
    option_configs = [
        {'seed': 42, 'weights': {'faculty_gap': 3, 'student_gap': 4, 'load_balance': 2, 'early_lab': 1}},
        {'seed': 107, 'weights': {'faculty_gap': 5, 'student_gap': 2, 'load_balance': 4, 'early_lab': 2}},
        {'seed': 999, 'weights': {'faculty_gap': 2, 'student_gap': 5, 'load_balance': 1, 'early_lab': 3}},
    ]

    # Strictly maintain at most 3 options: remove any unapproved/draft versions and their slots
    existing_unapproved = db.query(TimetableVersion).filter(
        TimetableVersion.department_id == department_id,
        TimetableVersion.semester == semester,
        TimetableVersion.status != TimetableStatus.approved
    ).all()
    for ev in existing_unapproved:
        db.query(TimetableSlot).filter(TimetableSlot.timetable_version_id == ev.id).delete()
        try:
            from app.models.vote import TimetableVote
            db.query(TimetableVote).filter(TimetableVote.timetable_version_id == ev.id).delete()
        except Exception:
            pass
        db.delete(ev)
    db.flush()

    generated_versions = []
    first_pass_status = None

    for idx, cfg in enumerate(option_configs[:num_options]):
        model_instance = TimetableModel(
            batches=batches,
            subjects=subjects,
            rooms=rooms,
            faculty=faculty,
            fixed_slots=fixed_slots,
            random_seed=cfg['seed']
        )
        model_instance.build_model(perturbation_weights=cfg['weights'])
        status, slots, raw_penalty = model_instance.solve_option(seed=cfg['seed'], max_time_seconds=6.0)

        if idx == 0:
            first_pass_status = status

        if status == 'FEASIBLE':
            # Evaluate schedule quality, soft constraint satisfaction, and strategic focus
            eval_metrics = evaluate_schedule_metrics(
                slots=slots,
                option_rank=idx + 1,
                weights=cfg['weights'],
                raw_penalty=raw_penalty
            )
            score = eval_metrics['score']
            focus = eval_metrics['optimization_focus']

            # Create TimetableVersion record
            version = TimetableVersion(
                department_id=department_id,
                semester=semester,
                status=TimetableStatus.draft,
                score=score,
                option_rank=idx + 1,
                optimization_focus=focus
            )
            db.add(version)
            db.flush()

            # Create slot records
            slot_records = []
            for s in slots:
                slot_obj = TimetableSlot(
                    timetable_version_id=version.id,
                    day=s['day'],
                    period=s['period'],
                    room_id=s['room_id'],
                    subject_id=s['subject_id'],
                    faculty_id=s['faculty_id'],
                    batch_id=s['batch_id']
                )
                db.add(slot_obj)
                slot_records.append({**s, 'id': None})

            generated_versions.append({
                'id': version.id,
                'option_rank': idx + 1,
                'score': score,
                'status': version.status,
                'generated_at': version.generated_at,
                'clash_count': 0,
                'total_slots': len(slots),
                'optimization_focus': focus,
                'tagline': eval_metrics.get('tagline'),
                'top_optimized_constraints': eval_metrics.get('top_optimized_constraints'),
                'student_centric_points': eval_metrics.get('student_centric_points'),
                'constraint_breakdown': eval_metrics.get('constraint_breakdown'),
                'metrics_summary': eval_metrics.get('metrics_summary'),
                'slots': slot_records
            })

    # If all passes were INFEASIBLE, trigger the diagnostics engine
    if not generated_versions:
        diagnostics = run_infeasibility_diagnostics(
            batches=batches,
            subjects=subjects,
            rooms=rooms,
            faculty=faculty,
            fixed_slots=fixed_slots
        )
        return {
            'status': 'INFEASIBLE',
            'message': 'No feasible timetable schedule could be found that satisfies all hard constraints.',
            'options': [],
            'diagnostic_suggestions': diagnostics
        }

    db.commit()

    return {
        'status': 'SUCCESS',
        'message': f'Successfully generated {len(generated_versions)} distinct, clash-free timetable options.',
        'options': generated_versions,
        'diagnostic_suggestions': None
    }
