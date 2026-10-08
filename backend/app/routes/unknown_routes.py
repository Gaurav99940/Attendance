from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.database.connection import get_db, get_db_manager
from app.database.utils import query_by_id
from app.services.auth_service import get_current_admin
from app.face_recognition.engine import get_face_engine
import os
import uuid
from datetime import datetime
from app.config.settings import settings

router = APIRouter(prefix="/unknown", tags=["Unknown Detections"])

@router.get("")
def get_unknown_detections(admin=Depends(get_current_admin)):
    db = get_db()
    detections = list(db.unknown_detections.find({}).sort("detectedAt", -1).limit(100))
    results = []
    for d in detections:
        doc = dict(d)
        doc_id = str(doc.get("_id", doc.get("id", "")))
        doc["id"] = doc_id
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])
        results.append(doc)
    return results

@router.delete("/{id}")
def dismiss_unknown_detection(id: str, admin=Depends(get_current_admin)):
    db = get_db()
    id_q = query_by_id(id)
    res = db.unknown_detections.delete_one(id_q)
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Unknown detection not found.")
    get_db_manager().save_state()
    return {"message": "Unknown detection dismissed."}

@router.post("/{id}/assign/{employeeId}")
def assign_unknown_to_employee(id: str, employeeId: str, admin=Depends(get_current_admin)):
    """Assigns an unknown captured face to an existing employee and generates biometric embedding"""
    db = get_db()
    id_q = query_by_id(id)
    unk = db.unknown_detections.find_one(id_q)
    if not unk:
        raise HTTPException(status_code=404, detail="Unknown detection record not found.")

    emp = db.employees.find_one({"employeeId": employeeId})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")

    img_rel_path = unk.get("capturedImage", "")
    full_path = os.path.join(settings.BASE_DIR, img_rel_path.lstrip("/"))

    if os.path.exists(full_path):
        with open(full_path, "rb") as f:
            content = f.read()
        
        engine = get_face_engine()
        success, embedding, err, bbox = engine.process_image_for_registration(content)
        if success and embedding is not None:
            emb_doc = {
                "id": f"emb_{uuid.uuid4().hex[:12]}",
                "employeeId": employeeId,
                "embedding": embedding.tolist(),
                "imagePath": img_rel_path,
                "angleLabel": "assigned_capture",
                "createdAt": datetime.now().isoformat()
            }
            db.face_embeddings.insert_one(emb_doc)
            engine.load_embeddings_from_db(db)

    # Remove from unknown
    db.unknown_detections.delete_one(id_q)
    get_db_manager().save_state()

    return {"message": f"Assigned detection to {emp.get('name')} ({employeeId}) and registered face embedding."}
