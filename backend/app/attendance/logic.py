import os
import time
import cv2
import uuid
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional, List, Tuple
from app.config.settings import settings
from app.database.connection import get_db, get_db_manager

logger = logging.getLogger("smartface.attendance")
logging.basicConfig(level=logging.INFO)

class AttendanceStateMachine:
    _instance = None

    def __init__(self):
        # In-memory tracking: { employeeId: { "last_detected": timestamp, "state": "OUTSIDE"|"INSIDE", "session_date": "YYYY-MM-DD" } }
        self.employee_states: Dict[str, Dict[str, Any]] = {}
        # Unknown cooldown to prevent flooding unknown detections: { "last_saved": timestamp }
        self.last_unknown_saved = 0

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = AttendanceStateMachine()
        return cls._instance

    def _parse_time_str(self, time_str: Optional[str], ref_date: Optional[date] = None) -> Optional[datetime]:
        """Parses time strings like '09:00 AM', '17:30', '05:30 PM' into datetime for ref_date (default today)"""
        if not time_str:
            return None
        target_day = ref_date or date.today()
        for fmt in ("%I:%M %p", "%I:%M%p", "%H:%M", "%H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
            try:
                t = datetime.strptime(time_str.strip(), fmt).time()
                return datetime.combine(target_day, t)
            except ValueError:
                pass
        return None

    def _format_time_12h(self, dt: datetime) -> str:
        return dt.strftime("%I:%M %p")

    def _get_shift_for_employee(self, db, shift_id: Optional[str], department: Optional[str]) -> Dict[str, Any]:
        """Fetches shift configuration or fallback default"""
        shift = None
        if shift_id:
            shift = db.shifts.find_one({"id": shift_id, "active": True})
        if not shift and department:
            shift = db.shifts.find_one({"department": department, "active": True})
        if not shift:
            shift = db.shifts.find_one({"active": True})
        
        if not shift:
            # Fallback default shift
            return {
                "id": "shift_default",
                "name": "General Day Shift",
                "startTime": "10:30 AM",
                "endTime": "06:00 PM",
                "requiredWorkingMinutes": 450,
                "fullDayMinimumMinutes": 420,
                "halfDayMinimumMinutes": 225,
                "earlyExitGraceMinutes": 15,
                "lateGraceMinutes": 15,
                "overtimeThreshold": 480
            }
        return shift

    def save_verification_image(self, face_crop_bgr, prefix: str = "att") -> str:
        """Saves verification snapshot to disk and returns web URL path"""
        try:
            today_str = date.today().isoformat()
            filename = f"{prefix}_{today_str}_{uuid.uuid4().hex[:8]}.jpg"
            filepath = os.path.join(settings.UPLOAD_DIR, "verification", filename)
            
            if isinstance(face_crop_bgr, str):
                # Base64 string fallback
                return face_crop_bgr
            
            cv2.imwrite(filepath, face_crop_bgr)
            return f"/uploads/verification/{filename}"
        except Exception as e:
            logger.error(f"Error saving verification image: {e}")
            return ""

    def save_unknown_image(self, face_crop_bgr) -> str:
        """Saves unknown person face capture"""
        try:
            filename = f"unknown_{int(time.time())}_{uuid.uuid4().hex[:6]}.jpg"
            filepath = os.path.join(settings.UPLOAD_DIR, "unknown", filename)
            cv2.imwrite(filepath, face_crop_bgr)
            return f"/uploads/unknown/{filename}"
        except Exception as e:
            logger.error(f"Error saving unknown image: {e}")
            return ""

    def calculate_session_metrics(
        self,
        sessions: List[Dict[str, Any]],
        shift: Dict[str, Any],
        ref_date: Optional[date] = None,
        is_currently_inside: bool = False
    ) -> Dict[str, Any]:
        """
        Pure business calculation function for multiple sessions:
        - Total Working Minutes = Sum of all COMPLETED sessions
        - Total Outside Minutes = Sum of all gaps between consecutive sessions (Session_i.out -> Session_{i+1}.in)
        - Attendance Status = Evaluated against shift thresholds based on totalWorkingMinutes
        """
        target_day = ref_date or date.today()
        total_working_mins = 0
        total_outside_mins = 0

        # Calculate durations for completed sessions
        for s in sessions:
            in_t = s.get("inTime")
            out_t = s.get("outTime")
            if in_t and out_t:
                dt_in = self._parse_time_str(in_t, target_day)
                dt_out = self._parse_time_str(out_t, target_day)
                if dt_in and dt_out and dt_out >= dt_in:
                    dur = int((dt_out - dt_in).total_seconds() // 60)
                    s["durationMinutes"] = dur
                    s["durationStr"] = f"{dur // 60}h {dur % 60:02d}m"
                    s["status"] = "COMPLETED"
                    total_working_mins += dur
            elif in_t and not out_t:
                s["status"] = "ACTIVE"
                s["durationMinutes"] = 0
                s["durationStr"] = "In Progress"

        # Calculate outside time gaps between consecutive sessions
        for i in range(len(sessions) - 1):
            prev_out = sessions[i].get("outTime")
            next_in = sessions[i + 1].get("inTime")
            if prev_out and next_in:
                dt_prev_out = self._parse_time_str(prev_out, target_day)
                dt_next_in = self._parse_time_str(next_in, target_day)
                if dt_prev_out and dt_next_in and dt_next_in >= dt_prev_out:
                    gap = int((dt_next_in - dt_prev_out).total_seconds() // 60)
                    total_outside_mins += max(0, gap)

        working_hours_str = f"{total_working_mins // 60}h {total_working_mins % 60:02d}m"
        outside_hours_str = f"{total_outside_mins // 60}h {total_outside_mins % 60:02d}m"

        full_day_min = shift.get("fullDayMinimumMinutes", 420)
        half_day_min = shift.get("halfDayMinimumMinutes", 225)

        # Status evaluation
        if is_currently_inside and total_working_mins < half_day_min:
            computed_status = "INCOMPLETE"
        elif total_working_mins >= full_day_min:
            computed_status = "FULL DAY"
        elif total_working_mins >= half_day_min:
            computed_status = "HALF DAY"
        else:
            computed_status = "HALF DAY" if total_working_mins >= 120 else "INCOMPLETE"

        first_in = sessions[0].get("inTime") if sessions else None
        completed_sessions = [s for s in sessions if s.get("status") == "COMPLETED" and s.get("outTime")]
        last_out = completed_sessions[-1].get("outTime") if completed_sessions else (sessions[-1].get("outTime") if sessions else None)

        return {
            "totalWorkingMinutes": total_working_mins,
            "workingMinutes": total_working_mins,
            "workingDuration": working_hours_str,
            "totalWorkingHours": working_hours_str,
            "totalOutsideMinutes": total_outside_mins,
            "totalOutsideHours": outside_hours_str,
            "totalSessions": len(sessions),
            "completedSessions": len(completed_sessions),
            "firstIn": first_in,
            "lastOut": last_out,
            "status": computed_status
        }

    def _normalize_attendance_doc(self, att_doc: Optional[Dict[str, Any]], employee_id: str, today_str: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Ensures doc has sessions and timeline arrays, migrating legacy records seamlessly"""
        if not att_doc:
            return [], []

        sessions: List[Dict[str, Any]] = att_doc.get("sessions") or []
        timeline: List[Dict[str, Any]] = att_doc.get("timeline") or []

        # If legacy record without sessions array, convert inTime / outTime into Session 1
        if not sessions and att_doc.get("inTime"):
            in_t = att_doc.get("inTime")
            out_t = att_doc.get("outTime")
            sess_id = f"sess_{uuid.uuid4().hex[:8]}"
            dur = att_doc.get("workingMinutes", 0)
            sessions = [{
                "sessionId": sess_id,
                "sessionIndex": 1,
                "inTime": in_t,
                "outTime": out_t,
                "durationMinutes": dur,
                "durationStr": att_doc.get("workingDuration") or f"{dur // 60}h {dur % 60}m",
                "inVerificationImage": att_doc.get("verificationImage"),
                "outVerificationImage": att_doc.get("outVerificationImage"),
                "status": "COMPLETED" if out_t else "ACTIVE"
            }]

            if not timeline:
                timeline.append({
                    "time": in_t,
                    "type": "IN",
                    "sessionIndex": 1,
                    "sessionId": sess_id,
                    "image": att_doc.get("verificationImage"),
                    "remarks": "Check-in"
                })
                if out_t:
                    timeline.append({
                        "time": out_t,
                        "type": "OUT",
                        "sessionIndex": 1,
                        "sessionId": sess_id,
                        "image": att_doc.get("outVerificationImage"),
                        "remarks": "Check-out"
                    })

        return sessions, timeline

    def process_recognition_event(
        self,
        employee_id: str,
        employee_info: Dict[str, Any],
        face_crop_bgr: Optional[Any] = None,
        camera_id: str = "cam_main",
        mode: str = "AUTO",
        confidence: float = 0.0
    ) -> Dict[str, Any]:
        """
        Executes Multiple IN/OUT Session State Machine:
        - Cooldown checks
        - Accurate determination of current INSIDE / OUTSIDE state
        - Creates new session on IN
        - Closes active session on OUT
        - Calculates cumulative working hours and outside intervals
        - Real-time MongoDB persistence & Notifications
        """
        db = get_db()
        now = datetime.now()
        today_str = now.date().isoformat()
        now_time_str = self._format_time_12h(now)
        current_ts = time.time()

        # Cooldown check
        emp_state = self.employee_states.get(employee_id, {
            "last_detected": 0,
            "state": "OUTSIDE",
            "session_date": today_str
        })

        if emp_state.get("session_date") != today_str:
            emp_state = {
                "last_detected": 0,
                "state": "OUTSIDE",
                "session_date": today_str
            }

        cooldown_sec = settings.DETECTION_COOLDOWN_SECONDS
        time_since_last = current_ts - emp_state["last_detected"]

        if time_since_last < cooldown_sec:
            return {
                "eventTriggered": "COOLDOWN",
                "employeeId": employee_id,
                "name": employee_info.get("name"),
                "department": employee_info.get("department"),
                "state": emp_state["state"],
                "message": f"Cooldown active ({int(cooldown_sec - time_since_last)}s remaining). Duplicate ignored.",
                "attendanceStatus": "LOGGED"
            }

        emp_state["last_detected"] = current_ts

        # Fetch today's attendance record from MongoDB
        att_doc = db.attendance.find_one({"employeeId": employee_id, "date": today_str})
        shift = self._get_shift_for_employee(db, employee_info.get("shiftId"), employee_info.get("department"))

        # Extract & normalize sessions and timeline
        sessions, timeline = self._normalize_attendance_doc(att_doc, employee_id, today_str)

        # Determine if employee is currently INSIDE
        is_currently_inside = len(sessions) > 0 and (sessions[-1].get("outTime") is None or sessions[-1].get("status") == "ACTIVE")
        emp_state["state"] = "INSIDE" if is_currently_inside else "OUTSIDE"

        # Determine target action: 'IN' or 'OUT'
        target_action = None
        if mode == "AUTO":
            target_action = "OUT" if is_currently_inside else "IN"
        elif mode == "IN_ONLY":
            if is_currently_inside:
                # Duplicate IN rejection
                curr_in = sessions[-1].get("inTime", "Earlier")
                return {
                    "eventTriggered": "DUPLICATE_IN",
                    "employeeId": employee_id,
                    "name": employee_info.get("name"),
                    "department": employee_info.get("department"),
                    "state": "INSIDE",
                    "inTime": curr_in,
                    "message": f"Already checked IN at {curr_in} (Session {len(sessions)} is currently active).",
                    "attendanceStatus": att_doc.get("status", "INCOMPLETE") if att_doc else "INCOMPLETE"
                }
            target_action = "IN"
        elif mode == "OUT_ONLY":
            if not is_currently_inside:
                # Duplicate OUT rejection
                return {
                    "eventTriggered": "DUPLICATE_OUT",
                    "employeeId": employee_id,
                    "name": employee_info.get("name"),
                    "department": employee_info.get("department"),
                    "state": "OUTSIDE",
                    "message": "Already checked OUT. No active session. Please punch IN first.",
                    "attendanceStatus": att_doc.get("status", "OUTSIDE") if att_doc else "NOT CHECKED IN"
                }
            target_action = "OUT"

        # ================= EXECUTE ACTION: IN =================
        if target_action == "IN":
            verif_img_path = self.save_verification_image(face_crop_bgr, prefix=f"in_{employee_id}") if face_crop_bgr is not None else ""
            session_index = len(sessions) + 1
            session_id = f"sess_{uuid.uuid4().hex[:8]}"

            # Calculate Late arrival for the FIRST session of the day
            late_by = att_doc.get("lateBy", 0) if att_doc else 0
            if session_index == 1:
                shift_start_dt = self._parse_time_str(shift.get("startTime", "10:30 AM"))
                if shift_start_dt:
                    late_grace = shift.get("lateGraceMinutes", 15)
                    allowed_in_dt = shift_start_dt + timedelta(minutes=late_grace)
                    if now > allowed_in_dt:
                        diff_seconds = (now - shift_start_dt).total_seconds()
                        late_by = max(0, int(diff_seconds // 60))

            new_session = {
                "sessionId": session_id,
                "sessionIndex": session_index,
                "inTime": now_time_str,
                "outTime": None,
                "durationMinutes": 0,
                "durationStr": "In Progress",
                "inVerificationImage": verif_img_path,
                "outVerificationImage": None,
                "status": "ACTIVE"
            }
            sessions.append(new_session)

            timeline_event = {
                "time": now_time_str,
                "type": "IN",
                "sessionIndex": session_index,
                "sessionId": session_id,
                "image": verif_img_path,
                "remarks": f"Gate Check-In (Session {session_index}) - {confidence}% Confidence"
            }
            timeline.append(timeline_event)

            # Recalculate metrics
            metrics = self.calculate_session_metrics(sessions, shift, now.date(), is_currently_inside=True)

            status_to_set = "LATE" if (session_index == 1 and late_by > 0) else metrics["status"]

            doc_update = {
                "employeeId": employee_id,
                "employeeName": employee_info.get("name", "Unknown"),
                "department": employee_info.get("department", "General"),
                "date": today_str,
                "shiftId": shift.get("id", "shift_general"),
                "firstIn": metrics["firstIn"],
                "inTime": metrics["firstIn"],
                "lastOut": metrics["lastOut"],
                "outTime": metrics["lastOut"],
                "currentStatus": "INSIDE",
                "totalSessions": metrics["totalSessions"],
                "completedSessions": metrics["completedSessions"],
                "workingDuration": metrics["workingDuration"],
                "workingMinutes": metrics["workingMinutes"],
                "totalWorkingMinutes": metrics["totalWorkingMinutes"],
                "totalOutsideMinutes": metrics["totalOutsideMinutes"],
                "totalOutsideHours": metrics["totalOutsideHours"],
                "expectedIn": shift.get("startTime", "10:30 AM"),
                "expectedOut": shift.get("endTime", "06:00 PM"),
                "lateBy": late_by,
                "earlyExitBy": att_doc.get("earlyExitBy", 0) if att_doc else 0,
                "status": status_to_set,
                "sessions": sessions,
                "timeline": timeline,
                "verificationImage": sessions[0].get("inVerificationImage") or verif_img_path,
                "outVerificationImage": metrics["lastOut"] and att_doc and att_doc.get("outVerificationImage"),
                "remarks": f"Session {session_index} started at {now_time_str}",
                "updatedAt": now.isoformat()
            }
            if not att_doc:
                doc_update["createdAt"] = now.isoformat()

            db.attendance.update_one(
                {"employeeId": employee_id, "date": today_str},
                {"$set": doc_update},
                upsert=True
            )
            get_db_manager().save_state()

            emp_state["state"] = "INSIDE"
            self.employee_states[employee_id] = emp_state

            self._log_audit(db, "ATTENDANCE_IN", employee_id, {
                "sessionIndex": session_index,
                "inTime": now_time_str,
                "lateBy": late_by,
                "cameraId": camera_id,
                "confidence": confidence
            })

            # Employee in-app notification
            try:
                db.notifications.insert_one({
                    "id": f"notif_{uuid.uuid4().hex[:10]}",
                    "employeeId": employee_id,
                    "title": f"Checked In (Session {session_index})",
                    "message": f"Punch IN recorded at {now_time_str}" + (f" (Late by {late_by} mins)" if (session_index == 1 and late_by > 0) else ""),
                    "type": "ATTENDANCE",
                    "read": False,
                    "createdAt": now.isoformat()
                })
            except Exception:
                pass

            return {
                "eventTriggered": "IN",
                "employeeId": employee_id,
                "name": employee_info.get("name"),
                "department": employee_info.get("department"),
                "state": "INSIDE",
                "sessionIndex": session_index,
                "inTime": now_time_str,
                "firstIn": metrics["firstIn"],
                "lastOut": metrics["lastOut"],
                "totalSessions": metrics["totalSessions"],
                "workingDuration": metrics["workingDuration"],
                "totalOutsideHours": metrics["totalOutsideHours"],
                "lateBy": late_by,
                "message": f"Punch IN recorded at {now_time_str} (Session {session_index})" + (f" [Late by {late_by}m]" if (session_index == 1 and late_by > 0) else " [On Time]"),
                "attendanceStatus": status_to_set,
                "verificationImage": verif_img_path,
                "sessions": sessions,
                "timeline": timeline
            }

        # ================= EXECUTE ACTION: OUT =================
        elif target_action == "OUT":
            active_session = sessions[-1]
            in_time_str = active_session.get("inTime", now_time_str)
            in_time_dt = self._parse_time_str(in_time_str)

            # Prevent immediate accidental punch within 60s
            if in_time_dt and (now - in_time_dt).total_seconds() < 60:
                return {
                    "eventTriggered": "IGNORE_TOO_SOON",
                    "employeeId": employee_id,
                    "name": employee_info.get("name"),
                    "department": employee_info.get("department"),
                    "state": "INSIDE",
                    "message": "Detection too close to check-in time. Minimum session duration required.",
                    "attendanceStatus": att_doc.get("status") if att_doc else "INCOMPLETE"
                }

            verif_out_img_path = self.save_verification_image(face_crop_bgr, prefix=f"out_{employee_id}") if face_crop_bgr is not None else ""

            # Close active session
            active_session["outTime"] = now_time_str
            active_session["outVerificationImage"] = verif_out_img_path
            active_session["status"] = "COMPLETED"
            
            sess_dur = 0
            if in_time_dt:
                sess_dur = max(0, int((now - in_time_dt).total_seconds() // 60))
            active_session["durationMinutes"] = sess_dur
            active_session["durationStr"] = f"{sess_dur // 60}h {sess_dur % 60}m"

            timeline_event = {
                "time": now_time_str,
                "type": "OUT",
                "sessionIndex": active_session["sessionIndex"],
                "sessionId": active_session["sessionId"],
                "image": verif_out_img_path,
                "remarks": f"Gate Check-Out (Session {active_session['sessionIndex']}) - Duration: {active_session['durationStr']}"
            }
            timeline.append(timeline_event)

            # Calculate Early Exit relative to shift end
            shift_end_dt = self._parse_time_str(shift.get("endTime", "06:00 PM"))
            early_exit_by = 0
            if shift_end_dt:
                early_grace = shift.get("earlyExitGraceMinutes", 15)
                allowed_out_dt = shift_end_dt - timedelta(minutes=early_grace)
                if now < allowed_out_dt:
                    diff_seconds = (shift_end_dt - now).total_seconds()
                    early_exit_by = max(0, int(diff_seconds // 60))

            # Recalculate metrics
            metrics = self.calculate_session_metrics(sessions, shift, now.date(), is_currently_inside=False)

            doc_update = {
                "employeeId": employee_id,
                "employeeName": employee_info.get("name", "Unknown"),
                "department": employee_info.get("department", "General"),
                "date": today_str,
                "shiftId": shift.get("id", "shift_general"),
                "firstIn": metrics["firstIn"],
                "inTime": metrics["firstIn"],
                "lastOut": now_time_str,
                "outTime": now_time_str,
                "currentStatus": "OUTSIDE",
                "totalSessions": metrics["totalSessions"],
                "completedSessions": metrics["completedSessions"],
                "workingDuration": metrics["workingDuration"],
                "workingMinutes": metrics["workingMinutes"],
                "totalWorkingMinutes": metrics["totalWorkingMinutes"],
                "totalOutsideMinutes": metrics["totalOutsideMinutes"],
                "totalOutsideHours": metrics["totalOutsideHours"],
                "earlyExitBy": early_exit_by,
                "status": metrics["status"],
                "sessions": sessions,
                "timeline": timeline,
                "outVerificationImage": verif_out_img_path,
                "remarks": f"Session {active_session['sessionIndex']} completed ({active_session['durationStr']}). Total: {metrics['workingDuration']}",
                "updatedAt": now.isoformat()
            }

            db.attendance.update_one(
                {"employeeId": employee_id, "date": today_str},
                {"$set": doc_update},
                upsert=True
            )
            get_db_manager().save_state()

            emp_state["state"] = "OUTSIDE"
            self.employee_states[employee_id] = emp_state

            self._log_audit(db, "ATTENDANCE_OUT", employee_id, {
                "sessionIndex": active_session["sessionIndex"],
                "outTime": now_time_str,
                "sessionDuration": active_session["durationStr"],
                "totalWorkingDuration": metrics["workingDuration"],
                "status": metrics["status"],
                "earlyExitBy": early_exit_by,
                "cameraId": camera_id
            })

            # Create employee notification
            try:
                db.notifications.insert_one({
                    "id": f"notif_{uuid.uuid4().hex[:10]}",
                    "employeeId": employee_id,
                    "title": f"Checked Out (Session {active_session['sessionIndex']})",
                    "message": f"Punch OUT recorded at {now_time_str}. Session: {active_session['durationStr']}. Cumulative working time: {metrics['workingDuration']} ({metrics['status']}).",
                    "type": "ATTENDANCE",
                    "read": False,
                    "createdAt": now.isoformat()
                })
            except Exception:
                pass

            return {
                "eventTriggered": "OUT",
                "employeeId": employee_id,
                "name": employee_info.get("name"),
                "department": employee_info.get("department"),
                "state": "OUTSIDE",
                "sessionIndex": active_session["sessionIndex"],
                "outTime": now_time_str,
                "firstIn": metrics["firstIn"],
                "lastOut": now_time_str,
                "sessionDuration": active_session["durationStr"],
                "workingDuration": metrics["workingDuration"],
                "totalOutsideHours": metrics["totalOutsideHours"],
                "earlyExitBy": early_exit_by,
                "message": f"Punch OUT recorded at {now_time_str} (Session {active_session['sessionIndex']}: {active_session['durationStr']}, Total Office Time: {metrics['workingDuration']})",
                "attendanceStatus": metrics["status"],
                "outVerificationImage": verif_out_img_path,
                "sessions": sessions,
                "timeline": timeline
            }

        return {
            "eventTriggered": None,
            "employeeId": employee_id,
            "name": employee_info.get("name"),
            "state": emp_state["state"],
            "message": "No state change required."
        }

    def process_unknown_detection(self, face_crop_bgr, camera_id: str = "cam_main", confidence: float = 0.0) -> Dict[str, Any]:
        """Handles unknown person detection with rate limiting"""
        now_ts = time.time()
        # Rate limit saving unknown faces to avoid flooding disk (max 1 every 8 seconds per camera)
        if now_ts - self.last_unknown_saved > 8.0:
            self.last_unknown_saved = now_ts
            db = get_db()
            image_path = self.save_unknown_image(face_crop_bgr) if face_crop_bgr is not None else ""
            now_iso = datetime.now().isoformat()
            
            doc = {
                "id": f"unk_{uuid.uuid4().hex[:10]}",
                "capturedImage": image_path,
                "detectedAt": now_iso,
                "confidence": confidence,
                "cameraId": camera_id,
                "reviewed": False
            }
            db.unknown_detections.insert_one(doc)
            get_db_manager().save_state()

        return {
            "eventTriggered": "UNKNOWN_PERSON",
            "name": "Unknown Person",
            "message": "Unknown face detected. Attendance NOT recorded.",
            "isRecognized": False,
            "confidence": confidence
        }

    def _log_audit(self, db, action: str, entity_id: str, details: Dict[str, Any]):
        try:
            db.audit_logs.insert_one({
                "id": f"aud_{uuid.uuid4().hex[:10]}",
                "action": action,
                "performedBy": "AI Recognition Engine",
                "entityType": "Attendance",
                "entityId": entity_id,
                "details": details,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Audit log insertion error: {e}")

def get_attendance_state_machine():
    return AttendanceStateMachine.get_instance()
