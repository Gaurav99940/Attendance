import os
import uuid
import base64
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Query
from app.models.schemas import EmployeeCreate, EmployeeUpdate, EmployeeResponse, FaceUploadResponse
from app.database.connection import get_db, get_db_manager
from app.services.auth_service import get_current_admin
from app.face_recognition.engine import get_face_engine
from app.services.seed_service import generate_avatar_image
from app.config.settings import settings

router = APIRouter(prefix="/employees", tags=["Employees"])

@router.get("", response_model=List[EmployeeResponse])
def get_employees(
    search: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    admin=Depends(get_current_admin)
):
    db = get_db()
    query = {}
    if department and department != "All":
        query["department"] = department
    if status and status != "All":
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"employeeId": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"designation": {"$regex": search, "$options": "i"}}
        ]

    employees = list(db.employees.find(query).sort("employeeId", 1))
    
    # Enrich with face counts
    results = []
    for emp in employees:
        emp_id = emp.get("employeeId")
        face_count = db.face_embeddings.count_documents({"employeeId": emp_id})
        res = EmployeeResponse(
            id=str(emp.get("_id", emp.get("id"))),
            employeeId=emp_id,
            name=emp.get("name"),
            department=emp.get("department"),
            designation=emp.get("designation"),
            email=emp.get("email"),
            mobile=emp.get("mobile"),
            shiftId=emp.get("shiftId", "shift_general"),
            joiningDate=emp.get("joiningDate"),
            status=emp.get("status", "Active"),
            profilePhoto=emp.get("profilePhoto"),
            faceCount=face_count,
            createdAt=emp.get("createdAt"),
            updatedAt=emp.get("updatedAt")
        )
        results.append(res)
    return results

@router.post("", response_model=EmployeeResponse)
def create_employee(req: EmployeeCreate, admin=Depends(get_current_admin)):
    db = get_db()
    # Check if employeeId or email already exists
    existing_id = db.employees.find_one({"employeeId": req.employeeId})
    if existing_id:
        raise HTTPException(status_code=400, detail=f"Employee ID '{req.employeeId}' already exists.")
    
    existing_email = db.employees.find_one({"email": req.email})
    if existing_email:
        raise HTTPException(status_code=400, detail=f"Email '{req.email}' is already registered.")

    profile_photo = req.profilePhoto
    if not profile_photo:
        profile_photo = generate_avatar_image(req.name, req.employeeId)

    raw_pwd = req.password or f"{req.employeeId}@123"
    from app.services.auth_service import hash_password
    pwd_hash = hash_password(raw_pwd)

    now_iso = datetime.now().isoformat()
    emp_doc = {
        "employeeId": req.employeeId,
        "name": req.name,
        "department": req.department,
        "designation": req.designation,
        "email": req.email,
        "mobile": req.mobile,
        "passwordHash": pwd_hash,
        "shiftId": req.shiftId or "shift_general",
        "joiningDate": req.joiningDate or date.today().isoformat(),
        "status": req.status or "Active",
        "profilePhoto": profile_photo,
        "createdAt": now_iso,
        "updatedAt": now_iso
    }
    
    result = db.employees.insert_one(emp_doc)
    get_db_manager().save_state()

    # Refresh recognition engine
    get_face_engine().load_embeddings_from_db(db)

    return EmployeeResponse(
        id=str(result.inserted_id),
        **emp_doc,
        faceCount=0
    )

@router.post("/{employeeId}/reset-password")
def reset_employee_password(employeeId: str, req: dict, admin=Depends(get_current_admin)):
    db = get_db()
    emp = db.employees.find_one({"employeeId": employeeId})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")
    
    new_pwd = str(req.get("newPassword", f"{employeeId}@123")).strip()
    from app.services.auth_service import hash_password
    pwd_hash = hash_password(new_pwd)
    
    db.employees.update_one({"employeeId": employeeId}, {"$set": {"passwordHash": pwd_hash, "updatedAt": datetime.now().isoformat()}})
    get_db_manager().save_state()
    return {"message": f"Password for {emp.get('name')} ({employeeId}) has been reset successfully."}


@router.get("/{employeeId}")
def get_employee_detail(employeeId: str, admin=Depends(get_current_admin)):
    db = get_db()
    emp = db.employees.find_one({"employeeId": employeeId})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Fetch registered faces
    faces = list(db.face_embeddings.find({"employeeId": employeeId}))
    face_list = []
    for f in faces:
        face_list.append({
            "id": str(f.get("_id", f.get("id"))),
            "imagePath": f.get("imagePath"),
            "angleLabel": f.get("angleLabel", "front"),
            "createdAt": f.get("createdAt")
        })

    # Fetch attendance summary statistics (last 30 days)
    today = date.today()
    start_date = (today - timedelta(days=30)).isoformat()
    attendance_records = list(db.attendance.find({
        "employeeId": employeeId,
        "date": {"$gte": start_date}
    }).sort("date", -1))

    total_days = len(attendance_records)
    present_days = 0
    full_days = 0
    half_days = 0
    absent_days = 0
    late_days = 0
    leave_days = 0
    total_minutes = 0

    for att in attendance_records:
        st = att.get("status")
        if st in ["FULL DAY", "PRESENT"]:
            present_days += 1
            full_days += 1
        elif st == "HALF DAY":
            present_days += 1
            half_days += 1
        elif st == "LATE":
            present_days += 1
            late_days += 1
            full_days += 1
        elif st == "ON LEAVE":
            leave_days += 1
        elif st == "ABSENT":
            absent_days += 1
        elif st == "INCOMPLETE":
            present_days += 1

        total_minutes += att.get("workingMinutes", 0)

    working_days_count = max(1, full_days + half_days + late_days + absent_days)
    attendance_pct = round((present_days / working_days_count) * 100.0, 1)
    avg_minutes = total_minutes // max(1, (full_days + half_days + late_days)) if (full_days + half_days + late_days) > 0 else 0
    avg_hours_str = f"{avg_minutes // 60}h {avg_minutes % 60}m"

    # Shift info
    shift_doc = db.shifts.find_one({"id": emp.get("shiftId", "shift_general")})
    shift_clean = None
    if shift_doc:
        shift_clean = dict(shift_doc)
        if "_id" in shift_clean:
            del shift_clean["_id"]

    clean_att_records = []
    for att in attendance_records[:15]:
        d = dict(att)
        d["id"] = str(d.get("_id", d.get("id", "")))
        if "_id" in d:
            del d["_id"]
        clean_att_records.append(d)

    return {
        "employee": {
            "id": str(emp.get("_id", emp.get("id"))),
            "employeeId": emp.get("employeeId"),
            "name": emp.get("name"),
            "department": emp.get("department"),
            "designation": emp.get("designation"),
            "email": emp.get("email"),
            "mobile": emp.get("mobile"),
            "shiftId": emp.get("shiftId"),
            "shift": shift_clean,
            "joiningDate": emp.get("joiningDate"),
            "status": emp.get("status", "Active"),
            "profilePhoto": emp.get("profilePhoto"),
            "createdAt": emp.get("createdAt")
        },
        "faces": face_list,
        "summary": {
            "totalRecordedDays": total_days,
            "workingDays": working_days_count,
            "presentDays": present_days,
            "fullDays": full_days,
            "halfDays": half_days,
            "absentDays": absent_days,
            "lateDays": late_days,
            "leaveDays": leave_days,
            "attendancePercentage": attendance_pct,
            "averageWorkingHours": avg_hours_str,
            "totalWorkingMinutes": total_minutes
        },
        "recentAttendance": clean_att_records
    }

@router.put("/{employeeId}")
def update_employee(employeeId: str, req: EmployeeUpdate, admin=Depends(get_current_admin)):
    db = get_db()
    emp = db.employees.find_one({"employeeId": employeeId})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    update_fields = {}
    for k, v in req.dict(exclude_unset=True).items():
        if v is not None:
            update_fields[k] = v

    update_fields["updatedAt"] = datetime.now().isoformat()
    db.employees.update_one({"employeeId": employeeId}, {"$set": update_fields})
    get_db_manager().save_state()

    get_face_engine().load_embeddings_from_db(db)
    return {"message": "Employee updated successfully", "employeeId": employeeId}

@router.delete("/{employeeId}")
def delete_employee(employeeId: str, admin=Depends(get_current_admin)):
    db = get_db()
    emp = db.employees.find_one({"employeeId": employeeId})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    db.employees.delete_one({"employeeId": employeeId})
    db.face_embeddings.delete_many({"employeeId": employeeId})
    get_db_manager().save_state()

    get_face_engine().load_embeddings_from_db(db)
    return {"message": f"Employee {employeeId} and all biometric embeddings deleted successfully."}

@router.post("/{employeeId}/faces", response_model=FaceUploadResponse)
async def upload_employee_faces(
    employeeId: str,
    files: List[UploadFile] = File(None),
    base64Images: Optional[str] = Form(None),
    angleLabels: Optional[str] = Form(None),
    admin=Depends(get_current_admin)
):
    """
    Registers face images for an employee:
    - Accepts standard multipart files OR base64 camera snapshots
    - Detects face with OpenCV/MTCNN
    - Extracts 512-D normalized FaceNet embedding
    - Stores in MongoDB face_embeddings
    - Refreshes Face Recognition Engine cache
    """
    db = get_db()
    emp = db.employees.find_one({"employeeId": employeeId})
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee '{employeeId}' not found.")

    engine = get_face_engine()
    registered_count = 0
    errors = []

    # 1. Process Multipart File Uploads
    if files:
        for file in files:
            content = await file.read()
            if not content:
                continue
            
            success, embedding, err_msg, bbox = engine.process_image_for_registration(content)
            if not success or embedding is None:
                errors.append(f"{file.filename}: {err_msg}")
                continue

            # Save uploaded image to disk
            ext = os.path.splitext(file.filename)[1] or ".jpg"
            saved_filename = f"face_{employeeId}_{uuid.uuid4().hex[:8]}{ext}"
            saved_path = os.path.join(settings.UPLOAD_DIR, "faces", saved_filename)
            with open(saved_path, "wb") as f:
                f.write(content)

            url_path = f"/uploads/faces/{saved_filename}"

            # If employee has no custom profilePhoto, set this as primary
            if not emp.get("profilePhoto") or "/uploads/avatars/" in emp.get("profilePhoto", ""):
                db.employees.update_one({"employeeId": employeeId}, {"$set": {"profilePhoto": url_path}})

            # Insert into face_embeddings collection
            emb_doc = {
                "id": f"emb_{uuid.uuid4().hex[:12]}",
                "employeeId": employeeId,
                "embedding": embedding.tolist(),
                "imagePath": url_path,
                "angleLabel": "uploaded_photo",
                "createdAt": datetime.now().isoformat()
            }
            db.face_embeddings.insert_one(emb_doc)
            registered_count += 1

    # 2. Process Base64 Camera Captures
    if base64Images:
        try:
            import json
            images_list = json.loads(base64Images) if isinstance(base64Images, str) and base64Images.startswith("[") else [base64Images]
            angles = json.loads(angleLabels) if angleLabels and angleLabels.startswith("[") else ["front"] * len(images_list)
            
            for idx, b64_img in enumerate(images_list):
                if "," in b64_img:
                    b64_img = b64_img.split(",")[1]
                img_bytes = base64.b64decode(b64_img)
                
                success, embedding, err_msg, bbox = engine.process_image_for_registration(img_bytes)
                if not success or embedding is None:
                    errors.append(f"Camera frame {idx+1}: {err_msg}")
                    continue

                angle = angles[idx] if idx < len(angles) else "front"
                saved_filename = f"face_{employeeId}_{angle}_{uuid.uuid4().hex[:8]}.jpg"
                saved_path = os.path.join(settings.UPLOAD_DIR, "faces", saved_filename)
                with open(saved_path, "wb") as f:
                    f.write(img_bytes)

                url_path = f"/uploads/faces/{saved_filename}"

                emb_doc = {
                    "id": f"emb_{uuid.uuid4().hex[:12]}",
                    "employeeId": employeeId,
                    "embedding": embedding.tolist(),
                    "imagePath": url_path,
                    "angleLabel": angle,
                    "createdAt": datetime.now().isoformat()
                }
                db.face_embeddings.insert_one(emb_doc)
                registered_count += 1
        except Exception as e:
            errors.append(f"Base64 parse error: {str(e)}")

    # Update database state & reload cache
    get_db_manager().save_state()
    engine.load_embeddings_from_db(db)

    # Update employee face count
    total_faces = db.face_embeddings.count_documents({"employeeId": employeeId})
    db.employees.update_one({"employeeId": employeeId}, {"$set": {"faceCount": total_faces}})

    if registered_count == 0 and errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    msg = f"Successfully registered {registered_count} face biometric embedding(s)."
    if errors:
        msg += f" Note: {'; '.join(errors)}"

    return FaceUploadResponse(
        success=True,
        message=msg,
        faces_registered=registered_count,
        employeeId=employeeId
    )

@router.delete("/{employeeId}/faces/{faceId}")
def delete_face_embedding(employeeId: str, faceId: str, admin=Depends(get_current_admin)):
    db = get_db()
    res = db.face_embeddings.delete_one({"$or": [{"id": faceId}, {"_id": faceId}], "employeeId": employeeId})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Face embedding not found.")
    
    get_db_manager().save_state()
    get_face_engine().load_embeddings_from_db(db)
    
    total_faces = db.face_embeddings.count_documents({"employeeId": employeeId})
    db.employees.update_one({"employeeId": employeeId}, {"$set": {"faceCount": total_faces}})
    
    return {"message": "Face embedding removed successfully."}
