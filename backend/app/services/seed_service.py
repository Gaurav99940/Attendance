import os
import cv2
import json
import random
import bcrypt
import numpy as np
from datetime import datetime, date, timedelta
from typing import List, Dict, Any
from app.config.settings import settings
from app.database.connection import get_db, get_db_manager
from app.face_recognition.engine import get_face_engine

SAMPLE_EMPLOYEES = [
    {"id": "EMP001", "name": "Rahul Sharma", "dept": "Engineering", "role": "Lead Architect", "email": "rahul.sharma@smartcorp.com", "mobile": "+91 98765 43210", "shift": "shift_general"},
    {"id": "EMP002", "name": "Priya Patel", "dept": "Engineering", "role": "Senior Frontend Engineer", "email": "priya.patel@smartcorp.com", "mobile": "+91 98765 43211", "shift": "shift_flexible"},
    {"id": "EMP003", "name": "Amit Kumar", "dept": "Engineering", "role": "Backend Engineer", "email": "amit.kumar@smartcorp.com", "mobile": "+91 98765 43212", "shift": "shift_general"},
    {"id": "EMP004", "name": "Sneha Reddy", "dept": "Human Resources", "role": "HR Manager", "email": "sneha.reddy@smartcorp.com", "mobile": "+91 98765 43213", "shift": "shift_general"},
    {"id": "EMP005", "name": "Vikram Malhotra", "dept": "Sales", "role": "Sales Director", "email": "vikram.m@smartcorp.com", "mobile": "+91 98765 43214", "shift": "shift_morning"},
    {"id": "EMP006", "name": "Ananya Iyer", "dept": "Design", "role": "Principal UI/UX Designer", "email": "ananya.iyer@smartcorp.com", "mobile": "+91 98765 43215", "shift": "shift_flexible"},
    {"id": "EMP007", "name": "Rohan Gupta", "dept": "Marketing", "role": "Growth Specialist", "email": "rohan.gupta@smartcorp.com", "mobile": "+91 98765 43216", "shift": "shift_general"},
    {"id": "EMP008", "name": "Neha Verma", "dept": "Finance", "role": "Senior Financial Analyst", "email": "neha.verma@smartcorp.com", "mobile": "+91 98765 43217", "shift": "shift_general"},
    {"id": "EMP009", "name": "Arjun Nair", "dept": "Operations", "role": "Operations Lead", "email": "arjun.nair@smartcorp.com", "mobile": "+91 98765 43218", "shift": "shift_morning"},
    {"id": "EMP010", "name": "Kavita Joshi", "dept": "Engineering", "role": "QA Automation Engineer", "email": "kavita.joshi@smartcorp.com", "mobile": "+91 98765 43219", "shift": "shift_flexible"},
    {"id": "EMP011", "name": "Rajesh Deshmukh", "dept": "Sales", "role": "Enterprise Account Executive", "email": "rajesh.d@smartcorp.com", "mobile": "+91 98765 43220", "shift": "shift_general"},
    {"id": "EMP012", "name": "Pooja Singh", "dept": "Human Resources", "role": "Talent Acquisition Specialist", "email": "pooja.singh@smartcorp.com", "mobile": "+91 98765 43221", "shift": "shift_general"},
    {"id": "EMP013", "name": "Karthik Sundaram", "dept": "Engineering", "role": "DevOps & Cloud Engineer", "email": "karthik.s@smartcorp.com", "mobile": "+91 98765 43222", "shift": "shift_flexible"},
    {"id": "EMP014", "name": "Meera Choudhury", "dept": "Design", "role": "Product Designer", "email": "meera.c@smartcorp.com", "mobile": "+91 98765 43223", "shift": "shift_general"},
    {"id": "EMP015", "name": "Suresh Raina", "dept": "Operations", "role": "Logistics & Facility Lead", "email": "suresh.raina@smartcorp.com", "mobile": "+91 98765 43224", "shift": "shift_morning"},
    {"id": "EMP016", "name": "Deepa Menon", "dept": "Finance", "role": "Accounts Executive", "email": "deepa.menon@smartcorp.com", "mobile": "+91 98765 43225", "shift": "shift_general"},
    {"id": "EMP017", "name": "Manish Tiwari", "dept": "Marketing", "role": "Content & Brand Lead", "email": "manish.tiwari@smartcorp.com", "mobile": "+91 98765 43226", "shift": "shift_general"},
    {"id": "EMP018", "name": "Sunita Saxena", "dept": "Legal", "role": "Corporate Compliance Officer", "email": "sunita.saxena@smartcorp.com", "mobile": "+91 98765 43227", "shift": "shift_general"},
    {"id": "EMP019", "name": "Harish Bhat", "dept": "Engineering", "role": "AI / ML Research Engineer", "email": "harish.bhat@smartcorp.com", "mobile": "+91 98765 43228", "shift": "shift_flexible"},
    {"id": "EMP020", "name": "Divya Pillai", "dept": "Customer Success", "role": "Client Relations Manager", "email": "divya.pillai@smartcorp.com", "mobile": "+91 98765 43229", "shift": "shift_general"}
]

SHIFTS_DATA = [
    {
        "id": "shift_general",
        "name": "General Day Shift",
        "startTime": "10:30 AM",
        "endTime": "06:00 PM",
        "requiredWorkingMinutes": 450,
        "fullDayMinimumMinutes": 420,
        "halfDayMinimumMinutes": 225,
        "earlyExitGraceMinutes": 15,
        "lateGraceMinutes": 15,
        "overtimeThreshold": 480,
        "department": "All",
        "active": True
    },
    {
        "id": "shift_standard",
        "name": "Standard Day Shift",
        "startTime": "09:00 AM",
        "endTime": "05:00 PM",
        "requiredWorkingMinutes": 480,
        "fullDayMinimumMinutes": 450,
        "halfDayMinimumMinutes": 240,
        "earlyExitGraceMinutes": 15,
        "lateGraceMinutes": 15,
        "overtimeThreshold": 510,
        "department": "All",
        "active": True
    },
    {
        "id": "shift_morning",
        "name": "Morning Operations Shift",
        "startTime": "08:00 AM",
        "endTime": "04:00 PM",
        "requiredWorkingMinutes": 480,
        "fullDayMinimumMinutes": 450,
        "halfDayMinimumMinutes": 240,
        "earlyExitGraceMinutes": 15,
        "lateGraceMinutes": 15,
        "overtimeThreshold": 510,
        "department": "Operations",
        "active": True
    },
    {
        "id": "shift_flexible",
        "name": "Flexible Tech Shift",
        "startTime": "10:30 AM",
        "endTime": "06:00 PM",
        "requiredWorkingMinutes": 450,
        "fullDayMinimumMinutes": 420,
        "halfDayMinimumMinutes": 225,
        "earlyExitGraceMinutes": 15,
        "lateGraceMinutes": 20,
        "overtimeThreshold": 480,
        "department": "Engineering",
        "active": True
    },
    {
        "id": "shift_evening",
        "name": "Evening Support Shift",
        "startTime": "02:00 PM",
        "endTime": "10:00 PM",
        "requiredWorkingMinutes": 480,
        "fullDayMinimumMinutes": 450,
        "halfDayMinimumMinutes": 240,
        "earlyExitGraceMinutes": 15,
        "lateGraceMinutes": 15,
        "overtimeThreshold": 510,
        "department": "Customer Success",
        "active": True
    }
]

def generate_avatar_image(name: str, emp_id: str) -> str:
    """Creates a clean colored avatar placeholder image for employee and returns URL path"""
    filename = f"avatar_{emp_id}.jpg"
    filepath = os.path.join(settings.UPLOAD_DIR, "avatars", filename)
    
    # Generate distinct consistent color based on name hash
    hash_val = hash(name)
    r = (hash_val & 0xFF0000) >> 16
    g = (hash_val & 0x00FF00) >> 8
    b = hash_val & 0x0000FF
    r = max(60, min(210, r))
    g = max(60, min(210, g))
    b = max(60, min(210, b))

    img = np.full((200, 200, 3), (b, g, r), dtype=np.uint8)
    initials = "".join([part[0].upper() for part in name.split()[:2]])
    cv2.putText(img, initials, (50, 125), cv2.FONT_HERSHEY_DUPLEX, 2.0, (255, 255, 255), 3, cv2.LINE_AA)
    cv2.putText(img, emp_id, (60, 170), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (240, 240, 240), 1, cv2.LINE_AA)
    
    cv2.imwrite(filepath, img)
    return f"/uploads/avatars/{filename}"

def generate_synthetic_embedding(seed_str: str) -> List[float]:
    """Generates a reproducible 512-D unit vector for face recognition simulation"""
    rng = np.random.RandomState(abs(hash(seed_str)) % (2**31 - 1))
    vec = rng.randn(512).astype(np.float32)
    norm = np.linalg.norm(vec)
    vec = vec / norm
    return vec.tolist()

def seed_database(force_reseed: bool = False):
    """Populates MongoDB with complete 20 employees and 30-day realistic historical attendance"""
    db = get_db()
    mgr = get_db_manager()

    emp_count = db.employees.count_documents({})
    if emp_count >= 20 and not force_reseed:
        # Already seeded
        return {"status": "already_seeded", "employees_count": emp_count}

    # Clear existing collections if reseed requested
    if force_reseed or emp_count == 0:
        db.employees.delete_many({})
        db.face_embeddings.delete_many({})
        db.attendance.delete_many({})
        db.shifts.delete_many({})
        db.admins.delete_many({})
        db.unknown_detections.delete_many({})
        db.audit_logs.delete_many({})
        db.settings.delete_many({})

    # 1. Seed Shifts
    for shift in SHIFTS_DATA:
        db.shifts.update_one({"id": shift["id"]}, {"$set": shift}, upsert=True)

    # 2. Seed Default Admin
    pwd_bytes = settings.DEFAULT_ADMIN_PASSWORD.encode('utf-8')
    hashed = bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode('utf-8')
    admin_doc = {
        "id": "admin_master_1",
        "name": settings.DEFAULT_ADMIN_NAME,
        "email": settings.DEFAULT_ADMIN_EMAIL,
        "passwordHash": hashed,
        "role": "Super Admin",
        "createdAt": datetime.now().isoformat()
    }
    db.admins.update_one({"email": settings.DEFAULT_ADMIN_EMAIL}, {"$set": admin_doc}, upsert=True)

    # 3. Seed System Settings
    sys_settings = {
        "id": "global_settings",
        "faceConfidenceThreshold": 0.62,
        "detectionCooldownSeconds": 20,
        "sessionTimeoutMinutes": 480,
        "organizationName": "SmartCorp Technologies Pvt Ltd",
        "timeZone": "Asia/Kolkata",
        "dateFormat": "YYYY-MM-DD",
        "timeFormat": "12 Hours (AM/PM)",
        "autoInTimeWindowStart": "06:00 AM",
        "autoOutTimeWindowStart": "02:00 PM"
    }
    db.settings.update_one({"id": "global_settings"}, {"$set": sys_settings}, upsert=True)

    # 4. Seed 20 Employees & Face Embeddings
    for emp_data in SAMPLE_EMPLOYEES:
        emp_id = emp_data["id"]
        avatar_path = generate_avatar_image(emp_data["name"], emp_id)
        
        emp_doc = {
            "employeeId": emp_id,
            "name": emp_data["name"],
            "department": emp_data["dept"],
            "designation": emp_data["role"],
            "email": emp_data["email"],
            "mobile": emp_data["mobile"],
            "profilePhoto": avatar_path,
            "shiftId": emp_data["shift"],
            "joiningDate": (date.today() - timedelta(days=random.randint(180, 800))).isoformat(),
            "status": "Active",
            "faceCount": 3,
            "createdAt": (datetime.now() - timedelta(days=60)).isoformat(),
            "updatedAt": datetime.now().isoformat()
        }
        db.employees.update_one({"employeeId": emp_id}, {"$set": emp_doc}, upsert=True)

        # Create multiple angle embeddings (front, left, right)
        for angle in ["front", "left_angle", "right_angle"]:
            emb_vec = generate_synthetic_embedding(f"{emp_id}_{angle}")
            emb_doc = {
                "id": f"emb_{emp_id}_{angle}",
                "employeeId": emp_id,
                "embedding": emb_vec,
                "imagePath": avatar_path,
                "angleLabel": angle,
                "createdAt": datetime.now().isoformat()
            }
            db.face_embeddings.update_one({"id": emb_doc["id"]}, {"$set": emb_doc}, upsert=True)

    # 5. Generate 30-Day Historical Attendance Records for All 20 Employees
    today = date.today()
    shift_lookup = {s["id"]: s for s in SHIFTS_DATA}

    attendance_batch = []
    
    for day_offset in range(29, -1, -1):
        record_date = today - timedelta(days=day_offset)
        date_str = record_date.isoformat()
        is_today = (day_offset == 0)
        is_weekend = record_date.weekday() >= 5  # Sat = 5, Sun = 6

        for i, emp in enumerate(SAMPLE_EMPLOYEES):
            emp_id = emp["id"]
            shift = shift_lookup.get(emp["shift"], SHIFTS_DATA[0])
            expected_in = shift["startTime"]
            expected_out = shift["endTime"]

            if is_weekend:
                # Weekend record
                attendance_batch.append({
                    "employeeId": emp_id,
                    "employeeName": emp["name"],
                    "department": emp["dept"],
                    "date": date_str,
                    "inTime": None,
                    "outTime": None,
                    "workingDuration": "0h 0m",
                    "workingMinutes": 0,
                    "expectedIn": expected_in,
                    "expectedOut": expected_out,
                    "lateBy": 0,
                    "earlyExitBy": 0,
                    "status": "WEEKEND",
                    "verificationImage": None,
                    "remarks": "Scheduled Weekend Off",
                    "createdAt": datetime.combine(record_date, datetime.min.time()).isoformat(),
                    "updatedAt": datetime.combine(record_date, datetime.min.time()).isoformat()
                })
                continue

            if is_today:
                # Distribution for today:
                # EMP001 - EMP014: Currently Inside (Marked IN early/on-time or slightly late, not yet checked OUT)
                # EMP015 - EMP018: Checked IN & OUT (Completed full day)
                # EMP019: On Leave
                # EMP020: Not yet arrived / Absent
                if i < 14:
                    # Arrived today, currently INSIDE
                    is_late = (i in [3, 7, 11])
                    in_min = random.randint(3, 14) if not is_late else random.randint(18, 38)
                    in_hour = int(expected_in.split(":")[0])
                    in_period = "AM"
                    in_time_str = f"{in_hour:02d}:{in_min:02d} {in_period}"
                    late_by = in_min if is_late else 0
                    
                    status = "LATE" if is_late else "INCOMPLETE"
                    attendance_batch.append({
                        "employeeId": emp_id,
                        "employeeName": emp["name"],
                        "department": emp["dept"],
                        "date": date_str,
                        "inTime": in_time_str,
                        "outTime": None,
                        "workingDuration": "In Progress",
                        "workingMinutes": 0,
                        "expectedIn": expected_in,
                        "expectedOut": expected_out,
                        "lateBy": late_by,
                        "earlyExitBy": 0,
                        "status": status,
                        "verificationImage": f"/uploads/avatars/avatar_{emp_id}.jpg",
                        "outVerificationImage": None,
                        "remarks": f"Logged IN via Camera Main Gate. Currently active inside office." + (f" (Late by {late_by} mins)" if late_by > 0 else ""),
                        "createdAt": datetime.now().isoformat(),
                        "updatedAt": datetime.now().isoformat()
                    })
                elif i < 18:
                    # Completed full day early shift
                    in_time_str = "08:55 AM"
                    out_time_str = "05:10 PM"
                    dur_min = 495
                    attendance_batch.append({
                        "employeeId": emp_id,
                        "employeeName": emp["name"],
                        "department": emp["dept"],
                        "date": date_str,
                        "inTime": in_time_str,
                        "outTime": out_time_str,
                        "workingDuration": "8h 15m",
                        "workingMinutes": dur_min,
                        "expectedIn": expected_in,
                        "expectedOut": expected_out,
                        "lateBy": 0,
                        "earlyExitBy": 0,
                        "status": "FULL DAY",
                        "verificationImage": f"/uploads/avatars/avatar_{emp_id}.jpg",
                        "outVerificationImage": f"/uploads/avatars/avatar_{emp_id}.jpg",
                        "remarks": "Day completed normally.",
                        "createdAt": datetime.now().isoformat(),
                        "updatedAt": datetime.now().isoformat()
                    })
                elif i == 18:
                    # On Leave today
                    attendance_batch.append({
                        "employeeId": emp_id,
                        "employeeName": emp["name"],
                        "department": emp["dept"],
                        "date": date_str,
                        "inTime": None,
                        "outTime": None,
                        "workingDuration": "0h 0m",
                        "workingMinutes": 0,
                        "expectedIn": expected_in,
                        "expectedOut": expected_out,
                        "lateBy": 0,
                        "earlyExitBy": 0,
                        "status": "ON LEAVE",
                        "verificationImage": None,
                        "remarks": "Approved Sick Leave",
                        "createdAt": datetime.now().isoformat(),
                        "updatedAt": datetime.now().isoformat()
                    })
                else:
                    # Absent / Not arrived
                    attendance_batch.append({
                        "employeeId": emp_id,
                        "employeeName": emp["name"],
                        "department": emp["dept"],
                        "date": date_str,
                        "inTime": None,
                        "outTime": None,
                        "workingDuration": "0h 0m",
                        "workingMinutes": 0,
                        "expectedIn": expected_in,
                        "expectedOut": expected_out,
                        "lateBy": 0,
                        "earlyExitBy": 0,
                        "status": "ABSENT",
                        "verificationImage": None,
                        "remarks": "Not reported for shift",
                        "createdAt": datetime.now().isoformat(),
                        "updatedAt": datetime.now().isoformat()
                    })
                continue

            # Historical Weekdays (day_offset > 0)
            rand_roll = random.random()
            if rand_roll < 0.84:
                # FULL DAY (with occasional late)
                is_late = random.random() < 0.15
                in_hour = int(expected_in.split(":")[0])
                in_min = random.randint(48, 59) if random.random() < 0.6 else random.randint(0, 12)
                if in_min >= 48:
                    in_hour_adj = in_hour - 1 if in_hour > 1 else 12
                    in_time_str = f"{in_hour_adj:02d}:{in_min:02d} AM"
                    late_by = 0
                else:
                    in_time_str = f"{in_hour:02d}:{in_min:02d} AM"
                    late_by = in_min if is_late and in_min > 15 else 0

                if is_late and late_by == 0:
                    late_by = random.randint(18, 35)
                    in_time_str = f"{in_hour:02d}:{late_by:02d} AM"

                out_hour = int(expected_out.split(":")[0])
                out_min = random.randint(8, 45)
                out_time_str = f"{out_hour:02d}:{out_min:02d} PM"

                # Calculate working duration
                dur_minutes = 480 + out_min - late_by + random.randint(5, 20)
                dur_hours = dur_minutes // 60
                dur_rem = dur_minutes % 60
                duration_str = f"{dur_hours}h {dur_rem}m"

                attendance_batch.append({
                    "employeeId": emp_id,
                    "employeeName": emp["name"],
                    "department": emp["dept"],
                    "date": date_str,
                    "inTime": in_time_str,
                    "outTime": out_time_str,
                    "workingDuration": duration_str,
                    "workingMinutes": dur_minutes,
                    "expectedIn": expected_in,
                    "expectedOut": expected_out,
                    "lateBy": late_by,
                    "earlyExitBy": 0,
                    "status": "FULL DAY" if late_by == 0 else "LATE",
                    "verificationImage": f"/uploads/avatars/avatar_{emp_id}.jpg",
                    "outVerificationImage": f"/uploads/avatars/avatar_{emp_id}.jpg",
                    "remarks": "Automatic verification logged" + (f" (Late arrival: {late_by} mins)" if late_by > 0 else ""),
                    "createdAt": datetime.combine(record_date, datetime.min.time()).isoformat(),
                    "updatedAt": datetime.combine(record_date, datetime.min.time()).isoformat()
                })

            elif rand_roll < 0.90:
                # HALF DAY
                in_time_str = "09:05 AM"
                out_time_str = "01:25 PM"
                attendance_batch.append({
                    "employeeId": emp_id,
                    "employeeName": emp["name"],
                    "department": emp["dept"],
                    "date": date_str,
                    "inTime": in_time_str,
                    "outTime": out_time_str,
                    "workingDuration": "4h 20m",
                    "workingMinutes": 260,
                    "expectedIn": expected_in,
                    "expectedOut": expected_out,
                    "lateBy": 0,
                    "earlyExitBy": 215,
                    "status": "HALF DAY",
                    "verificationImage": f"/uploads/avatars/avatar_{emp_id}.jpg",
                    "outVerificationImage": f"/uploads/avatars/avatar_{emp_id}.jpg",
                    "remarks": "Half day approved by team manager.",
                    "createdAt": datetime.combine(record_date, datetime.min.time()).isoformat(),
                    "updatedAt": datetime.combine(record_date, datetime.min.time()).isoformat()
                })

            elif rand_roll < 0.95:
                # ON LEAVE
                attendance_batch.append({
                    "employeeId": emp_id,
                    "employeeName": emp["name"],
                    "department": emp["dept"],
                    "date": date_str,
                    "inTime": None,
                    "outTime": None,
                    "workingDuration": "0h 0m",
                    "workingMinutes": 0,
                    "expectedIn": expected_in,
                    "expectedOut": expected_out,
                    "lateBy": 0,
                    "earlyExitBy": 0,
                    "status": "ON LEAVE",
                    "verificationImage": None,
                    "remarks": "Casual / Annual Approved Leave",
                    "createdAt": datetime.combine(record_date, datetime.min.time()).isoformat(),
                    "updatedAt": datetime.combine(record_date, datetime.min.time()).isoformat()
                })

            else:
                # ABSENT
                attendance_batch.append({
                    "employeeId": emp_id,
                    "employeeName": emp["name"],
                    "department": emp["dept"],
                    "date": date_str,
                    "inTime": None,
                    "outTime": None,
                    "workingDuration": "0h 0m",
                    "workingMinutes": 0,
                    "expectedIn": expected_in,
                    "expectedOut": expected_out,
                    "lateBy": 0,
                    "earlyExitBy": 0,
                    "status": "ABSENT",
                    "verificationImage": None,
                    "remarks": "Unnotified Absence",
                    "createdAt": datetime.combine(record_date, datetime.min.time()).isoformat(),
                    "updatedAt": datetime.combine(record_date, datetime.min.time()).isoformat()
                })

    # Bulk insert attendance records
    if attendance_batch:
        db.attendance.insert_many(attendance_batch)

    # 6. Seed Sample Unknown Detections
    for u_idx in range(4):
        unk_doc = {
            "id": f"unk_sample_{u_idx+1}",
            "capturedImage": "/uploads/avatars/avatar_EMP001.jpg",
            "detectedAt": (datetime.now() - timedelta(hours=random.randint(1, 48))).isoformat(),
            "confidence": round(random.uniform(22.0, 48.0), 1),
            "cameraId": "cam_main",
            "reviewed": False
        }
        db.unknown_detections.insert_one(unk_doc)

    # 7. Seed Sample Audit Logs
    audit_samples = [
        {"action": "SYSTEM_INIT", "performedBy": "System Admin", "entityType": "System", "entityId": "smartface_core", "details": {"event": "Initialized platform and verified database connections"}, "timestamp": (datetime.now() - timedelta(days=29)).isoformat()},
        {"action": "EMPLOYEE_ONBOARDING", "performedBy": "Sneha Reddy (HR)", "entityType": "Employee", "entityId": "EMP001", "details": {"name": "Rahul Sharma", "dept": "Engineering"}, "timestamp": (datetime.now() - timedelta(days=28)).isoformat()},
        {"action": "SHIFT_UPDATE", "performedBy": "Chief Administrator", "entityType": "Shift", "entityId": "shift_flexible", "details": {"name": "Flexible Tech Shift", "graceMinutes": 20}, "timestamp": (datetime.now() - timedelta(days=15)).isoformat()}
    ]
    for aud in audit_samples:
        db.audit_logs.insert_one(aud)

    # Persist state
    mgr.save_state()

    # Refresh Face Recognition Engine cache
    get_face_engine().load_embeddings_from_db(db)

    return {
        "status": "success",
        "employees_seeded": len(SAMPLE_EMPLOYEES),
        "attendance_records_seeded": len(attendance_batch),
        "shifts_seeded": len(SHIFTS_DATA)
    }
