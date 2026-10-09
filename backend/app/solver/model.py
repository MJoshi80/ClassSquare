from ortools.sat.python import cp_model
from typing import List, Dict, Tuple, Any, Optional

DAYS = [0, 1, 2, 3, 4]  # Monday (0) to Friday (4)
PERIODS = [1, 2, 3, 4, 5, 6]  # 6 periods per day

class TimetableModel:
    """
    Google OR-Tools CP-SAT formulation for multi-batch, multi-room, multi-faculty timetabling.
    Implements all 8 hard constraints with zero-clash guarantees and weighted soft optimization.
    """
    def __init__(
        self,
        batches: List[Any],
        subjects: List[Any],
        rooms: List[Any],
        faculty: List[Any],
        fixed_slots: List[Any] = None,
        random_seed: int = 42
    ):
        self.batches = batches
        self.subjects = subjects
        self.rooms = rooms
        self.faculty = faculty
        self.fixed_slots = fixed_slots or []
        self.random_seed = random_seed

        self.model = cp_model.CpModel()
        
        # Build lookup indices
        self.batch_map = {b.id: b for b in batches}
        self.subject_map = {s.id: s for s in subjects}
        self.room_map = {r.id: r for r in rooms}
        self.faculty_map = {f.id: f for f in faculty}

        # Break subjects into individual session instances per batch
        # Session tuple: (session_id, batch_id, subject_id, is_lab, session_index)
        self.sessions = []
        sess_counter = 0
        for batch in self.batches:
            # Get subjects relevant to this batch semester
            batch_subjects = [s for s in self.subjects if s.semester == batch.semester]
            for subj in batch_subjects:
                for idx in range(subj.sessions_per_week):
                    self.sessions.append({
                        'id': sess_counter,
                        'batch_id': batch.id,
                        'subject_id': subj.id,
                        'is_lab': subj.is_lab,
                        'index': idx,
                        'batch': batch,
                        'subject': subj
                    })
                    sess_counter += 1

        # Decision variables: X[sess_id, d, p, r_id, f_id]
        self.X = {}
        # Secondary tracking variables for soft constraints
        self.batch_day_period = {}
        self.faculty_day_period = {}

    def build_model(self, perturbation_weights: Optional[Dict[str, int]] = None):
        weights = perturbation_weights or {
            'faculty_gap': 3,
            'student_gap': 4,
            'load_balance': 2,
            'early_lab': 1
        }

        # -------------------------------------------------------------
        # 1. Variable Creation with Domain Filtering
        # -------------------------------------------------------------
        for s in self.sessions:
            sess_id = s['id']
            batch = s['batch']
            subj = s['subject']

            # HARD CONSTRAINT 4: Room capacity >= Batch strength
            # HARD CONSTRAINT 6: Lab subjects require is_lab=True rooms
            eligible_rooms = [
                r for r in self.rooms
                if r.capacity >= batch.strength and (r.is_lab if subj.is_lab else not r.is_lab)
            ]

            # If no strict non-lab room fits, allow lecture in larger lab room as fallback if necessary
            if not subj.is_lab and not eligible_rooms:
                eligible_rooms = [r for r in self.rooms if r.capacity >= batch.strength]

            # HARD CONSTRAINT 5: Faculty must be qualified for the subject
            eligible_faculty = [
                f for f in self.faculty
                if any(fs.id == subj.id for fs in f.subjects)
            ]

            for d in DAYS:
                for p in PERIODS:
                    for r in eligible_rooms:
                        for f in eligible_faculty:
                            var_name = f"x_s{sess_id}_d{d}_p{p}_r{r.id}_f{f.id}"
                            self.X[(sess_id, d, p, r.id, f.id)] = self.model.NewBoolVar(var_name)

        # -------------------------------------------------------------
        # HARD CONSTRAINT: Each session instance must be assigned exactly ONCE
        # -------------------------------------------------------------
        for s in self.sessions:
            sess_id = s['id']
            session_vars = [
                var for (sid, d, p, r_id, f_id), var in self.X.items()
                if sid == sess_id
            ]
            if session_vars:
                self.model.Add(cp_model.LinearExpr.Sum(session_vars) == 1)
            else:
                # If no variables could be created due to domain filtering (e.g. no qualified faculty)
                # Force infeasible so diagnostics will trigger cleanly
                dummy = self.model.NewBoolVar(f"dummy_infeasible_{sess_id}")
                self.model.Add(dummy == 1)
                self.model.Add(dummy == 0)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 1: No faculty double-booked in the same (day, period)
        # -------------------------------------------------------------
        for f in self.faculty:
            for d in DAYS:
                for p in PERIODS:
                    fac_vars = [
                        var for (sid, day, per, r_id, f_id), var in self.X.items()
                        if f_id == f.id and day == d and per == p
                    ]
                    if fac_vars:
                        self.model.Add(cp_model.LinearExpr.Sum(fac_vars) <= 1)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 2: No room double-booked in the same (day, period)
        # -------------------------------------------------------------
        for r in self.rooms:
            for d in DAYS:
                for p in PERIODS:
                    room_vars = [
                        var for (sid, day, per, r_id, f_id), var in self.X.items()
                        if r_id == r.id and day == d and per == p
                    ]
                    if room_vars:
                        self.model.Add(cp_model.LinearExpr.Sum(room_vars) <= 1)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 3: No batch double-booked in the same (day, period)
        # -------------------------------------------------------------
        for b in self.batches:
            for d in DAYS:
                for p in PERIODS:
                    batch_vars = [
                        var for (sid, day, per, r_id, f_id), var in self.X.items()
                        if self.sessions[sid]['batch_id'] == b.id and day == d and per == p
                    ]
                    if batch_vars:
                        self.model.Add(cp_model.LinearExpr.Sum(batch_vars) <= 1)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 7: Fixed special-class slots strictly respected
        # -------------------------------------------------------------
        for fix in self.fixed_slots:
            target_sessions = [
                s for s in self.sessions
                if s['batch_id'] == fix.batch_id and s['subject_id'] == fix.subject_id
            ]
            if target_sessions:
                # Fix at least one session of this subject to this slot
                fixed_vars = [
                    var for (sid, day, per, r_id, f_id), var in self.X.items()
                    if sid in [ts['id'] for ts in target_sessions]
                    and day == fix.day and per == fix.period and r_id == fix.room_id
                ]
                if fixed_vars:
                    self.model.Add(cp_model.LinearExpr.Sum(fixed_vars) >= 1)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 8: Faculty daily & weekly teaching load limits
        # -------------------------------------------------------------
        for f in self.faculty:
            # Weekly cap
            weekly_vars = [
                var for (sid, d, p, r_id, f_id), var in self.X.items()
                if f_id == f.id
            ]
            if weekly_vars:
                self.model.Add(cp_model.LinearExpr.Sum(weekly_vars) <= f.max_classes_per_week)

            # Daily cap
            for d in DAYS:
                daily_vars = [
                    var for (sid, day, p, r_id, f_id), var in self.X.items()
                    if f_id == f.id and day == d
                ]
                if daily_vars:
                    self.model.Add(cp_model.LinearExpr.Sum(daily_vars) <= f.max_classes_per_day)

        # -------------------------------------------------------------
        # SOFT OBJECTIVES (Weighted optimization)
        # -------------------------------------------------------------
        objective_terms = []

        # Objective 1: Prefer heavy/lab subjects earlier in the day
        for (sid, d, p, r_id, f_id), var in self.X.items():
            if self.sessions[sid]['is_lab']:
                # Penalize scheduling labs in later periods (period 5, 6)
                penalty = (p - 1) * weights['early_lab']
                objective_terms.append(var * penalty)

        # Objective 2: Discourage excessive classes of the same subject on the same day for a batch
        for b in self.batches:
            batch_subjects = [s for s in self.subjects if s.semester == batch.semester]
            for subj in batch_subjects:
                if subj.sessions_per_week > 1 and not subj.is_lab:
                    for d in DAYS:
                        same_subj_day_vars = [
                            var for (sid, day, p, r_id, f_id), var in self.X.items()
                            if self.sessions[sid]['batch_id'] == b.id
                            and self.sessions[sid]['subject_id'] == subj.id
                            and day == d
                        ]
                        if len(same_subj_day_vars) > 1:
                            # Prefer at most 1 session per day per theory subject
                            load_excess = self.model.NewIntVar(0, 5, f"excess_b{b.id}_s{subj.id}_d{d}")
                            self.model.Add(load_excess >= cp_model.LinearExpr.Sum(same_subj_day_vars) - 1)
                            objective_terms.append(load_excess * weights['load_balance'])

        if objective_terms:
            self.model.Minimize(cp_model.LinearExpr.Sum(objective_terms))

    def solve_option(self, seed: int = 42, max_time_seconds: float = 8.0) -> Tuple[str, List[Dict[str, Any]], float]:
        """
        Solves the CP-SAT model for a specific random seed/perturbation.
        Returns (status, slots_list, objective_score).
        """
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = max_time_seconds
        solver.parameters.random_seed = seed
        solver.parameters.num_search_workers = 4

        status = solver.Solve(self.model)

        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            slots = []
            for (sid, d, p, r_id, f_id), var in self.X.items():
                if solver.Value(var) == 1:
                    sess = self.sessions[sid]
                    slots.append({
                        'day': d,
                        'period': p,
                        'room_id': r_id,
                        'room_name': self.room_map[r_id].name,
                        'subject_id': sess['subject_id'],
                        'subject_name': self.subject_map[sess['subject_id']].name,
                        'faculty_id': f_id,
                        'faculty_name': self.faculty_map[f_id].name,
                        'batch_id': sess['batch_id'],
                        'batch_name': self.batch_map[sess['batch_id']].name,
                        'is_lab': sess['is_lab']
                    })
            return "FEASIBLE", slots, float(solver.ObjectiveValue())
        elif status == cp_model.INFEASIBLE:
            return "INFEASIBLE", [], 0.0
        else:
            return "UNKNOWN", [], 0.0
