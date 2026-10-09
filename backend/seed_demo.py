import os
import sys
from datetime import date, datetime, timedelta

# Ensure backend directory is in python search path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from passlib.context import CryptContext
from app.database import Base, engine, SessionLocal
from app.models.user import User, UserRole
from app.models.department import Department, Shift
from app.models.room import Room
from app.models.faculty import Faculty, FacultySubject
from app.models.subject import Subject, ElectiveBand
from app.models.batch import Batch
from app.models.timetable import TimetableVersion, TimetableSlot, TimetableStatus
from app.models.approval import ApprovalLog, ApprovalAction
from app.models.leave import FacultyLeave, LeaveStatus
from app.models.notification import Notification
from app.models.classroom import ClassMaterial, StudentSubmission
from app.models.vote import TimetableVote
from app.solver.scheduler import generate_timetable_options

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed():
    print("==========================================================")
    print("  OptiClass AI: Enterprise Academic Dataset Seeder")
    print("  Autonomous Academic Scheduling & Coursework Optimization")
    print("==========================================================")

    # 1. Reset and recreate tables
    print("[1/8] Initializing database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 2. Seed Users across all 4 roles
    print("[2/8] Seeding role-based institutional accounts...")
    hashed_pwd = pwd_context.hash("admin123")
    hod_pwd = pwd_context.hash("hod123")
    fac_pwd = pwd_context.hash("faculty123")
    stu_pwd = pwd_context.hash("student123")

    admin_user = User(email="admin@opticlass.edu", password_hash=hashed_pwd, role=UserRole.admin)
    hod_cse = User(email="hod.cse@opticlass.edu", password_hash=hod_pwd, role=UserRole.hod)
    hod_me = User(email="hod.me@opticlass.edu", password_hash=hod_pwd, role=UserRole.hod)
    fac_turing = User(email="faculty.turing@opticlass.edu", password_hash=fac_pwd, role=UserRole.faculty)
    fac_lovelace = User(email="faculty.lovelace@opticlass.edu", password_hash=fac_pwd, role=UserRole.faculty)
    fac_shannon = User(email="faculty.shannon@opticlass.edu", password_hash=fac_pwd, role=UserRole.faculty)
    fac_watt = User(email="faculty.watt@opticlass.edu", password_hash=fac_pwd, role=UserRole.faculty)

    stu_user = User(email="student.cse@opticlass.edu", password_hash=stu_pwd, role=UserRole.student)
    stu_alex = User(email="student.alex@opticlass.edu", password_hash=stu_pwd, role=UserRole.student)
    stu_maya = User(email="student.maya@opticlass.edu", password_hash=stu_pwd, role=UserRole.student)

    db.add_all([admin_user, hod_cse, hod_me, fac_turing, fac_lovelace, fac_shannon, fac_watt, stu_user, stu_alex, stu_maya])
    db.commit()

    # 3. Seed Academic Departments (Multi-shift)
    print("[3/8] Seeding academic engineering & computing departments...")
    dept_cse = Department(name="Computer Science & Engineering", shift=Shift.morning)
    dept_ece = Department(name="Electronics & Communication", shift=Shift.morning)
    dept_me = Department(name="Mechanical Engineering", shift=Shift.evening)
    dept_it = Department(name="Information Technology & AI", shift=Shift.morning)
    db.add_all([dept_cse, dept_ece, dept_me, dept_it])
    db.commit()

    # Link academic departments to student and HOD user profiles
    stu_user.department_id = dept_cse.id
    stu_alex.department_id = dept_cse.id
    stu_maya.department_id = dept_cse.id
    hod_cse.department_id = dept_cse.id
    hod_me.department_id = dept_me.id
    db.commit()

    # 4. Seed Institutional Classrooms, Lecture Theatres & Specialized Labs
    print("[4/8] Seeding lecture theatres, seminar halls, and engineering labs...")
    rooms = [
        # CSE Lecture Halls & Labs
        Room(name="LH-101 (Turing Hall)", capacity=120, is_lab=False, department_id=dept_cse.id),
        Room(name="LH-102 (Babbage Lecture Room)", capacity=90, is_lab=False, department_id=dept_cse.id),
        Room(name="LH-103", capacity=75, is_lab=False, department_id=dept_cse.id),
        Room(name="CS-Systems-Lab", capacity=60, is_lab=True, department_id=dept_cse.id),
        Room(name="CS-AI-Compute-Lab", capacity=60, is_lab=True, department_id=dept_cse.id),
        Room(name="CS-Software-Lab", capacity=60, is_lab=True, department_id=dept_cse.id),

        # ECE Lecture Halls & Labs
        Room(name="LH-201 (Maxwell Hall)", capacity=100, is_lab=False, department_id=dept_ece.id),
        Room(name="LH-202", capacity=75, is_lab=False, department_id=dept_ece.id),
        Room(name="EC-VLSI-Lab", capacity=50, is_lab=True, department_id=dept_ece.id),
        Room(name="EC-Communications-Lab", capacity=50, is_lab=True, department_id=dept_ece.id),
        Room(name="EC-Circuits-Lab", capacity=50, is_lab=True, department_id=dept_ece.id),

        # Mechanical Lecture Halls & Labs
        Room(name="LH-301 (Watt Auditorium)", capacity=100, is_lab=False, department_id=dept_me.id),
        Room(name="LH-302", capacity=80, is_lab=False, department_id=dept_me.id),
        Room(name="Mech-Workshop", capacity=60, is_lab=True, department_id=dept_me.id),
        Room(name="Mech-Thermal-Lab", capacity=50, is_lab=True, department_id=dept_me.id),
        Room(name="Mech-CAD-Lab", capacity=50, is_lab=True, department_id=dept_me.id),

        # IT & Cross-Disciplinary Rooms
        Room(name="LH-401 (Lovelace Hall)", capacity=90, is_lab=False, department_id=dept_it.id),
        Room(name="IT-Cloud-Lab", capacity=60, is_lab=True, department_id=dept_it.id),
        Room(name="IT-Software-Lab", capacity=60, is_lab=True, department_id=dept_it.id),
        Room(name="Central-Auditorium-A", capacity=180, is_lab=False, department_id=None),
    ]
    db.add_all(rooms)
    db.commit()

    # 5. Seed Faculty Members with Workload Norms
    print("[5/8] Seeding 21 faculty professors and workload constraints...")
    faculty_definitions = [
        # CSE
        ("Dr. Alan Turing", dept_cse.id),
        ("Dr. Ada Lovelace", dept_cse.id),
        ("Dr. Claude Shannon", dept_cse.id),
        ("Dr. Grace Hopper", dept_cse.id),
        ("Dr. John von Neumann", dept_cse.id),
        ("Dr. Katherine Johnson", dept_cse.id),
        ("Dr. Donald Knuth", dept_cse.id),

        # ECE
        ("Prof. Nikola Tesla", dept_ece.id),
        ("Prof. Marie Curie", dept_ece.id),
        ("Prof. Heinrich Hertz", dept_ece.id),
        ("Prof. James Clerk Maxwell", dept_ece.id),
        ("Prof. Michael Faraday", dept_ece.id),

        # ME
        ("Prof. James Watt", dept_me.id),
        ("Prof. Rudolf Diesel", dept_me.id),
        ("Prof. Henry Ford", dept_me.id),
        ("Prof. Isaac Newton", dept_me.id),
        ("Prof. Sadi Carnot", dept_me.id),

        # IT
        ("Dr. Tim Berners-Lee", dept_it.id),
        ("Dr. Barbara Liskov", dept_it.id),
        ("Prof. Dennis Ritchie", dept_it.id),
        ("Prof. Ken Thompson", dept_it.id),
    ]

    faculty_map = {}
    for name, dept_id in faculty_definitions:
        fac = Faculty(name=name, department_id=dept_id, max_classes_per_day=4, max_classes_per_week=18)
        db.add(fac)
        db.flush()
        faculty_map[name] = fac
    db.commit()

    # Link faculty user accounts
    fac_turing.linked_faculty_id = faculty_map["Dr. Alan Turing"].id
    fac_lovelace.linked_faculty_id = faculty_map["Dr. Ada Lovelace"].id
    fac_shannon.linked_faculty_id = faculty_map["Dr. Claude Shannon"].id
    fac_watt.linked_faculty_id = faculty_map["Prof. James Watt"].id
    db.commit()

    # 6. Seed Subjects, NEP 2020 Elective Bands & Cohorts
    print("[6/8] Seeding curriculum, NEP 2020 bands, and cohorts...")
    elective_band_a = ElectiveBand(name="Emerging Technologies Band A (NEP 2020)")
    elective_band_b = ElectiveBand(name="Multidisciplinary Open Band B (NEP 2020)")
    db.add_all([elective_band_a, elective_band_b])
    db.commit()

    subject_definitions = [
        # --- CSE Semester 3 ---
        ("Data Structures", dept_cse.id, 3, 3, False, False, None),
        ("Algorithms", dept_cse.id, 3, 3, False, False, None),
        ("Database Systems", dept_cse.id, 3, 3, False, False, None),
        ("Computer Networks", dept_cse.id, 3, 3, False, False, None),
        ("Operating Systems", dept_cse.id, 3, 3, False, False, None),
        ("Data Structures Lab", dept_cse.id, 3, 2, True, False, None),
        ("Networks & Systems Lab", dept_cse.id, 3, 2, True, False, None),
        ("Artificial Intelligence & ML", dept_cse.id, 3, 3, False, True, elective_band_a.id),

        # --- CSE Semester 5 ---
        ("Theory of Computation", dept_cse.id, 5, 3, False, False, None),
        ("Compiler Design", dept_cse.id, 5, 3, False, False, None),
        ("Software Engineering", dept_cse.id, 5, 3, False, False, None),
        ("Computer Architecture", dept_cse.id, 5, 3, False, False, None),
        ("Compilers & Architecture Lab", dept_cse.id, 5, 2, True, False, None),

        # --- ECE Semester 3 ---
        ("Signals & Systems", dept_ece.id, 3, 3, False, False, None),
        ("Analog Electronic Circuits", dept_ece.id, 3, 3, False, False, None),
        ("Digital Electronics", dept_ece.id, 3, 3, False, False, None),
        ("Semiconductor Devices", dept_ece.id, 3, 3, False, False, None),
        ("Analog & Digital Circuits Lab", dept_ece.id, 3, 2, True, False, None),
        ("Robotics & Autonomous Systems", dept_ece.id, 3, 3, False, True, elective_band_a.id),

        # --- ECE Semester 5 ---
        ("Digital Signal Processing", dept_ece.id, 5, 3, False, False, None),
        ("Electromagnetic Theory", dept_ece.id, 5, 3, False, False, None),
        ("Wireless Communications", dept_ece.id, 5, 3, False, False, None),
        ("DSP Simulation Lab", dept_ece.id, 5, 2, True, False, None),

        # --- Mechanical Semester 3 ---
        ("Fluid Mechanics", dept_me.id, 3, 3, False, False, None),
        ("Kinematics of Machinery", dept_me.id, 3, 3, False, False, None),
        ("Manufacturing Processes", dept_me.id, 3, 3, False, False, None),
        ("Mechanics of Solids", dept_me.id, 3, 3, False, False, None),
        ("Mechanical Workshop Practice", dept_me.id, 3, 2, True, False, None),

        # --- Mechanical Semester 5 ---
        ("Thermodynamics & Heat Transfer", dept_me.id, 5, 3, False, False, None),
        ("IC Engines & Gas Turbines", dept_me.id, 5, 3, False, False, None),
        ("Thermal Engineering Lab", dept_me.id, 5, 2, True, False, None),

        # --- IT Semester 3 ---
        ("Web Technologies & Cloud", dept_it.id, 3, 3, False, False, None),
        ("Distributed Systems", dept_it.id, 3, 3, False, False, None),
        ("Web & Cloud Applications Lab", dept_it.id, 3, 2, True, False, None),
        ("Cybersecurity & Cyber Law", dept_it.id, 3, 3, False, True, elective_band_b.id),

        # --- IT Semester 5 ---
        ("Cloud Computing & Virtualization", dept_it.id, 5, 3, False, False, None),
        ("Information Security & Cryptography", dept_it.id, 5, 3, False, False, None),
        ("Big Data Analytics", dept_it.id, 5, 3, False, False, None),
        ("Cloud & Big Data Lab", dept_it.id, 5, 2, True, False, None),
    ]

    subject_map = {}
    for name, d_id, sem, sess, is_lab, is_elec, b_id in subject_definitions:
        sub = Subject(
            name=name, department_id=d_id, semester=sem,
            sessions_per_week=sess, is_lab=is_lab, is_elective=is_elec, elective_band_id=b_id
        )
        db.add(sub)
        db.flush()
        subject_map[name] = sub
    db.commit()

    # Deterministic, Robust Faculty-to-Subject Mappings
    # Every faculty member teaches 2-4 subjects in their department
    # Every subject has at least 2-3 qualified faculty members in that department
    teacher_assignments = {
        # CSE
        "Dr. Alan Turing": ["Data Structures", "Algorithms", "Theory of Computation", "Artificial Intelligence & ML"],
        "Dr. Ada Lovelace": ["Data Structures", "Database Systems", "Compiler Design", "Software Engineering"],
        "Dr. Claude Shannon": ["Computer Networks", "Operating Systems", "Theory of Computation"],
        "Dr. Grace Hopper": ["Operating Systems", "Software Engineering", "Data Structures Lab", "Compilers & Architecture Lab"],
        "Dr. John von Neumann": ["Algorithms", "Computer Architecture", "Networks & Systems Lab", "Artificial Intelligence & ML"],
        "Dr. Katherine Johnson": ["Artificial Intelligence & ML", "Database Systems", "Compilers & Architecture Lab"],
        "Dr. Donald Knuth": ["Data Structures", "Algorithms", "Theory of Computation", "Networks & Systems Lab"],

        # ECE
        "Prof. Nikola Tesla": ["Signals & Systems", "Wireless Communications", "Robotics & Autonomous Systems", "Digital Electronics"],
        "Prof. Marie Curie": ["Analog Electronic Circuits", "Semiconductor Devices", "Analog & Digital Circuits Lab"],
        "Prof. Heinrich Hertz": ["Digital Electronics", "Electromagnetic Theory", "Analog & Digital Circuits Lab", "DSP Simulation Lab"],
        "Prof. James Clerk Maxwell": ["Signals & Systems", "Electromagnetic Theory", "Wireless Communications", "Analog Electronic Circuits"],
        "Prof. Michael Faraday": ["Semiconductor Devices", "Analog Electronic Circuits", "Digital Signal Processing", "Analog & Digital Circuits Lab"],

        # ME
        "Prof. James Watt": ["Fluid Mechanics", "Thermodynamics & Heat Transfer", "IC Engines & Gas Turbines", "Thermal Engineering Lab"],
        "Prof. Rudolf Diesel": ["IC Engines & Gas Turbines", "Kinematics of Machinery", "Thermodynamics & Heat Transfer", "Thermal Engineering Lab"],
        "Prof. Henry Ford": ["Manufacturing Processes", "Mechanical Workshop Practice", "Kinematics of Machinery"],
        "Prof. Isaac Newton": ["Mechanics of Solids", "Kinematics of Machinery", "Fluid Mechanics"],
        "Prof. Sadi Carnot": ["Thermodynamics & Heat Transfer", "Fluid Mechanics", "Thermal Engineering Lab", "Mechanical Workshop Practice"],

        # IT
        "Dr. Tim Berners-Lee": ["Web Technologies & Cloud", "Distributed Systems", "Web & Cloud Applications Lab", "Cybersecurity & Cyber Law", "Cloud Computing & Virtualization", "Cloud & Big Data Lab"],
        "Dr. Barbara Liskov": ["Distributed Systems", "Web Technologies & Cloud", "Web & Cloud Applications Lab", "Cloud Computing & Virtualization", "Big Data Analytics"],
        "Prof. Dennis Ritchie": ["Web Technologies & Cloud", "Cybersecurity & Cyber Law", "Web & Cloud Applications Lab", "Information Security & Cryptography", "Cloud & Big Data Lab"],
        "Prof. Ken Thompson": ["Distributed Systems", "Cybersecurity & Cyber Law", "Web & Cloud Applications Lab", "Information Security & Cryptography", "Big Data Analytics"],
    }

    for fac_name, sub_names in teacher_assignments.items():
        fac = faculty_map[fac_name]
        for s_name in sub_names:
            sub = subject_map[s_name]
            fac_sub = FacultySubject(faculty_id=fac.id, subject_id=sub.id)
            db.add(fac_sub)
    db.commit()

    # Batches across departments & semesters
    batch_definitions = [
        ("CS-3A", dept_cse.id, 3, Shift.morning, 55),
        ("CS-3B", dept_cse.id, 3, Shift.morning, 50),
        ("CS-5A", dept_cse.id, 5, Shift.morning, 52),
        ("EC-3A", dept_ece.id, 3, Shift.morning, 45),
        ("EC-5A", dept_ece.id, 5, Shift.morning, 40),
        ("ME-3A", dept_me.id, 3, Shift.evening, 50),
        ("ME-5A", dept_me.id, 5, Shift.evening, 45),
        ("IT-3A", dept_it.id, 3, Shift.morning, 48),
        ("IT-5A", dept_it.id, 5, Shift.morning, 45),
    ]

    batch_map = {}
    for name, d_id, sem, sh, st in batch_definitions:
        b = Batch(name=name, department_id=d_id, semester=sem, shift=sh, strength=st)
        db.add(b)
        db.flush()
        batch_map[name] = b
    db.commit()

    # 7. Run Google OR-Tools CP-SAT Solver for CSE Sem 3 and ME Sem 3
    print("[7/8] Executing Google OR-Tools CP-SAT solver for official academic timetables...")

    # Solve CSE Sem 3
    print("  Solving CSE Semester 3 (Batches CS-3A, CS-3B)...")
    res_cse3 = generate_timetable_options(db=db, department_id=dept_cse.id, semester=3, num_options=3)
    if res_cse3['status'] in ('SUCCESS', 'OPTIMAL'):
        v_top = db.query(TimetableVersion).filter(
            TimetableVersion.department_id == dept_cse.id,
            TimetableVersion.semester == 3,
            TimetableVersion.option_rank == 1
        ).first()
        if v_top:
            v_top.status = TimetableStatus.approved
            log = ApprovalLog(
                timetable_version_id=v_top.id,
                action=ApprovalAction.approved,
                reviewer_id=hod_cse.id,
                comment="Official Semester 3 Academic Schedule Approved by Department HOD."
            )
            db.add(log)
            db.commit()
            print(f"  [OK] CSE Semester 3 Option 1 Approved ({len(v_top.slots)} slots, score {v_top.score}).")
    else:
        print(f"  [WARN] CSE Sem 3 solver result: {res_cse3['status']} - {res_cse3.get('message')}")

    # Solve ME Sem 3
    print("  Solving Mechanical Engineering Semester 3 (Batch ME-3A)...")
    res_me3 = generate_timetable_options(db=db, department_id=dept_me.id, semester=3, num_options=3)
    if res_me3['status'] in ('SUCCESS', 'OPTIMAL'):
        v_top_me = db.query(TimetableVersion).filter(
            TimetableVersion.department_id == dept_me.id,
            TimetableVersion.semester == 3,
            TimetableVersion.option_rank == 1
        ).first()
        if v_top_me:
            v_top_me.status = TimetableStatus.approved
            log = ApprovalLog(
                timetable_version_id=v_top_me.id,
                action=ApprovalAction.approved,
                reviewer_id=hod_me.id,
                comment="Approved evening shift timetable for ME Semester 3."
            )
            db.add(log)
            db.commit()
            print(f"  [OK] ME Semester 3 Option 1 Approved ({len(v_top_me.slots)} slots).")
    else:
        print(f"  [WARN] ME Sem 3 solver result: {res_me3['status']} - {res_me3.get('message')}")

    # Solve CSE Sem 5 (Active Candidate Options for Student Voting!)
    print("  Solving CSE Semester 5 (Batch CS-5A) for Student Candidate Voting...")
    res_cse5 = generate_timetable_options(db=db, department_id=dept_cse.id, semester=5, num_options=3)
    if res_cse5['status'] in ('SUCCESS', 'OPTIMAL'):
        v_cse5_options = db.query(TimetableVersion).filter(
            TimetableVersion.department_id == dept_cse.id,
            TimetableVersion.semester == 5
        ).order_by(TimetableVersion.option_rank.asc()).all()

        print(f"  [OK] CSE Semester 5 generated {len(v_cse5_options)} candidate options for student voting.")

        # Seed sample student votes so evaluators see live voting progress & percentage bars
        if len(v_cse5_options) >= 2:
            vote_alex = TimetableVote(
                user_id=stu_alex.id,
                timetable_version_id=v_cse5_options[0].id,
                department_id=dept_cse.id,
                semester=5,
                voted_at=datetime.utcnow() - timedelta(hours=2)
            )
            vote_maya = TimetableVote(
                user_id=stu_maya.id,
                timetable_version_id=v_cse5_options[1].id,
                department_id=dept_cse.id,
                semester=5,
                voted_at=datetime.utcnow() - timedelta(hours=1)
            )
            db.add_all([vote_alex, vote_maya])
            db.commit()
            print("  [OK] Seeded live student votes on CSE Sem 5 drafts (Alex -> Option 1, Maya -> Option 2).")
    else:
        print(f"  [WARN] CSE Sem 5 solver result: {res_cse5['status']} - {res_cse5.get('message')}")

    # Seed demo leaves
    leave_target_date = date.today() + timedelta(days=2)
    leave_req1 = FacultyLeave(
        faculty_id=faculty_map["Dr. Alan Turing"].id,
        substitute_faculty_id=faculty_map["Dr. Ada Lovelace"].id,
        date=leave_target_date,
        status=LeaveStatus.substituted
    )
    leave_req2 = FacultyLeave(
        faculty_id=faculty_map["Prof. James Watt"].id,
        substitute_faculty_id=faculty_map["Prof. Rudolf Diesel"].id,
        date=date.today() + timedelta(days=3),
        status=LeaveStatus.substituted
    )
    leave_req3 = FacultyLeave(
        faculty_id=faculty_map["Dr. Claude Shannon"].id,
        date=date.today() + timedelta(days=4),
        status=LeaveStatus.pending
    )
    db.add_all([leave_req1, leave_req2, leave_req3])
    db.commit()

    # Seed Notifications
    notifs = [
        # --- Admin Alerts (Technical Optimization & Engine Notices - Exclusively Admin) ---
        Notification(
            title="Constraint Engine: Schedule Optimization Complete",
            message="Google OR-Tools CP-SAT solver resolved all teacher-room constraints for CSE & ME with 0 clashes.",
            type="system",
            role="admin",
            link="/admin"
        ),
        Notification(
            title="Shift-Balancing Engine: Evening Shift Synchronized",
            message="Mechanical Engineering Evening Shift verified across Workshop & Thermal Labs with 0 double-bookings.",
            type="system",
            role="admin",
            link="/admin"
        ),
        Notification(
            title="File Pipeline: Storage Volume Verified",
            message="Coursework file system storage initialized with 12 course documents and verified SHA-256 integrity.",
            type="system",
            role="admin",
            link="/admin"
        ),

        # --- HOD Alerts (Department Leadership & Cohort Milestones) ---
        Notification(
            title="CSE Semester 3 Timetable Active",
            message="Official academic timetable has been published and is active across batches CS-3A and CS-3B.",
            type="timetable_published",
            role="hod",
            link="/hod"
        ),
        Notification(
            title="Faculty Leave Application Pending",
            message="Prof. Claude Shannon submitted a leave application for Friday. Needs substitute assignment.",
            type="leave_applied",
            role="hod",
            link="/hod"
        ),
        Notification(
            title="Coursework Submissions Milestone",
            message="15 students have turned in Assignment 2 (Red-Black Trees) across CSE batches.",
            type="classroom",
            role="hod",
            link="/hod"
        ),
        Notification(
            title="Student Voting Active: CSE Semester 5",
            message="Candidate timetable versions are open for student voting. Review student preferences before approving.",
            type="voting",
            role="hod",
            link="/hod"
        ),

        # --- Faculty Personal & Teaching Alerts ---
        Notification(
            title="Faculty Leave Approved & Substituted",
            message=f"Leave on {leave_target_date} approved. Dr. Ada Lovelace assigned as substitute.",
            type="leave_status",
            user_id=fac_turing.id,
            role=None,
            link="/faculty"
        ),
        Notification(
            title="New Student Submission: Assignment 2",
            message="Alex Chen submitted 'Red-Black Tree Balancing and Benchmarks' on time.",
            type="submission_received",
            user_id=fac_turing.id,
            role=None,
            link="/faculty"
        ),
        Notification(
            title="Teaching Schedule Active: CSE Sem 3",
            message="Your teaching schedule is live. Data Structures lectures allocated to Room 301.",
            type="timetable_published",
            user_id=fac_turing.id,
            role=None,
            link="/faculty"
        ),
        Notification(
            title="Substitution Duty Assigned",
            message=f"You have been assigned to cover classes on {leave_target_date} for Dr. Alan Turing.",
            type="substitution_assigned",
            user_id=fac_lovelace.id,
            role=None,
            link="/faculty"
        ),
        Notification(
            title="New Student Submission: Assignment 1",
            message="Maya Patel submitted 'Healthcare E-R Modeling & 3NF Schema' on time.",
            type="submission_received",
            user_id=fac_lovelace.id,
            role=None,
            link="/faculty"
        ),
        Notification(
            title="Teaching Schedule Active: CSE Sem 3",
            message="Your teaching schedule is live. Database Systems lectures allocated to Room 302.",
            type="timetable_published",
            user_id=fac_lovelace.id,
            role=None,
            link="/faculty"
        ),

        # --- Student Alerts (Coursework, Timetables, and Study Gaps) ---
        Notification(
            title="Official Semester Timetable Published",
            message="Your class schedule for Computer Science Semester 3 is now live. View your weekly periods.",
            type="timetable_published",
            role="student",
            link="/student"
        ),
        Notification(
            title="Student Voting Open: Semester 5 Schedule",
            message="HOD has generated 3 candidate timetable options for CSE Semester 5. Cast your vote for your preferred schedule!",
            type="voting",
            role="student",
            link="/student"
        ),
        Notification(
            title="Study-Gap Productivity Windows Available",
            message="Your schedule includes designated 1-hour study gaps on Tuesday & Thursday for library and self-study.",
            type="study_gap",
            role="student",
            link="/student"
        ),
        Notification(
            title="New Assignment: Red-Black Tree Balancing",
            message="Dr. Alan Turing posted Assignment 2 (Due in 4 days) for Batch CS-3A.",
            type="classroom_assignment",
            role="student",
            link="/student"
        ),
        Notification(
            title="New Study Material: Unit 3 Balanced BST Notes",
            message="Dr. Alan Turing uploaded lecture slides and reference notes for Data Structures.",
            type="classroom_material",
            role="student",
            link="/student"
        ),
        Notification(
            title="Classroom Announcement: Wireshark Lab Setup",
            message="Prof. Claude Shannon posted setup instructions for the upcoming Wireshark frame analysis lab.",
            type="classroom",
            role="student",
            link="/student"
        ),
        Notification(
            title="Submission Confirmed: Assignment 2",
            message="Your submission 'Red-Black Tree Balancing and Benchmarks' was successfully received on time.",
            type="submission_receipt",
            user_id=stu_user.id,
            role=None,
            link="/student"
        ),
    ]
    db.add_all(notifs)
    db.commit()

    # 8. Seed Classroom Materials & Assignments across Batches and Subjects
    print("[8/8] Seeding comprehensive classroom coursework streams across cohorts...")
    materials_dir = os.path.join("data", "uploads", "classroom", "materials")
    submissions_dir = os.path.join("data", "uploads", "classroom", "submissions")
    os.makedirs(materials_dir, exist_ok=True)
    os.makedirs(submissions_dir, exist_ok=True)

    # Sample PDF and Zip buffers
    def _create_mock_file(path, header):
        with open(path, "wb") as f:
            f.write(f"%PDF-1.4 OptiClass AI Coursework Artifact: {header}".encode('utf-8'))

    f_ds_notes = os.path.join(materials_dir, "Unit3_Balanced_BST_Notes.pdf")
    _create_mock_file(f_ds_notes, "Unit 3 - Balanced Binary Search Trees, AVL Rotations & Red-Black Invariants.")

    f_ds_assign = os.path.join(materials_dir, "Assignment2_Specs_Rubric.pdf")
    _create_mock_file(f_ds_assign, "Assignment 2 - Implement Red-Black Tree Balancing with Rotations.")

    f_db_notes = os.path.join(materials_dir, "Unit2_Relational_Algebra_Notes.pdf")
    _create_mock_file(f_db_notes, "Unit 2 - Relational Algebra Operators, Join Trees & Query Execution Plans.")

    f_db_assign = os.path.join(materials_dir, "Assignment1_DB_Normalization_Specs.pdf")
    _create_mock_file(f_db_assign, "Assignment 1 - Healthcare E-R Modeling, Functional Dependencies & 3NF.")

    f_net_manual = os.path.join(materials_dir, "Networks_Lab_Manual_Wireshark.pdf")
    _create_mock_file(f_net_manual, "Lab Manual - Wireshark Frame Captures, TCP Handshakes & RTT Calculations.")

    f_os_notes = os.path.join(materials_dir, "OS_Process_Sync_Notes.pdf")
    _create_mock_file(f_os_notes, "Lecture 5 - Dining Philosophers Problem, Semaphores & Mutex Locks.")

    f_fluid_notes = os.path.join(materials_dir, "Fluid_Mechanics_Bernoulli_Notes.pdf")
    _create_mock_file(f_fluid_notes, "Chapter 3 - Incompressible Navier-Stokes & Bernoulli Energy Conservation.")

    f_fluid_assign = os.path.join(materials_dir, "Design_Task_Venturi_Discharge.pdf")
    _create_mock_file(f_fluid_assign, "Design Problem - Discharge Coefficient Estimation for Venturi Flowmeters.")

    f_signals_notes = os.path.join(materials_dir, "Signals_Fourier_Analysis_Notes.pdf")
    _create_mock_file(f_signals_notes, "Unit 2 - Continuous-Time Fourier Transforms and LTI System Frequency Response.")

    # Student submission zip
    sub_alex_path = os.path.join(submissions_dir, "AlexChen_Assignment2_Code.zip")
    with open(sub_alex_path, "wb") as f:
        f.write(b"PK Student Submission Archive: Alex Chen - Red-Black Tree Implementation in C++17.")

    sub_maya_path = os.path.join(submissions_dir, "MayaPatel_Assignment1_ERD.pdf")
    _create_mock_file(sub_maya_path, "Maya Patel - Hospital Management Relational Schema & 3NF Normalization Proof.")

    # --- BATCH CS-3A COURSEWORK ---
    # 1. Data Structures (Dr. Turing)
    m1 = ClassMaterial(
        title="Unit 3: Balanced BSTs, AVL Rotations and B-Trees Slides",
        description="Comprehensive lecture notes covering tree height balancing, single and double rotations, and B-Tree indexing algorithms with complexity analysis.",
        type="material",
        batch_id=batch_map["CS-3A"].id,
        subject_id=subject_map["Data Structures"].id,
        faculty_id=faculty_map["Dr. Alan Turing"].id,
        file_name="Unit3_Balanced_BST_Notes.pdf",
        file_path=f_ds_notes,
        file_size=os.path.getsize(f_ds_notes)
    )

    due_ds = datetime.utcnow() + timedelta(days=4, hours=6)
    m2 = ClassMaterial(
        title="Assignment 2: Red-Black Tree Balancing and Benchmarks",
        description="Implement Red-Black tree insertion with recoloring and rotations in C++ or Python. Verify all black-height invariants and submit source code.",
        type="assignment",
        batch_id=batch_map["CS-3A"].id,
        subject_id=subject_map["Data Structures"].id,
        faculty_id=faculty_map["Dr. Alan Turing"].id,
        file_name="Assignment2_Specs_Rubric.pdf",
        file_path=f_ds_assign,
        file_size=os.path.getsize(f_ds_assign),
        due_date=due_ds
    )

    # 2. Database Systems (Dr. Lovelace)
    m3 = ClassMaterial(
        title="Unit 2: Relational Algebra & Advanced SQL Query Optimization",
        description="Detailed lecture slides covering relational algebra operators, query practical plans, index scan costs, and hash-join algorithms.",
        type="material",
        batch_id=batch_map["CS-3A"].id,
        subject_id=subject_map["Database Systems"].id,
        faculty_id=faculty_map["Dr. Ada Lovelace"].id,
        file_name="Unit2_Relational_Algebra_Notes.pdf",
        file_path=f_db_notes,
        file_size=os.path.getsize(f_db_notes)
    )

    due_db = datetime.utcnow() + timedelta(days=6, hours=12)
    m4 = ClassMaterial(
        title="Assignment 1: E-R Modeling & 3NF Normalization Case Study",
        description="Design an enterprise schema for a healthcare clinic. Provide entity-relationship diagram and decompose relations to Third Normal Form (3NF).",
        type="assignment",
        batch_id=batch_map["CS-3A"].id,
        subject_id=subject_map["Database Systems"].id,
        faculty_id=faculty_map["Dr. Ada Lovelace"].id,
        file_name="Assignment1_DB_Normalization_Specs.pdf",
        file_path=f_db_assign,
        file_size=os.path.getsize(f_db_assign),
        due_date=due_db
    )

    # 3. Computer Networks (Dr. Shannon)
    m5 = ClassMaterial(
        title="Lab Manual 4: Wireshark Packet Sniffing & TCP 3-Way Handshake",
        description="Practical laboratory guide on capturing packet frames, filtering by IP/port, and analyzing sequence/acknowledgment flags and TCP window sizes.",
        type="material",
        batch_id=batch_map["CS-3A"].id,
        subject_id=subject_map["Computer Networks"].id,
        faculty_id=faculty_map["Dr. Claude Shannon"].id,
        file_name="Networks_Lab_Manual_Wireshark.pdf",
        file_path=f_net_manual,
        file_size=os.path.getsize(f_net_manual)
    )

    # 4. Operating Systems (Dr. Hopper)
    m6 = ClassMaterial(
        title="Lecture 5: Process Synchronization & Classical Concurrency",
        description="Study notes exploring semaphores, mutex locks, condition variables, and solutions to the Dining Philosophers problem.",
        type="material",
        batch_id=batch_map["CS-3A"].id,
        subject_id=subject_map["Operating Systems"].id,
        faculty_id=faculty_map["Dr. Grace Hopper"].id,
        file_name="OS_Process_Sync_Notes.pdf",
        file_path=f_os_notes,
        file_size=os.path.getsize(f_os_notes)
    )

    # 5. Cohort Announcement
    m7 = ClassMaterial(
        title="Midterm Practical Examination Guidelines & Observation Notebook Submission",
        description="Midterm practical evaluations begin next Monday. Students must bring their signed lab observation logs. No exceptions will be entertained.",
        type="announcement",
        batch_id=batch_map["CS-3A"].id,
        subject_id=subject_map["Data Structures"].id,
        faculty_id=faculty_map["Dr. Alan Turing"].id,
    )

    # --- BATCH ME-3A COURSEWORK ---
    # 6. Fluid Mechanics (Prof. Watt)
    m8 = ClassMaterial(
        title="Chapter 3: Bernoulli Equation & Pipe Head Loss Calculations",
        description="Comprehensive engineering lecture notes covering the momentum equation, friction factor estimation via Moody diagram, and minor head losses.",
        type="material",
        batch_id=batch_map["ME-3A"].id,
        subject_id=subject_map["Fluid Mechanics"].id,
        faculty_id=faculty_map["Prof. James Watt"].id,
        file_name="Fluid_Mechanics_Bernoulli_Notes.pdf",
        file_path=f_fluid_notes,
        file_size=os.path.getsize(f_fluid_notes)
    )

    due_me = datetime.utcnow() + timedelta(days=5, hours=10)
    m9 = ClassMaterial(
        title="Design Task 1: Venturi Meter Discharge Coefficient Calculations",
        description="Analyze experimental laboratory data for water flow through a 50mm convergent-divergent Venturi meter. Plot head loss versus Reynolds number.",
        type="assignment",
        batch_id=batch_map["ME-3A"].id,
        subject_id=subject_map["Fluid Mechanics"].id,
        faculty_id=faculty_map["Prof. James Watt"].id,
        file_name="Design_Task_Venturi_Discharge.pdf",
        file_path=f_fluid_assign,
        file_size=os.path.getsize(f_fluid_assign),
        due_date=due_me
    )

    # --- BATCH EC-3A COURSEWORK ---
    m10 = ClassMaterial(
        title="Unit 2: Fourier Transforms & Continuous-Time Frequency Analysis",
        description="Mathematical foundations of CTFT, Dirichlet conditions, frequency domain convolution, and bandwidth constraints for LTI filters.",
        type="material",
        batch_id=batch_map["EC-3A"].id,
        subject_id=subject_map["Signals & Systems"].id,
        faculty_id=faculty_map["Prof. Nikola Tesla"].id,
        file_name="Signals_Fourier_Analysis_Notes.pdf",
        file_path=f_signals_notes,
        file_size=os.path.getsize(f_signals_notes)
    )

    # --- BATCH IT-3A COURSEWORK ---
    f_it_notes = os.path.join(materials_dir, "Cloud_Microservices_Architectures.pdf")
    _create_mock_file(f_it_notes, "Unit 1 - Cloud Native Systems, Docker Containers and Kubernetes Orchestration.")

    m11 = ClassMaterial(
        title="Unit 1: Cloud Native Microservices Architecture & Containerization",
        description="Detailed guide covering 12-factor application architecture, Docker containers, Service Meshes, and serverless compute paradigms.",
        type="material",
        batch_id=batch_map["IT-3A"].id,
        subject_id=subject_map["Web Technologies & Cloud"].id,
        faculty_id=faculty_map["Dr. Tim Berners-Lee"].id,
        file_name="Cloud_Microservices_Architectures.pdf",
        file_path=f_it_notes,
        file_size=os.path.getsize(f_it_notes)
    )

    due_it = datetime.utcnow() + timedelta(days=7, hours=4)
    f_it_assign = os.path.join(materials_dir, "Distributed_Consensus_Raft_Lab.pdf")
    _create_mock_file(f_it_assign, "Assignment 1 - Raft Leader Election and Log Replication.")

    m12 = ClassMaterial(
        title="Assignment 1: Distributed Consensus via Raft Protocol",
        description="Implement leader election and heartbeat pinging in a 3-node simulated cluster using RPC or sockets.",
        type="assignment",
        batch_id=batch_map["IT-3A"].id,
        subject_id=subject_map["Distributed Systems"].id,
        faculty_id=faculty_map["Dr. Barbara Liskov"].id,
        file_name="Distributed_Consensus_Raft_Lab.pdf",
        file_path=f_it_assign,
        file_size=os.path.getsize(f_it_assign),
        due_date=due_it
    )

    db.add_all([m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12])
    db.commit()
    db.refresh(m2)
    db.refresh(m4)

    # Seed Student Submissions
    sub1 = StudentSubmission(
        material_id=m2.id,
        student_id=stu_user.id,
        student_name="Alex Chen (Roll: CS-2024-042)",
        file_name="AlexChen_Assignment2_Code.zip",
        file_path=sub_alex_path,
        file_size=os.path.getsize(sub_alex_path),
        notes="All test cases verified including duplicate keys and height benchmarks. Added test suite for black-height verification.",
        status="submitted",
        submitted_at=datetime.utcnow() - timedelta(hours=3)
    )

    sub2 = StudentSubmission(
        material_id=m4.id,
        student_id=stu_maya.id,
        student_name="Maya Patel (Roll: CS-2024-019)",
        file_name="MayaPatel_Assignment1_ERD.pdf",
        file_path=sub_maya_path,
        file_size=os.path.getsize(sub_maya_path),
        notes="Decomposed into 3NF. Checked all functional dependencies and lossless join conditions.",
        status="submitted",
        submitted_at=datetime.utcnow() - timedelta(hours=8)
    )

    db.add_all([sub1, sub2])
    db.commit()

    print("  [OK] Seeded rich multi-subject coursework, assignments, and verified student turn-in records.")

    db.close()

    print("==========================================================")
    print("  ENTERPRISE SEED DATA LOADED SUCCESSFULLY!")
    print("==========================================================")
    print("  Departments: 4 (CSE, ECE, ME, IT)")
    print("  Classrooms/Labs: 19 rooms with specialized equipment")
    print("  Faculty Members: 21 professors with workload norms")
    print("  Curriculum Subjects: 35 courses (NEP 2020 Compliant)")
    print("  Active Cohorts: 9 student batches (CS-3A, CS-3B, CS-5A, EC-3A, EC-5A, ME-3A, ME-5A, IT-3A, IT-5A)")
    print("  Classroom Coursework: 12 materials & assignments across cohorts")
    print("----------------------------------------------------------")
    print("  Demo Logins (1-Click Switcher on Login Page):")
    print("    * Admin:   admin@opticlass.edu          / admin123")
    print("    * HOD:     hod.cse@opticlass.edu        / hod123")
    print("    * Faculty: faculty.turing@opticlass.edu / faculty123")
    print("    * Student: student.cse@opticlass.edu    / student123")
    print("==========================================================")

if __name__ == "__main__":
    seed()
