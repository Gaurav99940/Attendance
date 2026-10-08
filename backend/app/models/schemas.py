from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# ================= AUTH SCHEMAS =================
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class AdminCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "Admin"

# ================= EMPLOYEE SCHEMAS =================
class EmployeeBase(BaseModel):
    employeeId: str
    name: str
    department: str
    designation: str
    email: EmailStr
    mobile: str
    shiftId: Optional[str] = "shift_general"
    joiningDate: Optional[str] = None
    status: str = "Active"  # Active / Inactive

class EmployeeCreate(EmployeeBase):
    profilePhoto: Optional[str] = None
    password: Optional[str] = None

class PortalLoginRequest(BaseModel):
    employeeIdOrEmail: str
    password: str

class PasswordChangeRequest(BaseModel):
    oldPassword: Optional[str] = None
    newPassword: str

# ================= LEAVE MANAGEMENT SCHEMAS =================
class LeaveRequestCreate(BaseModel):
    leaveType: str = "Casual Leave"  # Casual Leave, Sick Leave, Paid Leave, Work From Home
    fromDate: str
    toDate: str
    reason: str

class LeaveRequestDoc(BaseModel):
    id: Optional[str] = None
    employeeId: str
    employeeName: str
    department: str
    leaveType: str
    fromDate: str
    toDate: str
    totalDays: float
    reason: str
    status: str = "PENDING"  # PENDING, APPROVED, REJECTED, CANCELLED
    adminComment: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class LeaveStatusUpdate(BaseModel):
    status: str  # APPROVED, REJECTED
    adminComment: Optional[str] = None
    adminRemarks: Optional[str] = None

class LeaveActionRequest(BaseModel):
    adminRemarks: Optional[str] = None
    adminComment: Optional[str] = None

# ================= REGULARIZATION SCHEMAS =================
class RegularizationCreate(BaseModel):
    date: str
    requestedInTime: str = "09:00 AM"
    requestedOutTime: str = "05:00 PM"
    reason: str

class RegularizationActionRequest(BaseModel):
    adminRemarks: Optional[str] = None
    adminComment: Optional[str] = None

class RegularizationDoc(BaseModel):
    id: Optional[str] = None
    employeeId: str
    employeeName: str
    department: str
    date: str
    requestedInTime: str
    requestedOutTime: str
    reason: str
    status: str = "PENDING"  # PENDING, APPROVED, REJECTED
    adminComment: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class RegularizationStatusUpdate(BaseModel):
    status: str  # APPROVED, REJECTED
    adminComment: Optional[str] = None


class EmployeeProfileUpdate(BaseModel):
    mobile: Optional[str] = None
    profilePhoto: Optional[str] = None

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[EmailStr] = None
    mobile: Optional[str] = None
    shiftId: Optional[str] = None
    joiningDate: Optional[str] = None
    status: Optional[str] = None
    profilePhoto: Optional[str] = None

class EmployeeResponse(EmployeeBase):
    id: Optional[str] = None
    profilePhoto: Optional[str] = None
    faceCount: Optional[int] = 0
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class NotificationDoc(BaseModel):
    id: Optional[str] = None
    employeeId: str
    title: str
    message: str
    type: str = "ATTENDANCE" # ATTENDANCE, LEAVE, REGULARIZATION, ANNOUNCEMENT, SYSTEM
    read: bool = False
    createdAt: str

class AnnouncementDoc(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    category: str = "General"  # General, Holiday, Policy, Urgent
    date: str
    createdBy: str = "HR Administration"
    createdAt: Optional[str] = None



# ================= FACE EMBEDDING SCHEMAS =================
class FaceEmbeddingDoc(BaseModel):
    employeeId: str
    embedding: List[float]
    imagePath: str
    angleLabel: Optional[str] = "front"
    createdAt: Optional[str] = None

class FaceUploadResponse(BaseModel):
    success: bool
    message: str
    faces_registered: int
    employeeId: str

# ================= SHIFT SCHEMAS =================
class ShiftBase(BaseModel):
    name: str
    startTime: str = "09:00 AM"  # "09:00 AM"
    endTime: str = "05:00 PM"    # "05:00 PM"
    requiredWorkingMinutes: int = 480  # 8 hours
    fullDayMinimumMinutes: int = 450   # 7.5 hours
    halfDayMinimumMinutes: int = 240   # 4.0 hours
    earlyExitGraceMinutes: int = 15
    lateGraceMinutes: int = 15
    overtimeThreshold: int = 510       # 8.5 hours
    department: Optional[str] = "All"
    active: bool = True

class ShiftCreate(ShiftBase):
    id: Optional[str] = None

class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    requiredWorkingMinutes: Optional[int] = None
    fullDayMinimumMinutes: Optional[int] = None
    halfDayMinimumMinutes: Optional[int] = None
    earlyExitGraceMinutes: Optional[int] = None
    lateGraceMinutes: Optional[int] = None
    overtimeThreshold: Optional[int] = None
    department: Optional[str] = None
    active: Optional[bool] = None

class ShiftResponse(ShiftBase):
    id: str

# ================= ATTENDANCE SCHEMAS =================
class AttendanceSessionDoc(BaseModel):
    sessionId: str
    sessionIndex: int = 1
    inTime: str
    outTime: Optional[str] = None
    durationMinutes: int = 0
    durationStr: str = "0h 0m"
    inVerificationImage: Optional[str] = None
    outVerificationImage: Optional[str] = None
    status: str = "ACTIVE"  # ACTIVE, COMPLETED

class AttendanceTimelineItem(BaseModel):
    time: str
    type: str  # "IN" or "OUT"
    sessionIndex: int = 1
    sessionId: Optional[str] = None
    image: Optional[str] = None
    remarks: Optional[str] = None

class AttendanceRecord(BaseModel):
    id: Optional[str] = None
    employeeId: str
    employeeName: str
    department: str
    date: str  # YYYY-MM-DD
    firstIn: Optional[str] = None
    lastOut: Optional[str] = None
    inTime: Optional[str] = None  # e.g., "09:12 AM" or ISO
    outTime: Optional[str] = None # e.g., "05:45 PM" or ISO
    currentStatus: Optional[str] = "NOT CHECKED IN" # INSIDE, OUTSIDE, NOT CHECKED IN
    totalSessions: Optional[int] = 0
    completedSessions: Optional[int] = 0
    workingDuration: Optional[str] = "0h 0m"
    workingMinutes: Optional[int] = 0
    totalWorkingMinutes: Optional[int] = 0
    totalOutsideMinutes: Optional[int] = 0
    totalOutsideHours: Optional[str] = "0h 0m"
    expectedIn: Optional[str] = "10:30 AM"
    expectedOut: Optional[str] = "06:00 PM"
    lateBy: Optional[int] = 0  # minutes
    earlyExitBy: Optional[int] = 0 # minutes
    status: str = "INCOMPLETE"  # FULL DAY, HALF DAY, ABSENT, LATE, ON LEAVE, HOLIDAY, WEEKEND, INCOMPLETE
    sessions: List[AttendanceSessionDoc] = []
    timeline: List[AttendanceTimelineItem] = []
    verificationImage: Optional[str] = None
    outVerificationImage: Optional[str] = None
    remarks: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class ManualAttendanceRequest(BaseModel):
    employeeId: str
    date: str
    inTime: Optional[str] = None
    outTime: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    sessions: Optional[List[Dict[str, Any]]] = None

# ================= UNKNOWN DETECTION SCHEMAS =================
class UnknownDetectionDoc(BaseModel):
    id: Optional[str] = None
    capturedImage: str
    detectedAt: str
    confidence: float
    cameraId: str
    reviewed: bool = False

# ================= AUDIT LOG SCHEMAS =================
class AuditLogDoc(BaseModel):
    id: Optional[str] = None
    action: str
    performedBy: str
    entityType: str
    entityId: str
    details: Dict[str, Any]
    timestamp: str

# ================= SETTINGS SCHEMAS =================
class SystemSettingsModel(BaseModel):
    faceConfidenceThreshold: float = 0.62
    detectionCooldownSeconds: int = 20
    sessionTimeoutMinutes: int = 480
    organizationName: str = "SmartCorp Technologies Pvt Ltd"
    timeZone: str = "Asia/Kolkata"
    dateFormat: str = "YYYY-MM-DD"
    timeFormat: str = "12 Hours (AM/PM)"
    autoInTimeWindowStart: str = "06:00 AM"
    autoOutTimeWindowStart: str = "02:00 PM"
    cameraSources: List[Dict[str, Any]] = [
        {"id": "cam_main", "name": "Main Entrance Camera", "type": "browser", "url": "", "active": True},
        {"id": "cam_exit", "name": "Exit Turnstile Camera", "type": "browser", "url": "", "active": True}
    ]

# ================= REAL-TIME CAMERA SCHEMAS =================
class FrameInferenceRequest(BaseModel):
    image: str  # Base64 data URL
    cameraId: Optional[str] = "cam_main"
    mode: Optional[str] = "AUTO"  # AUTO, IN_ONLY, OUT_ONLY

class DetectedFaceResult(BaseModel):
    box: List[int]  # [x, y, w, h]
    employeeId: Optional[str] = None
    name: Optional[str] = "Unknown Person"
    department: Optional[str] = ""
    designation: Optional[str] = ""
    profilePhoto: Optional[str] = ""
    confidence: float = 0.0
    isRecognized: bool = False
    eventTriggered: Optional[str] = None  # "IN", "OUT", "COOLDOWN", "DUPLICATE", None
    attendanceStatus: Optional[str] = None
    time: Optional[str] = None
    message: Optional[str] = None
