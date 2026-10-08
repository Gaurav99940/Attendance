import uuid
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from app.models.schemas import AttendanceRecord, ManualAttendanceRequest
from app.database.connection import get_db, get_db_manager
from app.database.utils import query_by_id
from app.services.auth_service import get_current_admin
from app.attendance.logic import get_attendance_state_machine

router = APIRouter(prefix="/attendance", tags=["Attendance"])

def format_attendance_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures consistent multi-session fields and serializes MongoDB _id"""
    d = dict(doc)
    doc_id = str(d.get("_id", d.get("id", "")))
    d["id"] = doc_id
    if "_id" in d:
        d["_id"] = str(d["_id"])

    # Provide fallback / standard multi-session fields
    sessions = d.get("sessions") or []
    timeline = d.get("timeline") or []
    in_t = d.get("inTime")
    out_t = d.get("outTime")

    if not sessions and in_t:
        sessions = [{
            "sessionId": f"sess_{doc_id[:8]}",
            "sessionIndex": 1,
            "inTime": in_t,
            "outTime": out_t,
            "durationMinutes": d.get("workingMinutes", 0),
            "durationStr": d.get("workingDuration") or f"{d.get('workingMinutes', 0) // 60}h {d.get('workingMinutes', 0) % 60}m",
            "inVerificationImage": d.get("verificationImage"),
            "outVerificationImage": d.get("outVerificationImage"),
            "status": "COMPLETED" if out_t else "ACTIVE"
        }]

    if not timeline and in_t:
        timeline.append({
            "time": in_t,
            "type": "IN",
            "sessionIndex": 1,
            "sessionId": sessions[0]["sessionId"] if sessions else "sess_1",
            "image": d.get("verificationImage"),
            "remarks": "Check-in"
        })
        if out_t:
            timeline.append({
                "time": out_t,
                "type": "OUT",
                "sessionIndex": 1,
                "sessionId": sessions[0]["sessionId"] if sessions else "sess_1",
                "image": d.get("outVerificationImage"),
                "remarks": "Check-out"
            })

    d["sessions"] = sessions
    d["timeline"] = timeline
    d["firstIn"] = d.get("firstIn") or (sessions[0].get("inTime") if sessions else in_t)
    d["lastOut"] = d.get("lastOut") or (sessions[-1].get("outTime") if (sessions and sessions[-1].get("outTime")) else out_t)
    d["totalSessions"] = len(sessions)
    d["completedSessions"] = sum(1 for s in sessions if s.get("status") == "COMPLETED" and s.get("outTime"))
    d["totalWorkingMinutes"] = d.get("totalWorkingMinutes", d.get("workingMinutes", 0))
    d["workingDuration"] = d.get("workingDuration") or f"{d['totalWorkingMinutes'] // 60}h {d['totalWorkingMinutes'] % 60}m"
    d["totalOutsideMinutes"] = d.get("totalOutsideMinutes", 0)
    d["totalOutsideHours"] = d.get("totalOutsideHours") or f"{d['totalOutsideMinutes'] // 60}h {d['totalOutsideMinutes'] % 60}m"
    
    # Evaluate current live status
    if sessions and (sessions[-1].get("outTime") is None or sessions[-1].get("status") == "ACTIVE"):
        d["currentStatus"] = "INSIDE"
        d["isInside"] = True
    elif sessions:
        d["currentStatus"] = "OUTSIDE"
        d["isInside"] = False
    else:
        d["currentStatus"] = "NOT CHECKED IN"
        d["isInside"] = False

    return d


@router.get("")
def get_attendance_history(
    date: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    employeeId: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 50,
    admin=Depends(get_current_admin)
):
    db = get_db()
    query: Dict[str, Any] = {}

    if isinstance(date, str) and date and date != "All":
        query["date"] = date
    elif isinstance(startDate, str) and isinstance(endDate, str) and startDate and endDate:
        query["date"] = {"$gte": startDate, "$lte": endDate}
    elif isinstance(startDate, str) and startDate:
        query["date"] = {"$gte": startDate}
    elif isinstance(endDate, str) and endDate:
        query["date"] = {"$lte": endDate}

    if employeeId and employeeId != "All":
        query["employeeId"] = employeeId

    if department and department != "All":
        query["department"] = department

    if status and status != "All":
        query["status"] = status

    if search:
        query["$or"] = [
            {"employeeName": {"$regex": search, "$options": "i"}},
            {"employeeId": {"$regex": search, "$options": "i"}},
            {"department": {"$regex": search, "$options": "i"}},
            {"remarks": {"$regex": search, "$options": "i"}}
        ]

    total_records = db.attendance.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.attendance.find(query).sort([("date", -1), ("inTime", -1)]).skip(skip).limit(limit)

    records = [format_attendance_doc(doc) for doc in cursor]

    return {
        "total": total_records,
        "page": page,
        "limit": limit,
        "totalPages": (total_records + limit - 1) // limit if limit > 0 else 1,
        "records": records
    }


@router.get("/today")
def get_today_attendance(admin=Depends(get_current_admin)):
    db = get_db()
    today_str = date.today().isoformat()
    cursor = db.attendance.find({"date": today_str}).sort([("inTime", -1)])
    return [format_attendance_doc(doc) for doc in cursor]


@router.get("/employee/{employeeId}")
def get_employee_attendance(
    employeeId: str,
    month: Optional[str] = None,  # YYYY-MM
    admin=Depends(get_current_admin)
):
    db = get_db()
    query: Dict[str, Any] = {"employeeId": employeeId}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    
    cursor = db.attendance.find(query).sort("date", -1)
    return [format_attendance_doc(doc) for doc in cursor]


@router.get("/employee/{employeeId}/date/{target_date}")
def get_employee_attendance_by_date(
    employeeId: str,
    target_date: str,
    admin=Depends(get_current_admin)
):
    """Fetches detailed day movement and session breakdown for a specific employee and date"""
    db = get_db()
    emp = db.employees.find_one({"employeeId": employeeId})
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee '{employeeId}' not found.")

    shift = db.shifts.find_one({"id": emp.get("shiftId", "shift_general")})
    rec = db.attendance.find_one({"employeeId": employeeId, "date": target_date})

    if not rec:
        return {
            "employeeId": employeeId,
            "employeeName": emp.get("name"),
            "department": emp.get("department"),
            "date": target_date,
            "shift": shift.get("name", "General Day Shift") if shift else "General Day Shift",
            "expectedIn": shift.get("startTime", "10:30 AM") if shift else "10:30 AM",
            "expectedOut": shift.get("endTime", "06:00 PM") if shift else "06:00 PM",
            "firstIn": None,
            "lastOut": None,
            "totalSessions": 0,
            "completedSessions": 0,
            "totalWorkingMinutes": 0,
            "workingDuration": "0h 0m",
            "totalOutsideMinutes": 0,
            "totalOutsideHours": "0h 0m",
            "currentStatus": "NOT CHECKED IN",
            "status": "NO RECORD",
            "sessions": [],
            "timeline": []
        }

    return format_attendance_doc(rec)


@router.get("/details/{recordId}")
def get_attendance_details_by_id(recordId: str, admin=Depends(get_current_admin)):
    """Fetches complete session timeline and audit for a specific attendance record"""
    db = get_db()
    id_q = query_by_id(recordId)
    rec = db.attendance.find_one(id_q)
    if not rec:
        raise HTTPException(status_code=404, detail="Attendance record not found.")
    return format_attendance_doc(rec)


@router.get("/calendar")
def get_company_attendance_calendar(
    month: Optional[str] = None,  # YYYY-MM
    employeeId: Optional[str] = None,
    department: Optional[str] = None,
    admin=Depends(get_current_admin)
):
    """Aggregates attendance metrics per day for calendar view"""
    db = get_db()
    target_month = month or date.today().strftime("%Y-%m")
    
    query: Dict[str, Any] = {"date": {"$regex": f"^{target_month}"}}
    if employeeId and employeeId != "All":
        query["employeeId"] = employeeId
    if department and department != "All":
        query["department"] = department

    records = list(db.attendance.find(query))
    
    # Group by date
    days_data: Dict[str, Dict[str, Any]] = {}
    for rec in records:
        d = rec.get("date")
        if not d:
            continue
        if d not in days_data:
            days_data[d] = {
                "date": d,
                "total": 0,
                "fullDay": 0,
                "halfDay": 0,
                "late": 0,
                "absent": 0,
                "onLeave": 0,
                "weekend": 0,
                "incomplete": 0,
                "records": []
            }
        
        st = rec.get("status")
        days_data[d]["total"] += 1
        if st == "FULL DAY":
            days_data[d]["fullDay"] += 1
        elif st == "HALF DAY":
            days_data[d]["halfDay"] += 1
        elif st == "LATE":
            days_data[d]["late"] += 1
            days_data[d]["fullDay"] += 1
        elif st == "ABSENT":
            days_data[d]["absent"] += 1
        elif st == "ON LEAVE":
            days_data[d]["onLeave"] += 1
        elif st == "WEEKEND":
            days_data[d]["weekend"] += 1
        elif st == "INCOMPLETE":
            days_data[d]["incomplete"] += 1

        rec_clean = format_attendance_doc(rec)
        days_data[d]["records"].append(rec_clean)

    return {
        "month": target_month,
        "days": sorted(list(days_data.values()), key=lambda x: x["date"])
    }


@router.post("/manual")
def manual_attendance_override(req: ManualAttendanceRequest, admin=Depends(get_current_admin)):
    """Admin manual punch override with multi-session support and audit logging"""
    db = get_db()
    emp = db.employees.find_one({"employeeId": req.employeeId})
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee '{req.employeeId}' not found.")

    shift = db.shifts.find_one({"id": emp.get("shiftId", "shift_general")}) or {
        "startTime": "10:30 AM",
        "endTime": "06:00 PM",
        "fullDayMinimumMinutes": 420,
        "halfDayMinimumMinutes": 225
    }

    sm = get_attendance_state_machine()
    now_iso = datetime.now().isoformat()

    # Build sessions
    sessions: List[Dict[str, Any]] = req.sessions or []
    timeline: List[Dict[str, Any]] = []

    if not sessions and req.inTime:
        sess_dur = 0
        if req.inTime and req.outTime:
            dt_in = sm._parse_time_str(req.inTime)
            dt_out = sm._parse_time_str(req.outTime)
            if dt_in and dt_out and dt_out >= dt_in:
                sess_dur = int((dt_out - dt_in).total_seconds() // 60)

        sessions = [{
            "sessionId": f"sess_{uuid.uuid4().hex[:8]}",
            "sessionIndex": 1,
            "inTime": req.inTime,
            "outTime": req.outTime,
            "durationMinutes": sess_dur,
            "durationStr": f"{sess_dur // 60}h {sess_dur % 60}m",
            "inVerificationImage": None,
            "outVerificationImage": None,
            "status": "COMPLETED" if req.outTime else "ACTIVE"
        }]

    # Reconstruct timeline from sessions
    for s in sessions:
        if s.get("inTime"):
            timeline.append({
                "time": s["inTime"],
                "type": "IN",
                "sessionIndex": s.get("sessionIndex", 1),
                "sessionId": s.get("sessionId"),
                "remarks": "Manual Entry (IN)"
            })
        if s.get("outTime"):
            timeline.append({
                "time": s["outTime"],
                "type": "OUT",
                "sessionIndex": s.get("sessionIndex", 1),
                "sessionId": s.get("sessionId"),
                "remarks": "Manual Entry (OUT)"
            })

    metrics = sm.calculate_session_metrics(sessions, shift, sm._parse_time_str(req.date).date() if sm._parse_time_str(req.date) else date.today())
    final_status = req.status or metrics["status"]

    doc = {
        "employeeId": req.employeeId,
        "employeeName": emp.get("name"),
        "department": emp.get("department"),
        "date": req.date,
        "shiftId": emp.get("shiftId", "shift_general"),
        "firstIn": metrics["firstIn"],
        "inTime": metrics["firstIn"],
        "lastOut": metrics["lastOut"],
        "outTime": metrics["lastOut"],
        "currentStatus": "OUTSIDE" if metrics["lastOut"] else ("INSIDE" if metrics["firstIn"] else "NOT CHECKED IN"),
        "totalSessions": metrics["totalSessions"],
        "completedSessions": metrics["completedSessions"],
        "totalWorkingMinutes": metrics["totalWorkingMinutes"],
        "workingMinutes": metrics["workingMinutes"],
        "workingDuration": metrics["workingDuration"],
        "totalOutsideMinutes": metrics["totalOutsideMinutes"],
        "totalOutsideHours": metrics["totalOutsideHours"],
        "expectedIn": shift.get("startTime", "10:30 AM"),
        "expectedOut": shift.get("endTime", "06:00 PM"),
        "lateBy": 0,
        "earlyExitBy": 0,
        "status": final_status,
        "sessions": sessions,
        "timeline": timeline,
        "remarks": f"Admin Manual Entry: {req.remarks or 'Manual adjustment'}",
        "updatedAt": now_iso
    }

    db.attendance.update_one(
        {"employeeId": req.employeeId, "date": req.date},
        {"$set": doc},
        upsert=True
    )
    get_db_manager().save_state()

    # Log audit
    db.audit_logs.insert_one({
        "id": f"aud_{uuid.uuid4().hex[:10]}",
        "action": "MANUAL_ATTENDANCE_OVERRIDE",
        "performedBy": admin.get("name", "Admin"),
        "entityType": "Attendance",
        "entityId": req.employeeId,
        "details": {"date": req.date, "status": final_status, "totalSessions": len(sessions), "workingDuration": metrics["workingDuration"]},
        "timestamp": now_iso
    })

    return {"message": "Attendance record created/updated successfully with session breakdown.", "attendance": format_attendance_doc(doc)}


@router.delete("/{id}")
def delete_attendance_record(id: str, admin=Depends(get_current_admin)):
    db = get_db()
    id_q = query_by_id(id)
    res = db.attendance.delete_one(id_q)
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Attendance record not found.")
    get_db_manager().save_state()
    return {"message": "Attendance record deleted."}
