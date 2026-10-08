import os
import uuid
from typing import List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import SystemSettingsModel, ShiftCreate, ShiftUpdate, ShiftResponse
from app.database.connection import get_db, get_db_manager
from app.services.auth_service import get_current_admin
from app.services.seed_service import seed_database
from app.services.clean_service import clear_all_demo_data
from app.face_recognition.engine import get_face_engine
from app.config.settings import settings

router = APIRouter(prefix="/settings", tags=["Settings & Shifts"])

class MongoConnectRequest(BaseModel):
    uri: str
    dbName: str = "smart_attendance"

@router.get("")
def get_system_settings(admin=Depends(get_current_admin)):
    db = get_db()
    settings_doc = db.settings.find_one({"id": "global_settings"})
    if not settings_doc:
        default_settings = SystemSettingsModel().dict()
        default_settings["id"] = "global_settings"
        db.settings.insert_one(default_settings)
        get_db_manager().save_state()
        return default_settings
    
    d = dict(settings_doc)
    if "_id" in d:
        del d["_id"]
    return d

@router.put("")
def update_system_settings(req: SystemSettingsModel, admin=Depends(get_current_admin)):
    db = get_db()
    data = req.dict()
    data["id"] = "global_settings"
    
    db.settings.update_one({"id": "global_settings"}, {"$set": data}, upsert=True)
    get_db_manager().save_state()
    return {"message": "Settings updated successfully.", "settings": data}

@router.get("/shifts")
def get_shifts(admin=Depends(get_current_admin)):
    db = get_db()
    shifts = list(db.shifts.find({}))
    results = []
    for s in shifts:
        d = dict(s)
        if "_id" in d:
            del d["_id"]
        results.append(d)
    return results

@router.post("/shifts")
def create_shift(req: ShiftCreate, admin=Depends(get_current_admin)):
    db = get_db()
    shift_id = req.id or f"shift_{uuid.uuid4().hex[:8]}"
    doc = req.dict()
    doc["id"] = shift_id
    
    db.shifts.update_one({"id": shift_id}, {"$set": doc}, upsert=True)
    get_db_manager().save_state()
    return {"message": "Shift created successfully", "shift": doc}

@router.put("/shifts/{id}")
def update_shift(id: str, req: ShiftUpdate, admin=Depends(get_current_admin)):
    db = get_db()
    update_data = {k: v for k, v in req.dict(exclude_unset=True).items() if v is not None}
    
    res = db.shifts.update_one({"id": id}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    get_db_manager().save_state()
    return {"message": "Shift updated successfully"}

@router.delete("/shifts/{id}")
def delete_shift(id: str, admin=Depends(get_current_admin)):
    db = get_db()
    res = db.shifts.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Shift not found")
    get_db_manager().save_state()
    return {"message": "Shift deleted successfully"}

@router.post("/seed-demo")
def reseed_demo_data(admin=Depends(get_current_admin)):
    """Demo seeding disabled for clean production database"""
    raise HTTPException(
        status_code=400,
        detail="Demo seeding is disabled. Please add employees directly via Employee Management."
    )

@router.post("/clear-demo")
def clear_demo_records(admin=Depends(get_current_admin)):
    """Clears all demo employees, attendance records, and face embeddings"""
    res = clear_all_demo_data()
    return res

@router.get("/database-status")
def get_database_status(admin=Depends(get_current_admin)):
    mgr = get_db_manager()
    db = mgr.db
    status = mgr.get_connection_status()
    status["employeesCount"] = db.employees.count_documents({})
    status["attendanceRecordsCount"] = db.attendance.count_documents({})
    status["faceEmbeddingsCount"] = db.face_embeddings.count_documents({})
    return status

@router.post("/connect-mongodb")
def connect_mongodb_instance(req: MongoConnectRequest, admin=Depends(get_current_admin)):
    """Connects to live MongoDB or MongoDB Atlas instance and saves to .env"""
    mgr = get_db_manager()
    success, msg = mgr.connect(req.uri, req.dbName)
    
    if success:
        # Save to .env file
        try:
            env_path = os.path.join(settings.BASE_DIR, ".env")
            with open(env_path, "w", encoding="utf-8") as f:
                f.write(f"MONGODB_URI={req.uri}\nDB_NAME={req.dbName}\n")
        except Exception:
            pass
        return {"success": True, "message": f"Successfully connected to MongoDB ({req.dbName})!", "details": msg}
    else:
        return {"success": False, "message": "Failed to connect to provided MongoDB URI.", "details": msg}
