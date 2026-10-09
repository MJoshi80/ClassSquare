from typing import List, Dict, Any

def run_infeasibility_diagnostics(
    batches: List[Any],
    subjects: List[Any],
    rooms: List[Any],
    faculty: List[Any],
    fixed_slots: List[Any]
) -> List[str]:
    """
    Plain-language diagnostic pass when OR-Tools solver returns INFEASIBLE.
    Identifies institutional resource bottlenecks with actionable rearrangement suggestions.
    """
    suggestions = []

    # 1. Room Capacity vs Batch Strength Check
    for batch in batches:
        suitable_lecture_rooms = [r for r in rooms if not r.is_lab and r.capacity >= batch.strength]
        if not suitable_lecture_rooms:
            max_room_cap = max([r.capacity for r in rooms if not r.is_lab], default=0)
            suggestions.append(
                f"Room capacity bottleneck: Batch '{batch.name}' has {batch.strength} students, but the largest lecture hall has only {max_room_cap} seats. Consider splitting '{batch.name}' into multiple cohorts or assigning a larger auditorium."
            )

        # Check lab room sizes for batches with lab subjects
        batch_has_labs = any(s.is_lab and s.semester == batch.semester for s in subjects)
        if batch_has_labs:
            suitable_labs = [r for r in rooms if r.is_lab and r.capacity >= batch.strength]
            if not suitable_labs:
                max_lab_cap = max([r.capacity for r in rooms if r.is_lab], default=0)
                suggestions.append(
                    f"Lab capacity shortfall: Batch '{batch.name}' has {batch.strength} students, but available dedicated labs only accommodate up to {max_lab_cap}. Consider subdividing the batch into lab groups."
                )

    # 2. Lab Room Availability vs Total Lab Sessions
    total_lab_sessions = sum(s.sessions_per_week for s in subjects if s.is_lab)
    total_lab_rooms = len([r for r in rooms if r.is_lab])
    if total_lab_sessions > 0 and total_lab_rooms == 0:
        suggestions.append(
            "Missing lab facilities: One or more subjects require laboratory sessions, but no rooms are designated as 'is_lab=true'. Please configure at least one specialized lab room."
        )
    elif total_lab_rooms > 0:
        # Assuming 5 days * 6 periods = 30 slots per room
        max_lab_capacity_slots = total_lab_rooms * 30
        if total_lab_sessions > max_lab_capacity_slots:
            suggestions.append(
                f"Lab timetable overcrowding: Total required lab sessions ({total_lab_sessions}) exceed maximum possible weekly lab slots ({max_lab_capacity_slots}). Add more lab rooms or reduce lab sessions per week."
            )

    # 3. Subject Qualification & Faculty Load Checks
    for subject in subjects:
        qualified_faculty = [f for f in faculty if any(s.id == subject.id for s in f.subjects)]
        if not qualified_faculty:
            suggestions.append(
                f"No qualified faculty: Subject '{subject.name}' (Sem {subject.semester}) has no assigned qualified instructors. Please map at least one faculty member to teach this subject."
            )
        else:
            total_faculty_capacity = sum(f.max_classes_per_week for f in qualified_faculty)
            if total_faculty_capacity < subject.sessions_per_week:
                suggestions.append(
                    f"Faculty workload deficit: Qualified faculty for '{subject.name}' can only teach {total_faculty_capacity} classes/week, but the subject requires {subject.sessions_per_week} sessions. Increase faculty limits or qualify additional instructors."
                )

    # 4. Total Weekly Class Hours vs Period Availability
    for batch in batches:
        batch_subjects = [s for s in subjects if s.semester == batch.semester]
        total_batch_periods = sum(s.sessions_per_week for s in batch_subjects)
        if total_batch_periods > 30:  # 5 days * 6 periods = 30
            suggestions.append(
                f"Curriculum overload for Batch '{batch.name}': Total scheduled classes ({total_batch_periods} periods/week) exceed the 30 available periods (5 days × 6 periods). Reduce subject sessions per week."
            )

    # Fallback if no specific condition triggered
    if not suggestions:
        suggestions.append(
            "Tight constraint conflict: The combination of faculty teaching load limits, fixed special slots, and room availability leaves no feasible schedule. Try relaxing faculty max classes per day or adjusting fixed slot reservations."
        )

    return suggestions
