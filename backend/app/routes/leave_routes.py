import uuid
import logging
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from app.models.schemas import LeaveStatusUpdate, RegularizationStatusUpdate, LeaveActionRequest, RegularizationActionRequest
from app.database.connection import get_db, get_db_manager
from app.database.utils import query_by_id
from app.services.auth_service import get_current_admin
from app.attendance.logic import get_attendance_state_machine

logger = logging.getLogger("smartface.admin.leaves")

router = APIRouter(prefix="/admin", tags=["Admin Leaves & Regularization"])

def serialize_doc(doc: Dict[str, Any], id_alias: str = "leaveRequestId") -> Dict[str, Any]:
    """Helper to cleanly serialize MongoDB document with canonical IDs"""
    d = dict(doc)
    doc_id = str(d.get("_id", d.get("id", "")))
    d["id"] = doc_id
    d[id_alias] = doc_id
    if "_id" in d:
        d["_id"] = str(d["_id"])
    return d

def perform_leave_status_update(leave_id: str, status: str, admin_comment: Optional[str], admin: Dict[str, Any]):
    db = get_db()
    id_q = query_by_id(leave_id, ["leaveRequestId"])
    leave = db.leave_requests.find_one(id_q)
    if not leave:
        logger.warning(f"Leave request lookup failed for id '{leave_id}' with query {id_q}")
        raise HTTPException(status_code=404, detail="Leave request not found.")

    if status not in ["APPROVED", "REJECTED", "PENDING"]:
        raise HTTPException(status_code=400, detail="Status must be APPROVED, REJECTED, or PENDING.")

    now_iso = datetime.now().isoformat()
    admin_name = admin.get("name", "Admin")

    update_fields = {
        "status": status,
        "adminComment": admin_comment,
        "adminRemarks": admin_comment,
        "reviewedBy": admin_name,
        "reviewedAt": now_iso,
        "updatedAt": now_iso
    }
    if status == "APPROVED":
        update_fields["approvedBy"] = admin_name
        update_fields["approvedAt"] = now_iso
    elif status == "REJECTED":
        update_fields["rejectedBy"] = admin_name
        update_fields["rejectedAt"] = now_iso

    db.leave_requests.update_one(id_q, {"$set": update_fields})

    # If approved, also create ON LEAVE attendance records for dates if applicable
    if status == "APPROVED":
        try:
            d1 = datetime.strptime(leave["fromDate"], "%Y-%m-%d").date()
            d2 = datetime.strptime(leave["toDate"], "%Y-%m-%d").date()
            cur = d1
            while cur <= d2:
                cur_str = cur.isoformat()
                emp = db.employees.find_one({"employeeId": leave["employeeId"]})
                db.attendance.update_one(
                    {"employeeId": leave["employeeId"], "date": cur_str},
                    {"$set": {
                        "employeeId": leave["employeeId"],
                        "employeeName": emp.get("name", leave.get("employeeName")) if emp else leave.get("employeeName"),
                        "department": emp.get("department", leave.get("department")) if emp else leave.get("department"),
                        "date": cur_str,
                        "status": "ON LEAVE",
                        "workingDuration": "Leave",
                        "workingMinutes": 0,
                        "remarks": f"{leave.get('leaveType')}: {leave.get('reason')}",
                        "updatedAt": now_iso
                    }},
                    upsert=True
                )
                cur += timedelta(days=1)
        except Exception as e:
            logger.error(f"Error marking ON LEAVE attendance for leave {leave_id}: {e}")

    # Insert notification for employee
    try:
        db.notifications.insert_one({
            "id": f"notif_{uuid.uuid4().hex[:10]}",
            "employeeId": leave["employeeId"],
            "title": f"Leave Request {status.capitalize()}",
            "message": f"Your {leave.get('leaveType')} from {leave.get('fromDate')} to {leave.get('toDate')} was {status.lower()} by Admin." + (f" Note: {admin_comment}" if admin_comment else ""),
            "type": "LEAVE",
            "read": False,
            "createdAt": now_iso
        })
    except Exception as e:
        logger.error(f"Error creating notification for leave {leave_id}: {e}")

    get_db_manager().save_state()

    # Re-fetch updated doc
    updated_leave = db.leave_requests.find_one(id_q)
    clean_leave = serialize_doc(updated_leave if updated_leave else leave, "leaveRequestId")

    return {
        "success": True,
        "message": f"Leave request marked as {status}.",
        "status": status,
        "leave": clean_leave
    }


# ================= LEAVES MANAGEMENT (ADMIN) =================
@router.get("/leaves")
def get_all_leave_requests(
    status: Optional[str] = None,
    department: Optional[str] = None,
    admin=Depends(get_current_admin)
):
    db = get_db()
    query: Dict[str, Any] = {}
    if status and status != "All":
        query["status"] = status
    if department and department != "All":
        query["department"] = department

    leaves = list(db.leave_requests.find(query).sort("createdAt", -1))
    return [serialize_doc(l, "leaveRequestId") for l in leaves]


@router.put("/leaves/{leaveId}/status")
def update_leave_status(
    leaveId: str,
    req: LeaveStatusUpdate,
    admin=Depends(get_current_admin)
):
    comment = req.adminComment or req.adminRemarks
    return perform_leave_status_update(leaveId, req.status, comment, admin)


@router.patch("/leaves/{leaveId}/approve")
def approve_leave(
    leaveId: str,
    req: Optional[LeaveActionRequest] = None,
    admin=Depends(get_current_admin)
):
    comment = (req.adminRemarks or req.adminComment) if req else None
    return perform_leave_status_update(leaveId, "APPROVED", comment, admin)


@router.patch("/leaves/{leaveId}/reject")
def reject_leave(
    leaveId: str,
    req: Optional[LeaveActionRequest] = None,
    admin=Depends(get_current_admin)
):
    comment = (req.adminRemarks or req.adminComment) if req else None
    return perform_leave_status_update(leaveId, "REJECTED", comment, admin)


# ================= REGULARIZATION MANAGEMENT (ADMIN) =================
def perform_regularization_status_update(reg_id: str, status: str, admin_comment: Optional[str], admin: Dict[str, Any]):
    db = get_db()
    id_q = query_by_id(reg_id, ["regId", "regularizationId", "regRequestId"])
    reg = db.regularization_requests.find_one(id_q)
    if not reg:
        raise HTTPException(status_code=404, detail="Regularization request not found.")

    if status not in ["APPROVED", "REJECTED", "PENDING"]:
        raise HTTPException(status_code=400, detail="Status must be APPROVED, REJECTED, or PENDING.")

    now_iso = datetime.now().isoformat()
    admin_name = admin.get("name", "Admin")

    update_fields = {
        "status": status,
        "adminComment": admin_comment,
        "adminRemarks": admin_comment,
        "reviewedBy": admin_name,
        "reviewedAt": now_iso,
        "updatedAt": now_iso
    }
    if status == "APPROVED":
        update_fields["approvedBy"] = admin_name
        update_fields["approvedAt"] = now_iso
    elif status == "REJECTED":
        update_fields["rejectedBy"] = admin_name
        update_fields["rejectedAt"] = now_iso

    db.regularization_requests.update_one(id_q, {"$set": update_fields})

    # If APPROVED, update/create the employee's attendance record for that date
    if status == "APPROVED":
        emp = db.employees.find_one({"employeeId": reg["employeeId"]})
        shift = db.shifts.find_one({"id": emp.get("shiftId", "shift_general")}) if emp else None

        in_time = reg.get("requestedInTime", "10:30 AM")
        out_time = reg.get("requestedOutTime", "06:00 PM")
        
        sm = get_attendance_state_machine()
        in_dt = sm._parse_time_str(in_time)
        out_dt = sm._parse_time_str(out_time)
        
        working_mins = 0
        working_duration = "0h 0m"
        if in_dt and out_dt and out_dt > in_dt:
            working_mins = int((out_dt - in_dt).total_seconds() // 60)
            working_duration = f"{working_mins // 60}h {working_mins % 60}m"

        att_status = "FULL DAY"
        if shift and working_mins < shift.get("fullDayMinimumMinutes", 420):
            if working_mins >= shift.get("halfDayMinimumMinutes", 225):
                att_status = "HALF DAY"
            else:
                att_status = "ABSENT"

        db.attendance.update_one(
            {"employeeId": reg["employeeId"], "date": reg["date"]},
            {"$set": {
                "employeeId": reg["employeeId"],
                "employeeName": emp.get("name", reg.get("employeeName")) if emp else reg.get("employeeName"),
                "department": emp.get("department", reg.get("department")) if emp else reg.get("department"),
                "date": reg["date"],
                "inTime": in_time,
                "outTime": out_time,
                "workingMinutes": working_mins,
                "workingDuration": working_duration,
                "status": att_status,
                "remarks": f"Regularized by Admin: {reg.get('reason')}",
                "updatedAt": now_iso
            }},
            upsert=True
        )

    # Insert notification for employee
    try:
        db.notifications.insert_one({
            "id": f"notif_{uuid.uuid4().hex[:10]}",
            "employeeId": reg["employeeId"],
            "title": f"Attendance Correction {status.capitalize()}",
            "message": f"Your correction for {reg.get('date')} was {status.lower()} by Admin." + (f" Note: {admin_comment}" if admin_comment else ""),
            "type": "REGULARIZATION",
            "read": False,
            "createdAt": now_iso
        })
    except Exception as e:
        logger.error(f"Error creating notification for regularization {reg_id}: {e}")

    get_db_manager().save_state()

    updated_reg = db.regularization_requests.find_one(id_q)
    clean_reg = serialize_doc(updated_reg if updated_reg else reg, "regRequestId")

    return {
        "success": True,
        "message": f"Regularization request marked as {status}.",
        "status": status,
        "regularization": clean_reg
    }


@router.get("/regularization")
def get_all_regularization_requests(
    status: Optional[str] = None,
    admin=Depends(get_current_admin)
):
    db = get_db()
    query: Dict[str, Any] = {}
    if status and status != "All":
        query["status"] = status

    requests = list(db.regularization_requests.find(query).sort("createdAt", -1))
    return [serialize_doc(r, "regRequestId") for r in requests]


@router.put("/regularization/{regId}/status")
def update_regularization_status(
    regId: str,
    req: RegularizationStatusUpdate,
    admin=Depends(get_current_admin)
):
    comment = req.adminComment
    return perform_regularization_status_update(regId, req.status, comment, admin)


@router.patch("/regularization/{regId}/approve")
def approve_regularization(
    regId: str,
    req: Optional[RegularizationActionRequest] = None,
    admin=Depends(get_current_admin)
):
    comment = (req.adminRemarks or req.adminComment) if req else None
    return perform_regularization_status_update(regId, "APPROVED", comment, admin)


@router.patch("/regularization/{regId}/reject")
def reject_regularization(
    regId: str,
    req: Optional[RegularizationActionRequest] = None,
    admin=Depends(get_current_admin)
):
    comment = (req.adminRemarks or req.adminComment) if req else None
    return perform_regularization_status_update(regId, "REJECTED", comment, admin)


# ================= ANNOUNCEMENTS (ADMIN) =================
@router.post("/announcements")
def create_announcement(req: dict, admin=Depends(get_current_admin)):
    db = get_db()
    ann_id = f"ann_{uuid.uuid4().hex[:8]}"
    now_iso = datetime.now().isoformat()
    doc = {
        "id": ann_id,
        "title": req.get("title", "Company Notice"),
        "description": req.get("description", ""),
        "category": req.get("category", "General"),
        "date": req.get("date", date.today().isoformat()),
        "createdBy": admin.get("name", "HR Administration"),
        "createdAt": now_iso
    }
    db.announcements.insert_one(doc)
    get_db_manager().save_state()
    return {"message": "Announcement published successfully to all staff.", "announcement": doc}


@router.delete("/announcements/{annId}")
def delete_announcement(annId: str, admin=Depends(get_current_admin)):
    db = get_db()
    id_q = query_by_id(annId, ["annId", "announcementId"])
    res = db.announcements.delete_one(id_q)
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found.")
    get_db_manager().save_state()
    return {"message": "Announcement removed."}
