import io
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Response, Query
from fastapi.responses import StreamingResponse
from app.database.connection import get_db
from app.services.auth_service import get_current_admin

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("")
def generate_reports(
    reportType: str = Query("daily", pattern="^(daily|weekly|monthly|employee|department|late|absent|working_hours)$"),
    date_val: Optional[str] = Query(None, alias="date"),
    month: Optional[str] = None, # YYYY-MM
    department: Optional[str] = None,
    employeeId: Optional[str] = None,
    admin=Depends(get_current_admin)
):
    """Generates comprehensive aggregated analytics reports based on criteria"""
    db = get_db()
    today = date.today()
    target_date = date_val or today.isoformat()
    target_month = month or today.strftime("%Y-%m")

    query: Dict[str, Any] = {}

    if reportType == "daily":
        query["date"] = target_date
    elif reportType == "weekly":
        start_w = (today - timedelta(days=7)).isoformat()
        query["date"] = {"$gte": start_w, "$lte": today.isoformat()}
    elif reportType in ["monthly", "employee", "department", "late", "absent", "working_hours"]:
        query["date"] = {"$regex": f"^{target_month}"}

    if department and department != "All":
        query["department"] = department

    if employeeId and employeeId != "All":
        query["employeeId"] = employeeId

    if reportType == "late":
        query["$or"] = [{"status": "LATE"}, {"lateBy": {"$gt": 0}}]
    elif reportType == "absent":
        query["status"] = "ABSENT"

    records = list(db.attendance.find(query).sort("date", -1))
    
    # Process & format results
    total_records = len(records)
    total_minutes = sum(r.get("workingMinutes", 0) for r in records)
    late_count = sum(1 for r in records if r.get("status") == "LATE" or r.get("lateBy", 0) > 0)
    full_day_count = sum(1 for r in records if r.get("status") == "FULL DAY")
    half_day_count = sum(1 for r in records if r.get("status") == "HALF DAY")
    absent_count = sum(1 for r in records if r.get("status") == "ABSENT")
    leave_count = sum(1 for r in records if r.get("status") == "ON LEAVE")

    clean_records = []
    for r in records:
        d = dict(r)
        d["id"] = str(d.get("_id", d.get("id", "")))
        if "_id" in d:
            del d["_id"]
        clean_records.append(d)

    return {
        "reportType": reportType,
        "filters": {
            "date": target_date,
            "month": target_month,
            "department": department,
            "employeeId": employeeId
        },
        "summary": {
            "totalEntries": total_records,
            "totalWorkingHours": f"{total_minutes // 60}h {total_minutes % 60}m",
            "totalWorkingMinutes": total_minutes,
            "fullDays": full_day_count,
            "halfDays": half_day_count,
            "lateArrivals": late_count,
            "absentCount": absent_count,
            "leaveCount": leave_count
        },
        "records": clean_records
    }

@router.get("/export/csv")
def export_report_csv(
    reportType: str = "monthly",
    month: Optional[str] = None,
    department: Optional[str] = None,
    employeeId: Optional[str] = None,
    admin=Depends(get_current_admin)
):
    db = get_db()
    target_month = month or date.today().strftime("%Y-%m")
    query: Dict[str, Any] = {"date": {"$regex": f"^{target_month}"}}
    if department and department != "All":
        query["department"] = department
    if employeeId and employeeId != "All":
        query["employeeId"] = employeeId

    records = list(db.attendance.find(query).sort("date", -1))
    
    data = []
    for r in records:
        sessions = r.get("sessions") or []
        first_in = r.get("firstIn") or (sessions[0].get("inTime") if sessions else r.get("inTime", "--"))
        last_out = r.get("lastOut") or (sessions[-1].get("outTime") if (sessions and sessions[-1].get("outTime")) else r.get("outTime", "--"))
        total_sessions = len(sessions) if sessions else (1 if r.get("inTime") else 0)
        tot_work_mins = r.get("totalWorkingMinutes", r.get("workingMinutes", 0))
        tot_out_mins = r.get("totalOutsideMinutes", 0)

        data.append({
            "Employee ID": r.get("employeeId"),
            "Employee Name": r.get("employeeName"),
            "Department": r.get("department"),
            "Date": r.get("date"),
            "First IN": first_in or "--",
            "Last OUT": last_out or "--",
            "Total Sessions": total_sessions,
            "Total Working Hours": r.get("workingDuration") or f"{tot_work_mins // 60}h {tot_work_mins % 60}m",
            "Total Outside Time": r.get("totalOutsideHours") or f"{tot_out_mins // 60}h {tot_out_mins % 60}m",
            "Late By (Mins)": r.get("lateBy", 0),
            "Early Exit (Mins)": r.get("earlyExitBy", 0),
            "Status": r.get("status"),
            "Remarks": r.get("remarks", "")
        })

    df = pd.DataFrame(data)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    response = Response(content=stream.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=attendance_report_{target_month}.csv"
    return response

@router.get("/export/excel")
def export_report_excel(
    month: Optional[str] = None,
    department: Optional[str] = None,
    employeeId: Optional[str] = None,
    admin=Depends(get_current_admin)
):
    db = get_db()
    target_month = month or date.today().strftime("%Y-%m")
    query: Dict[str, Any] = {"date": {"$regex": f"^{target_month}"}}
    if department and department != "All":
        query["department"] = department
    if employeeId and employeeId != "All":
        query["employeeId"] = employeeId

    records = list(db.attendance.find(query).sort("date", -1))
    
    data = []
    for r in records:
        sessions = r.get("sessions") or []
        first_in = r.get("firstIn") or (sessions[0].get("inTime") if sessions else r.get("inTime", "--"))
        last_out = r.get("lastOut") or (sessions[-1].get("outTime") if (sessions and sessions[-1].get("outTime")) else r.get("outTime", "--"))
        total_sessions = len(sessions) if sessions else (1 if r.get("inTime") else 0)
        tot_work_mins = r.get("totalWorkingMinutes", r.get("workingMinutes", 0))
        tot_out_mins = r.get("totalOutsideMinutes", 0)

        data.append({
            "Employee ID": r.get("employeeId"),
            "Employee Name": r.get("employeeName"),
            "Department": r.get("department"),
            "Date": r.get("date"),
            "First IN": first_in or "--",
            "Last OUT": last_out or "--",
            "Total Sessions": total_sessions,
            "Total Working Hours": r.get("workingDuration") or f"{tot_work_mins // 60}h {tot_work_mins % 60}m",
            "Total Outside Time": r.get("totalOutsideHours") or f"{tot_out_mins // 60}h {tot_out_mins % 60}m",
            "Late By (Mins)": r.get("lateBy", 0),
            "Early Exit (Mins)": r.get("earlyExitBy", 0),
            "Status": r.get("status"),
            "Remarks": r.get("remarks", "")
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name="Attendance Summary", index=False)
    
    output.seek(0)
    headers = {
        "Content-Disposition": f"attachment; filename=attendance_report_{target_month}.xlsx"
    }
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
