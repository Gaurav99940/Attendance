# SmartFace — Enterprise AI Employee Attendance Management Platform

A complete, production-grade, full-stack biometric attendance management platform powered by **PyTorch FaceNet (InceptionResnetV1)**, **OpenCV / MTCNN**, **FastAPI**, **MongoDB**, **WebSockets**, and **React (Vite + Tailwind CSS)**.

---

## 🌟 Key Features

1. **AI Face Recognition Pipeline**:
   - High-accuracy 512-dimensional biometric facial embedding generation using PyTorch `InceptionResnetV1` (pretrained on VGGFace2).
   - Real-time face detection and multi-angle alignment using `MTCNN`.
   - Vector similarity matching with cosine metric and configurable confidence thresholds.
   - Multi-face detection per frame with individual bounding boxes and names.

2. **Automatic IN / OUT Attendance Logic**:
   - State machine tracking: `OUTSIDE` → `ENTERING` → `INSIDE` → `EXITING`.
   - **Duplicate Attendance Prevention**: Detection cooldown period prevents false double-punches.
   - **Working Duration Calculation**: Exact mathematical elapsed time calculation (`OUT Time - IN Time`).
   - **Shift Rules & Grace Periods**: Fully configurable Shift Start, Shift End, Late Arrival Grace Period, Early Exit Grace Period, Full-Day Minimum Duration, Half-Day Minimum Duration, and Overtime Thresholds.
   - Dynamic Status Calculation: `FULL DAY`, `HALF DAY`, `LATE`, `ABSENT`, `ON LEAVE`, `WEEKEND`, `INCOMPLETE`.
   - Automatic Verification Image Snapshots captured and attached to every punch.

3. **Real-Time Live Updates**:
   - Low-latency WebSocket broadcasting (`/ws`) for instantaneous dashboard KPI updates, live activity stream entries, and visual/sound chimes.

4. **Comprehensive Admin Dashboard**:
   - 8 Core KPI metric tiles (Total Employees, Present Today, Absent Today, Late Today, Currently Inside, Half Day, On Leave, Total Working Hours).
   - Real-Time Recent Attendance Activity feed.
   - Department-wise attendance breakdown and 7-day attendance trends.
   - Built-in AI Punch Simulator for testing any staff member with one click.

5. **Employee Management**:
   - Full CRUD operations, department filters, and status toggles.
   - Multi-angle face image capture from webcam or file upload (Front, Left Angle, Right Angle, Smile).
   - Detailed Employee Profile with 30-day KPI attendance summaries and interactive monthly calendar.

6. **Searchable & Filterable Attendance History**:
   - Filter by Date Range, Employee, Department, and Status.
   - Click to inspect AI verification image snapshots.
   - Manual attendance override with administrative audit logs.
   - 1-Click Export to CSV and Excel.

7. **Monthly Attendance Calendar**:
   - Interactive company-wide or employee-specific grid.
   - Day-status badges and popup inspector for punch times, working durations, and verification photos.

8. **Reports & Exports**:
   - Daily, Weekly, Monthly, Late Arrivals, Absenteeism, and Department-wise reports.
   - Instant CSV and Excel exports powered by pandas and openpyxl.

9. **Unknown Person Detections**:
   - Review captures of unidentified faces with camera ID and timestamp.
   - 1-Click assignment to enroll unknown captures into employee biometric profiles.

10. **Pre-Seeded Realistic Demo Data**:
    - 20 diverse employees across Engineering, HR, Sales, Design, Marketing, Finance, Operations, Legal, and Customer Success.
    - 30-day realistic historical attendance records (including on-time punches, late arrivals, half days, approved leaves, and weekend schedules).

---

## 🛠️ Technology Stack

- **Backend**: Python 3.13+, FastAPI, PyMongo / MongoMock, Uvicorn, WebSockets, PyJWT, Bcrypt, Pandas, OpenPyXL.
- **Computer Vision**: PyTorch, TorchVision, FaceNet-PyTorch (`InceptionResnetV1`, `MTCNN`), OpenCV, NumPy, Pillow.
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Recharts, Axios, React Router v7.
- **Database**: MongoDB (with automatic embedded fallback storage in `data/` if MongoDB server is offline).

---

## 🚀 Getting Started

### 1. Backend Setup
```bash
cd backend
python -m pip install -r requirements.txt # or fastapi uvicorn pymongo facenet-pytorch torch torchvision opencv-python pandas openpyxl bcrypt PyJWT mongomock
python main.py
```
*Backend runs on `http://localhost:8000` (API documentation at `http://localhost:8000/docs`).*

### 2. Frontend Setup (Development Mode)
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 🔑 Default Administrator Credentials

- **Email**: `admin@smartface.com`
- **Password**: `admin123`
*(Or click **"1-Click Demo Sign In"** on the login page)*

---

## 📡 Key REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Admin authentication & JWT issue |
| `GET` | `/api/dashboard/stats` | Real-time live KPI statistics |
| `GET` | `/api/employees` | List employees with filters & face count |
| `POST` | `/api/employees` | Create new employee profile |
| `POST` | `/api/employees/{id}/faces` | Upload multi-angle face images & extract 512-D embeddings |
| `GET` | `/api/attendance` | Searchable & filterable attendance history |
| `POST` | `/api/camera/process-frame` | Real-time camera frame inference & state machine trigger |
| `POST` | `/api/camera/simulate-punch` | Simulate camera walk-in for testing |
| `GET` | `/api/attendance/calendar` | Monthly calendar aggregation |
| `GET` | `/api/reports` | Analytics report generation |
| `GET` | `/api/reports/export/csv` | Download CSV report |
| `GET` | `/api/reports/export/excel` | Download Excel report |
| `GET` | `/api/settings/shifts` | Shift timings & grace period rules |
| `POST` | `/api/settings/seed-demo` | Reseed 20 demo staff & 30-day records |
| `WS` | `/ws` | Real-time WebSocket event broadcaster |
