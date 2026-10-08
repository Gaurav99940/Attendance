import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.models.schemas import FrameInferenceRequest, DetectedFaceResult
from app.face_recognition.engine import get_face_engine
from app.attendance.logic import get_attendance_state_machine
from app.camera.ip_camera_service import get_ip_camera_service
from app.services.websocket_manager import get_ws_manager
from app.database.connection import get_db

logger = logging.getLogger("smartface.camera")
router = APIRouter(prefix="/camera", tags=["Camera & Recognition"])

class SimulatePunchRequest(BaseModel):
    employeeId: str
    mode: Optional[str] = "AUTO"  # AUTO, IN_ONLY, OUT_ONLY
    cameraId: Optional[str] = "cam_main"

class ProcessGateFrameRequest(BaseModel):
    mode: Optional[str] = "AUTO"
    cameraId: Optional[str] = "CAM_GATE_01"
    view: Optional[str] = "auto"

@router.get("/sources")
def get_camera_sources():
    """Returns available camera sources with live connection health"""
    ip_cam = get_ip_camera_service()
    gate_info = ip_cam.get_camera_info()

    sources = [
        {
            "id": "cam_main",
            "name": "Local Webcam",
            "type": "WEBCAM",
            "location": "Front Desk / Terminal",
            "url": "",
            "active": True,
            "status": "ONLINE",
            "isOnline": True
        },
        {
            "id": gate_info["id"],
            "name": gate_info["name"],
            "type": "IP_CAMERA",
            "location": gate_info["location"],
            "url": gate_info["url"],
            "active": True,
            "status": gate_info["status"],
            "isOnline": gate_info["isOnline"],
            "lastFrameTime": gate_info["lastFrameTime"],
            "lastError": gate_info["lastError"]
        }
    ]
    return sources

@router.get("/stream/{camera_id}")
async def get_camera_stream(camera_id: str, view: Optional[str] = "auto"):
    """Provides a browser-compatible live MJPEG video stream from the company gate IP camera"""
    if camera_id in ["CAM_GATE_01", "gate_cam", "cam_gate", "cam_gate_01"]:
        ip_cam = get_ip_camera_service()
        return StreamingResponse(
            ip_cam.generate_mjpeg_stream(view=view or "auto"),
            media_type="multipart/x-mixed-replace; boundary=frame"
        )
    raise HTTPException(status_code=404, detail=f"Streaming not applicable for camera '{camera_id}'.")

@router.get("/frame/{camera_id}")
async def get_camera_latest_frame(camera_id: str, view: Optional[str] = "auto"):
    """Returns the latest single JPEG snapshot from the company gate IP camera"""
    if camera_id in ["CAM_GATE_01", "gate_cam", "cam_gate", "cam_gate_01"]:
        ip_cam = get_ip_camera_service()
        _, jpeg_bytes = await ip_cam.get_latest_frame(view=view or "auto")
        if jpeg_bytes is not None:
            return Response(content=jpeg_bytes, media_type="image/jpeg")
        raise HTTPException(status_code=503, detail="Gate camera frame currently unavailable.")
    raise HTTPException(status_code=404, detail=f"Frame not found for camera '{camera_id}'.")

@router.post("/process-gate-frame")
async def process_gate_camera_frame(req: ProcessGateFrameRequest = ProcessGateFrameRequest()):
    """
    Processes the live Company Gate IP Camera stream frame:
    1. Grabs latest frame from IP camera receiver
    2. Runs MTCNN Face Detection & FaceNet Recognition
    3. Matches with employee database
    4. Evaluates Attendance State Machine (IN/OUT sessions)
    5. Broadcasts real-time events via WebSocket
    """
    db = get_db()
    settings_doc = db.settings.find_one({"id": "global_settings"})
    threshold = float(settings_doc.get("faceConfidenceThreshold", 0.62)) if settings_doc else 0.62

    ip_cam = get_ip_camera_service()
    result = await ip_cam.process_current_gate_frame(mode=req.mode or "AUTO", threshold=threshold, view=req.view or "auto")
    return result

@router.post("/test-connection")
async def test_camera_connection():
    """Tests connectivity to the company gate IP camera service at http://143.244.140.108:10000"""
    ip_cam = get_ip_camera_service()
    result = await ip_cam.test_connection()
    return result

@router.post("/process-frame")
async def process_camera_frame(req: FrameInferenceRequest):
    """
    Core Computer Vision API for Local Webcam or Custom Base64 Frames:
    1. Decodes base64 camera image
    2. Runs Face Detection & FaceNet Embedding extraction
    3. Matches with employee database
    4. Evaluates Attendance State Machine (IN/OUT/Duplicate Prevention)
    5. Broadcasts real-time events via WebSocket
    """
    engine = get_face_engine()
    state_machine = get_attendance_state_machine()
    ws = get_ws_manager()

    bgr_img = engine.decode_base64_frame(req.image)
    if bgr_img is None:
        raise HTTPException(status_code=400, detail="Could not decode frame image.")

    db = get_db()
    settings_doc = db.settings.find_one({"id": "global_settings"})
    threshold = float(settings_doc.get("faceConfidenceThreshold", 0.62)) if settings_doc else 0.62

    detections = engine.process_frame(bgr_img, threshold=threshold)
    results = []

    for det in detections:
        box = det["box"]
        emp_id = det.get("employeeId")
        conf = det.get("confidence", 0.0)
        face_crop = det.get("faceCrop")

        if det.get("isRecognized") and emp_id:
            emp_info = {
                "name": det["name"],
                "department": det["department"],
                "designation": det["designation"],
                "profilePhoto": det.get("profilePhoto"),
                "shiftId": "shift_general"
            }

            event_res = state_machine.process_recognition_event(
                employee_id=emp_id,
                employee_info=emp_info,
                face_crop_bgr=face_crop,
                camera_id=req.cameraId or "cam_main",
                mode=req.mode or "AUTO",
                confidence=conf
            )

            if event_res.get("eventTriggered") in ["IN", "OUT"]:
                broadcast_payload = {
                    "type": "ATTENDANCE_EVENT",
                    "event": event_res["eventTriggered"],
                    "employeeId": emp_id,
                    "name": det["name"],
                    "department": det["department"],
                    "cameraId": req.cameraId or "cam_main",
                    "cameraLocation": "Front Desk / Terminal" if req.cameraId == "cam_main" else "Main Gate",
                    "time": event_res.get("inTime") if event_res["eventTriggered"] == "IN" else event_res.get("outTime"),
                    "duration": event_res.get("workingDuration"),
                    "status": event_res.get("attendanceStatus"),
                    "confidence": conf,
                    "message": event_res.get("message"),
                    "verificationImage": event_res.get("verificationImage") or event_res.get("outVerificationImage")
                }
                asyncio.create_task(ws.broadcast(broadcast_payload))

            results.append({
                "box": box,
                "employeeId": emp_id,
                "name": det["name"],
                "department": det["department"],
                "designation": det["designation"],
                "profilePhoto": det.get("profilePhoto"),
                "confidence": conf,
                "isRecognized": True,
                "eventTriggered": event_res.get("eventTriggered"),
                "attendanceStatus": event_res.get("attendanceStatus"),
                "message": event_res.get("message"),
                "cameraId": req.cameraId or "cam_main",
                "cameraLocation": "Front Desk / Terminal" if req.cameraId == "cam_main" else "Main Gate"
            })
        else:
            unk_res = state_machine.process_unknown_detection(
                face_crop_bgr=face_crop,
                camera_id=req.cameraId or "cam_main",
                confidence=conf
            )

            results.append({
                "box": box,
                "employeeId": None,
                "name": "Unknown Person",
                "department": "Unidentified",
                "designation": "",
                "profilePhoto": "",
                "confidence": conf,
                "isRecognized": False,
                "eventTriggered": "UNKNOWN_PERSON",
                "attendanceStatus": "UNAUTHORIZED",
                "message": "Unknown face detected. Attendance NOT recorded.",
                "cameraId": req.cameraId or "cam_main",
                "cameraLocation": "Front Desk / Terminal" if req.cameraId == "cam_main" else "Main Gate"
            })

    return {
        "success": True,
        "facesCount": len(results),
        "timestamp": datetime.now().isoformat(),
        "detections": results
    }

@router.post("/simulate-punch")
async def simulate_punch(req: SimulatePunchRequest):
    """Simulates an employee appearing in front of the camera (useful for testing)"""
    db = get_db()
    emp = db.employees.find_one({"employeeId": req.employeeId})
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee '{req.employeeId}' not found.")

    state_machine = get_attendance_state_machine()
    ws = get_ws_manager()

    emp_info = {
        "name": emp.get("name"),
        "department": emp.get("department"),
        "designation": emp.get("designation"),
        "profilePhoto": emp.get("profilePhoto"),
        "shiftId": emp.get("shiftId", "shift_general")
    }

    camera_name = "Reception Lobby Camera" if req.cameraId == "CAM_GATE_01" else "Local Webcam"
    camera_loc = "Main Gate" if req.cameraId == "CAM_GATE_01" else "Front Desk / Terminal"

    event_res = state_machine.process_recognition_event(
        employee_id=req.employeeId,
        employee_info=emp_info,
        face_crop_bgr=None,
        camera_id=req.cameraId or "cam_main",
        mode=req.mode or "AUTO",
        confidence=95.4
    )

    if event_res.get("eventTriggered") in ["IN", "OUT"]:
        broadcast_payload = {
            "type": "ATTENDANCE_EVENT",
            "event": event_res["eventTriggered"],
            "employeeId": req.employeeId,
            "name": emp.get("name"),
            "department": emp.get("department"),
            "cameraId": req.cameraId or "cam_main",
            "cameraName": camera_name,
            "cameraLocation": camera_loc,
            "time": event_res.get("inTime") if event_res["eventTriggered"] == "IN" else event_res.get("outTime"),
            "duration": event_res.get("workingDuration"),
            "status": event_res.get("attendanceStatus"),
            "confidence": 95.4,
            "message": event_res.get("message"),
            "verificationImage": emp.get("profilePhoto")
        }
        asyncio.create_task(ws.broadcast(broadcast_payload))

    return {
        "success": True,
        "employeeId": req.employeeId,
        "name": emp.get("name"),
        "result": event_res
    }

@router.get("/status")
def get_camera_status():
    ip_cam = get_ip_camera_service()
    gate_info = ip_cam.get_camera_info()

    return {
        "status": "Online",
        "backendVisionDevice": "CPU/FaceNet-PyTorch",
        "gateCamera": gate_info,
        "activeEngine": "PyTorch InceptionResnetV1 (vggface2)"
    }
