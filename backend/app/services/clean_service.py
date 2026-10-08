import logging
import bcrypt
from datetime import datetime
from app.config.settings import settings
from app.database.connection import get_db, get_db_manager
from app.face_recognition.engine import get_face_engine

logger = logging.getLogger("smartface.cleaner")

DEFAULT_SHIFTS = [
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

def clear_all_demo_data():
    """
    Completely removes all demo employees, demo attendance records,
    demo face embeddings, and unknown captures.
    Ensures default admin and shifts remain active.
    """
    db = get_db()
    mgr = get_db_manager()

    logger.info("Clearing all demo employees, attendance records, and face embeddings...")
    
    # 1. Delete all employee and attendance records
    deleted_emp = db.employees.delete_many({})
    deleted_att = db.attendance.delete_many({})
    deleted_faces = db.face_embeddings.delete_many({})
    deleted_unk = db.unknown_detections.delete_many({})

    # 2. Ensure Admin account exists
    admin_count = db.admins.count_documents({})
    if admin_count == 0:
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
        db.admins.insert_one(admin_doc)

    # 3. Ensure Default Shifts exist
    for shift in DEFAULT_SHIFTS:
        db.shifts.update_one({"id": shift["id"]}, {"$set": shift}, upsert=True)

    # 4. Save state & reload engine cache
    mgr.save_state()
    get_face_engine().load_embeddings_from_db(db)

    logger.info("All demo data removed. Platform is clean and ready for real employee registrations.")

    return {
        "status": "success",
        "message": "All demo data has been wiped. Platform is ready for manual employee enrollment.",
        "employees_deleted": deleted_emp.deleted_count,
        "attendance_deleted": deleted_att.deleted_count,
        "faces_deleted": deleted_faces.deleted_count
    }

if __name__ == "__main__":
    res = clear_all_demo_data()
    print(res)
