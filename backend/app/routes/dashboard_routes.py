from datetime import datetime, date, timedelta
from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from app.database.connection import get_db
from app.services.auth_service import get_current_admin

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(admin=Depends(get_current_admin)):
    """Computes real-time live statistics for the Admin Dashboard"""
    db = get_db()
    today_str = date.today().isoformat()

    # 1. Total Active Employees
    total_employees = db.employees.count_documents({"status": "Active"})

    # 2. Today's Attendance Records
    today_records = list(db.attendance.find({"date": today_str}))

    present_today = 0
    absent_today = 0
    late_today = 0
    currently_inside = 0
    half_day_today = 0
    on_leave_today = 0
    total_working_minutes = 0

    checked_in_ids = set()

    for att in today_records:
        emp_id = att.get("employeeId")
        st = att.get("status")
        in_t = att.get("inTime")
        out_t = att.get("outTime")
        sessions = att.get("sessions") or []
        is_inside = (att.get("currentStatus") == "INSIDE") or (len(sessions) > 0 and (sessions[-1].get("outTime") is None or sessions[-1].get("status") == "ACTIVE")) or (bool(in_t) and not bool(out_t))

        if in_t or sessions:
            checked_in_ids.add(emp_id)
            present_today += 1

            if is_inside:
                currently_inside += 1

        if st == "LATE" or att.get("lateBy", 0) > 0:
            late_today += 1

        if st == "HALF DAY":
            half_day_today += 1

        if st == "ON LEAVE":
            on_leave_today += 1

        if st == "ABSENT":
            absent_today += 1

        total_working_minutes += att.get("totalWorkingMinutes", att.get("workingMinutes", 0))

    # Employees with no record today are considered not yet checked in / absent
    unreported = max(0, total_employees - len(checked_in_ids) - on_leave_today)
    if absent_today == 0:
        absent_today = unreported

    total_hours_formatted = f"{total_working_minutes // 60}h {total_working_minutes % 60}m"

    # 3. Recent Attendance Activity Stream (latest 10 events)
    recent_activity = []
    sorted_records = sorted(
        today_records,
        key=lambda x: x.get("updatedAt") or x.get("createdAt") or "",
        reverse=True
    )

    for rec in sorted_records[:10]:
        event_type = "OUT" if rec.get("outTime") else "IN"
        event_time = rec.get("outTime") if event_type == "OUT" else rec.get("inTime")
        if not event_time:
            continue

        recent_activity.append({
            "employeeId": rec.get("employeeId"),
            "employeeName": rec.get("employeeName"),
            "department": rec.get("department"),
            "eventType": event_type,
            "time": event_time,
            "status": rec.get("status"),
            "lateBy": rec.get("lateBy", 0),
            "workingDuration": rec.get("workingDuration"),
            "verificationImage": rec.get("verificationImage")
        })

    # 4. Department Breakdown
    departments = ["Engineering", "Human Resources", "Sales", "Design", "Marketing", "Finance", "Operations", "Legal", "Customer Success"]
    dept_stats = []
    for dept in departments:
        dept_total = db.employees.count_documents({"department": dept, "status": "Active"})
        if dept_total == 0:
            continue
        dept_present = sum(1 for r in today_records if r.get("department") == dept and r.get("inTime"))
        dept_stats.append({
            "department": dept,
            "total": dept_total,
            "present": dept_present,
            "percentage": round((dept_present / dept_total) * 100, 1) if dept_total > 0 else 0
        })

    # 5. Last 7-Day Attendance Trend
    trend = []
    today = date.today()
    for d_off in range(6, -1, -1):
        day = today - timedelta(days=d_off)
        d_str = day.isoformat()
        day_label = day.strftime("%a (%d %b)")
        
        day_recs = list(db.attendance.find({"date": d_str}))
        day_present = sum(1 for r in day_recs if r.get("inTime") or r.get("status") in ["FULL DAY", "HALF DAY", "LATE", "PRESENT"])
        day_late = sum(1 for r in day_recs if r.get("status") == "LATE" or r.get("lateBy", 0) > 0)
        day_leave = sum(1 for r in day_recs if r.get("status") == "ON LEAVE")
        day_absent = sum(1 for r in day_recs if r.get("status") == "ABSENT")

        trend.append({
            "date": d_str,
            "day": day_label,
            "present": day_present,
            "late": day_late,
            "leave": day_leave,
            "absent": day_absent,
            "total": total_employees
        })

    return {
        "metrics": {
            "totalEmployees": total_employees,
            "presentToday": present_today,
            "absentToday": absent_today,
            "lateToday": late_today,
            "currentlyInside": currently_inside,
            "halfDay": half_day_today,
            "onLeave": on_leave_today,
            "totalWorkingHours": total_hours_formatted,
            "totalWorkingMinutes": total_working_minutes
        },
        "recentActivity": recent_activity,
        "departmentStats": dept_stats,
        "trend": trend,
        "timestamp": datetime.now().isoformat()
    }
