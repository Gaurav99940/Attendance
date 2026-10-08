import os
import re
import time
import uuid
import asyncio
import logging
import urllib.request
import urllib.error
import numpy as np
import cv2
from datetime import datetime
from typing import Optional, Tuple, Dict, Any, List
from app.config.settings import settings
from app.face_recognition.engine import get_face_engine
from app.attendance.logic import get_attendance_state_machine
from app.services.websocket_manager import get_ws_manager
from app.database.connection import get_db

logger = logging.getLogger("smartface.camera.ip")

class IPCameraService:
    _instance = None

    def __init__(self):
        self.camera_id = getattr(settings, "GATE_CAMERA_ID", "CAM_GATE_01")
        self.camera_name = getattr(settings, "GATE_CAMERA_NAME", "Reception Lobby Camera")
        self.camera_location = getattr(settings, "GATE_CAMERA_LOCATION", "Main Gate")
        self.base_url = getattr(settings, "GATE_CAMERA_URL", "http://143.244.140.108:10000").rstrip("/")
        
        self.is_online = True
        self.status = "ONLINE"
        self.last_error = ""

        # Latest raw frame from remote server
        self.last_frame_bgr: Optional[np.ndarray] = None
        self.last_frame_jpeg: Optional[bytes] = None
        self.last_frame_time: Optional[float] = None
        self.last_frame_path: str = ""
        self.last_frame_dt: Optional[datetime] = None
        self.last_frame_brightness: float = 0.0
        self.is_dark: bool = False
        self.is_stale: bool = False

        # Cached last well-lit daylight frame (for fallback / diagnostics)
        self.daylight_frame_bgr: Optional[np.ndarray] = None
        self.daylight_frame_jpeg: Optional[bytes] = None
        self.daylight_frame_path: str = ""
        self.daylight_frame_dt: Optional[datetime] = None
        self.daylight_frame_brightness: float = 0.0

        self.last_detections: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = IPCameraService()
        return cls._instance

    def _extract_timestamp(self, path: str) -> str:
        """Extracts numerical timestamp YYYYMMDDHHMMSS from path format [EX]_YYYYMMDD_HHMMSS..."""
        m = re.search(r'[EX]_(\d{8})_(\d{6})', path)
        if m:
            return m.group(1) + m.group(2)
        return "00000000000000"

    def _parse_datetime(self, ts_str: str) -> Optional[datetime]:
        try:
            if len(ts_str) == 14 and ts_str != "00000000000000":
                return datetime.strptime(ts_str, "%Y%m%d%H%M%S")
        except Exception:
            pass
        return None

    def _format_age(self, dt: Optional[datetime]) -> Tuple[int, str]:
        if not dt:
            return 999999, "unknown"
        age_sec = int((datetime.now() - dt).total_seconds())
        if age_sec < 0:
            age_sec = 0
        if age_sec < 60:
            return age_sec, f"{age_sec}s ago"
        elif age_sec < 3600:
            return age_sec, f"{age_sec // 60}m ago"
        elif age_sec < 86400:
            return age_sec, f"{age_sec // 3600}h {(age_sec % 3600) // 60}m ago"
        else:
            return age_sec, f"{age_sec // 86400}d ago"

    def get_camera_info(self) -> Dict[str, Any]:
        """Returns metadata, frame freshness, and live health status for UI"""
        age_sec, age_str = self._format_age(self.last_frame_dt)
        return {
            "id": self.camera_id,
            "name": self.camera_name,
            "type": "IP_CAMERA",
            "location": self.camera_location,
            "url": self.base_url,
            "isOnline": self.is_online,
            "status": self.status,
            "lastFrameTime": age_str,
            "lastFrameTimestamp": self.last_frame_time,
            "lastFramePath": self.last_frame_path,
            "lastFrameRecordedAt": self.last_frame_dt.isoformat() if self.last_frame_dt else None,
            "brightness": self.last_frame_brightness,
            "isDark": self.is_dark,
            "isStale": self.is_stale,
            "hasDaylightFallback": self.daylight_frame_bgr is not None,
            "lastError": self.last_error,
            "active": True
        }

    def _fetch_frame_data_sync(self, path: str) -> Tuple[Optional[np.ndarray], Optional[bytes], float]:
        """Fetches and decodes an image given its relative path"""
        try:
            full_url = f"{self.base_url}{path}"
            req = urllib.request.Request(
                full_url,
                headers={"User-Agent": "SmartFace-IPCamera-Client/1.0"}
            )
            with urllib.request.urlopen(req, timeout=3.5) as resp:
                jpeg_bytes = resp.read()
            nparr = np.frombuffer(jpeg_bytes, np.uint8)
            img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            brightness = round(float(img_bgr.mean()), 1) if img_bgr is not None else 0.0
            return img_bgr, jpeg_bytes, brightness
        except Exception as e:
            logger.debug(f"Failed to fetch frame {path}: {e}")
            return None, None, 0.0

    def _fetch_latest_frame_sync(self) -> Tuple[str, Optional[np.ndarray], Optional[bytes]]:
        """Synchronously discovers newest images and caches both latest and daylight frames"""
        try:
            req = urllib.request.Request(
                f"{self.base_url}/",
                headers={"User-Agent": "SmartFace-IPCamera-Client/1.0"}
            )
            with urllib.request.urlopen(req, timeout=3.5) as response:
                raw_html = response.read().decode('utf-8', errors='ignore')

            matches = list(set(re.findall(r'/uploads/[^"\'\s>]+\.jpg', raw_html)))
            if not matches:
                self.is_online = False
                self.status = "NO_FRAMES"
                return "", None, None

            # Sort descending by timestamp
            sorted_matches = sorted(matches, key=self._extract_timestamp, reverse=True)
            latest_path = sorted_matches[0]
            latest_ts = self._extract_timestamp(latest_path)
            latest_dt = self._parse_datetime(latest_ts)

            # Check if we can reuse cached frame
            now = time.time()
            if (latest_path == self.last_frame_path and 
                self.last_frame_bgr is not None and 
                (now - (self.last_frame_time or 0)) < 3.0):
                return self.last_frame_path, self.last_frame_bgr, self.last_frame_jpeg

            # Download the latest frame
            img_bgr, jpeg_bytes, brightness = self._fetch_frame_data_sync(latest_path)
            if img_bgr is None:
                return "", None, None

            self.last_frame_bgr = img_bgr
            self.last_frame_jpeg = jpeg_bytes
            self.last_frame_path = latest_path
            self.last_frame_time = now
            self.last_frame_dt = latest_dt
            self.last_frame_brightness = brightness
            self.is_dark = brightness < 15.0

            age_sec, _ = self._format_age(latest_dt)
            self.is_stale = age_sec > 180  # Older than 3 minutes without new upload
            self.is_online = True
            self.status = "ONLINE" if not self.is_stale else "STALE"
            self.last_error = ""

            # Check if the latest frame itself is daylight
            if not self.is_dark:
                self.daylight_frame_bgr = img_bgr
                self.daylight_frame_jpeg = jpeg_bytes
                self.daylight_frame_path = latest_path
                self.daylight_frame_dt = latest_dt
                self.daylight_frame_brightness = brightness
            elif self.daylight_frame_bgr is None:
                # Find the newest daylight frame in top 15 images to have as reliable fallback
                for p in sorted_matches[1:15]:
                    bgr, j_bytes, bright = self._fetch_frame_data_sync(p)
                    if bgr is not None and bright >= 25.0:
                        self.daylight_frame_bgr = bgr
                        self.daylight_frame_jpeg = j_bytes
                        self.daylight_frame_path = p
                        self.daylight_frame_dt = self._parse_datetime(self._extract_timestamp(p))
                        self.daylight_frame_brightness = bright
                        break

            return latest_path, self.last_frame_bgr, self.last_frame_jpeg

        except Exception as e:
            logger.debug(f"Fetch frame sync error: {e}")
            self.last_error = str(e)
            return "", None, None

    def _run_inference_sync(self, frame_bgr: np.ndarray, threshold: float) -> List[Dict[str, Any]]:
        """Synchronously runs MTCNN + FaceNet in worker thread"""
        try:
            engine = get_face_engine()
            return engine.process_frame(frame_bgr, threshold=threshold)
        except Exception as e:
            logger.error(f"Inference error: {e}")
            return []

    async def get_latest_frame(self, view: str = "auto") -> Tuple[Optional[np.ndarray], Optional[bytes]]:
        """
        Returns the appropriate frame based on view mode:
        - "latest": Absolute latest raw frame uploaded by camera
        - "daylight": Last well-lit frame
        - "auto": Latest frame if bright, or daylight frame if latest is pitch black
        """
        now = time.time()
        # Refresh if stale cache (>1.2s)
        if self.last_frame_bgr is None or self.last_frame_time is None or (now - self.last_frame_time) >= 1.2:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._fetch_latest_frame_sync)

        if view == "daylight" and self.daylight_frame_bgr is not None:
            return self.daylight_frame_bgr, self.daylight_frame_jpeg

        if view == "auto":
            # If the latest image is pitch black (< 10) and we have a bright daylight frame,
            # return daylight frame so the screen is never a pitch black void
            if self.is_dark and self.daylight_frame_bgr is not None:
                return self.daylight_frame_bgr, self.daylight_frame_jpeg

        return self.last_frame_bgr, self.last_frame_jpeg

    async def generate_mjpeg_stream(self, view: str = "auto"):
        """Streams continuous multipart MJPEG video feed to the browser"""
        while True:
            try:
                frame_bgr, jpeg_bytes = await self.get_latest_frame(view=view)
                if jpeg_bytes is None:
                    # Generate placeholder
                    placeholder = np.zeros((240, 320, 3), dtype=np.uint8)
                    cv2.putText(placeholder, "CONNECTING GATE...", (30, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (220, 220, 220), 1)
                    _, jpeg_bytes = cv2.imencode('.jpg', placeholder, [cv2.IMWRITE_JPEG_QUALITY, 70])
                    jpeg_bytes = jpeg_bytes.tobytes()

                yield (
                    b'--frame\r\n'
                    b'Content-Type: image/jpeg\r\n'
                    b'Content-Length: ' + str(len(jpeg_bytes)).encode('utf-8') + b'\r\n\r\n' +
                    jpeg_bytes + b'\r\n'
                )
            except Exception as e:
                logger.debug(f"MJPEG stream chunk error: {e}")
            
            await asyncio.sleep(0.35)

    async def process_current_gate_frame(self, mode: str = "AUTO", threshold: float = 0.62, view: str = "auto") -> Dict[str, Any]:
        """Runs real-time face recognition and attendance tracking on the gate frame"""
        frame_bgr, jpeg_bytes = await self.get_latest_frame(view=view)

        if frame_bgr is None:
            return {
                "success": False,
                "isOnline": False,
                "status": "OFFLINE",
                "error": "Gate camera stream unavailable.",
                "facesCount": 0,
                "detections": [],
                "timestamp": datetime.now().isoformat()
            }

        # Check if frame is too dark for computer vision (< 10 brightness)
        brightness = round(float(frame_bgr.mean()), 1)
        if brightness < 10.0:
            return {
                "success": True,
                "isOnline": True,
                "status": "DARK_FEED",
                "isDark": True,
                "brightness": brightness,
                "cameraInfo": self.get_camera_info(),
                "facesCount": 0,
                "detections": [],
                "message": "Camera feed is pitch black / low light. Face recognition cannot detect faces in darkness.",
                "timestamp": datetime.now().isoformat()
            }

        loop = asyncio.get_event_loop()
        detections = await loop.run_in_executor(None, self._run_inference_sync, frame_bgr, threshold)

        state_machine = get_attendance_state_machine()
        ws = get_ws_manager()
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
                    camera_id=self.camera_id,
                    mode=mode or "AUTO",
                    confidence=conf
                )

                if event_res.get("eventTriggered") in ["IN", "OUT"]:
                    broadcast_payload = {
                        "type": "ATTENDANCE_EVENT",
                        "event": event_res["eventTriggered"],
                        "employeeId": emp_id,
                        "name": det["name"],
                        "department": det["department"],
                        "cameraId": self.camera_id,
                        "cameraName": self.camera_name,
                        "cameraLocation": self.camera_location,
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
                    "cameraId": self.camera_id,
                    "cameraLocation": self.camera_location
                })
            else:
                unk_res = state_machine.process_unknown_detection(
                    face_crop_bgr=face_crop,
                    camera_id=self.camera_id,
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
                    "message": "Unknown face at gate terminal. Attendance NOT recorded.",
                    "cameraId": self.camera_id,
                    "cameraLocation": self.camera_location
                })

        self.last_detections = results

        return {
            "success": True,
            "isOnline": True,
            "status": "ONLINE",
            "cameraInfo": self.get_camera_info(),
            "facesCount": len(results),
            "detections": results,
            "timestamp": datetime.now().isoformat()
        }

    async def test_connection(self) -> Dict[str, Any]:
        """Accurately diagnoses API server, hardware stream freshness, and image brightness"""
        start_t = time.time()
        try:
            loop = asyncio.get_event_loop()
            path, img_bgr, jpeg_bytes = await loop.run_in_executor(None, self._fetch_latest_frame_sync)
            latency_ms = int((time.time() - start_t) * 1000)

            if img_bgr is not None and jpeg_bytes is not None:
                age_sec, age_str = self._format_age(self.last_frame_dt)
                recorded_time_str = self.last_frame_dt.strftime("%d-%b-%Y %I:%M:%S %p") if self.last_frame_dt else "N/A"

                # Accurate Diagnostic Messages
                if self.is_stale and self.is_dark:
                    status_code = "STALE_DARK"
                    message = (
                        f"⚠️ API Server is ONLINE ({latency_ms}ms), but Camera Hardware has NOT sent new frames recently "
                        f"(Last frame: {recorded_time_str}, {age_str}). The last frame is also pitch black. "
                        f"Please check camera Wi-Fi/4G connection and remove lens cover."
                    )
                elif self.is_stale:
                    status_code = "STALE"
                    message = (
                        f"⚠️ API Server connected ({latency_ms}ms), but Camera Hardware is currently IDLE "
                        f"(Last uploaded frame was {age_str} at {recorded_time_str})."
                    )
                elif self.is_dark:
                    status_code = "DARK"
                    message = (
                        f"⚠️ Live stream active ({latency_ms}ms), but camera image is pitch black (Brightness: {self.last_frame_brightness}). "
                        f"Ensure camera room lights are on and lens is not covered."
                    )
                else:
                    status_code = "ONLINE"
                    message = f"✓ Company gate IP camera connected and streaming live frames clearly. (Ping: {latency_ms}ms)"

                return {
                    "success": True,
                    "status": status_code,
                    "message": message,
                    "latencyMs": latency_ms,
                    "serverReachable": True,
                    "isHardwareStreaming": not self.is_stale,
                    "isStale": self.is_stale,
                    "isDark": self.is_dark,
                    "frameBrightness": self.last_frame_brightness,
                    "frameAge": age_str,
                    "frameRecordedAt": recorded_time_str,
                    "frameSize": f"{img_bgr.shape[1]}x{img_bgr.shape[0]}",
                    "latestFile": path,
                    "hasDaylightFallback": self.daylight_frame_bgr is not None,
                    "timestamp": datetime.now().isoformat()
                }
            else:
                return {
                    "success": False,
                    "status": "OFFLINE",
                    "message": "✕ Unable to retrieve frames from camera server gallery.",
                    "latencyMs": latency_ms,
                    "error": "No valid frame returned"
                }
        except Exception as e:
            return {
                "success": False,
                "status": "OFFLINE",
                "message": f"✕ Connection failed: {str(e)}",
                "error": str(e)
            }

def get_ip_camera_service() -> IPCameraService:
    return IPCameraService.get_instance()
