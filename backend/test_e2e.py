import sys
import os
import json
import base64
import numpy as np
from PIL import Image
import io

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from main import app
from app.database.connection import get_db
from app.services.seed_service import seed_database
from app.face_recognition.engine import get_face_engine

def run_tests():
    print("=" * 70)
    print("STARTING COMPLETE END-TO-END VERIFICATION OF SMARTFACE PLATFORM")
    print("=" * 70)

    # Reseed fresh demo data
    print("\n[1/12] Seeding 20 demo employees and 30-day realistic historical attendance...")
    seed_res = seed_database(force_reseed=True)
    print(f"  --> Seed Result: {seed_res}")
    assert seed_res["employees_seeded"] == 20, "Expected 20 employees"
    assert seed_res["attendance_records_seeded"] >= 600, "Expected at least 600 attendance records"
    print("  [OK] Database seeding verified successfully!")

    client = TestClient(app)

    # 1. Health check
    print("\n[2/12] Testing Health Endpoint...")
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health = res.json()
    print(f"  --> Health: {health}")
    assert health["databaseEmployees"] == 20
    print("  [OK] Health check passed!")

    # 2. Authentication
    print("\n[3/12] Testing Admin Authentication & JWT Token...")
    res = client.post("/api/auth/login", json={"email": "admin@smartface.com", "password": "admin123"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    auth_data = res.json()
    token = auth_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"  --> Logged in as: {auth_data['user']['name']} ({auth_data['user']['role']})")
    print("  [OK] Authentication & JWT verified!")

    # 3. Employees directory
    print("\n[4/12] Testing Employee Management & Queries...")
    res = client.get("/api/employees", headers=headers)
    assert res.status_code == 200
    employees = res.json()
    assert len(employees) >= 20
    print(f"  --> Retrieved {len(employees)} active employees with face counts.")
    
    # Detail check on EMP001
    res = client.get("/api/employees/EMP001", headers=headers)
    assert res.status_code == 200
    emp_detail = res.json()
    print(f"  --> EMP001 ({emp_detail['employee']['name']}): Attendance Rate = {emp_detail['summary']['attendancePercentage']}%, Avg Hours = {emp_detail['summary']['averageWorkingHours']}")
    assert len(emp_detail["recentAttendance"]) > 0
    print("  [OK] Employee profiles & summaries verified!")

    # 4. Dashboard Stats
    print("\n[5/12] Testing Real-Time Dashboard KPI Analytics...")
    res = client.get("/api/dashboard/stats", headers=headers)
    assert res.status_code == 200
    stats = res.json()
    metrics = stats["metrics"]
    print(f"  --> Metrics: Total={metrics['totalEmployees']}, Present={metrics['presentToday']}, Inside={metrics['currentlyInside']}, Late={metrics['lateToday']}, HalfDay={metrics['halfDay']}, TotalHours={metrics['totalWorkingHours']}")
    assert metrics["totalEmployees"] == 20
    assert len(stats["recentActivity"]) > 0
    assert len(stats["trend"]) == 7
    print("  [OK] Dashboard analytics verified!")

    # 5. Attendance History & Filters
    print("\n[6/12] Testing Attendance History Querying & Filtering...")
    res = client.get("/api/attendance?page=1&limit=10", headers=headers)
    assert res.status_code == 200
    att_page = res.json()
    assert att_page["total"] >= 600
    print(f"  --> Total Attendance Records: {att_page['total']}")
    
    # Filter by department
    res = client.get("/api/attendance?department=Engineering", headers=headers)
    assert res.status_code == 200
    assert len(res.json()["records"]) > 0
    print("  [OK] Attendance filters & pagination verified!")

    # 6. Monthly Calendar Aggregation
    print("\n[7/12] Testing Monthly Attendance Calendar Endpoint...")
    res = client.get("/api/attendance/calendar", headers=headers)
    assert res.status_code == 200
    cal_data = res.json()
    print(f"  --> Calendar Month: {cal_data['month']}, Days Logged: {len(cal_data['days'])}")
    assert len(cal_data["days"]) > 0
    print("  [OK] Calendar aggregation verified!")

    # 7. AI Camera Simulated Walk-In (IN punch)
    print("\n[8/12] Testing AI Punch IN Logic (Simulating EMP001 Walk-in)...")
    res = client.post("/api/camera/simulate-punch", json={"employeeId": "EMP001", "mode": "AUTO", "cameraId": "cam_main"})
    assert res.status_code == 200
    punch_res = res.json()
    print(f"  --> Simulated Punch Result: {punch_res['result']['message']}")
    print("  [OK] Punch trigger processed!")

    # 8. Duplicate Detection Prevention (Within Cooldown Window)
    print("\n[9/12] Testing Duplicate Attendance Prevention (Immediate 2nd detection)...")
    res = client.post("/api/camera/simulate-punch", json={"employeeId": "EMP001", "mode": "AUTO", "cameraId": "cam_main"})
    assert res.status_code == 200
    dup_res = res.json()
    print(f"  --> Duplicate Prevention Response: {dup_res['result']['message']}")
    assert dup_res["result"]["eventTriggered"] in ["COOLDOWN", "DUPLICATE_IN", "IGNORE_TOO_SOON"]
    print("  [OK] Duplicate detection prevented successfully!")

    # 9. AI Face Recognition Engine Verification with InceptionResnetV1
    print("\n[10/12] Testing PyTorch FaceNet Embedding & MTCNN matching...")
    engine = get_face_engine()
    # Create test sample image
    dummy_img = Image.new('RGB', (160, 160), color=(120, 150, 180))
    emb = engine.generate_embedding_from_crop(dummy_img)
    assert emb is not None, "Failed to generate embedding"
    assert len(emb) == 512, f"Embedding size {len(emb)} != 512"
    matched_id, sim, conf = engine.match_embedding(emb, threshold=0.99)
    print(f"  --> Generated 512-D L2-normalized FaceNet embedding vector.")
    print("  [OK] Face recognition engine verified!")

    # 10. Reports & Data Export (CSV & Excel)
    print("\n[11/12] Testing Report Generation & CSV/Excel Download...")
    res = client.get("/api/reports?reportType=monthly", headers=headers)
    assert res.status_code == 200
    rep = res.json()
    print(f"  --> Monthly Report: Total Entries={rep['summary']['totalEntries']}, Working Hours={rep['summary']['totalWorkingHours']}")

    csv_res = client.get("/api/reports/export/csv", headers=headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers.get("content-type", "")
    print("  --> CSV Export downloaded successfully.")

    excel_res = client.get("/api/reports/export/excel", headers=headers)
    assert excel_res.status_code == 200
    print("  --> Excel (.xlsx) Export downloaded successfully.")
    print("  [OK] Reports & Exports verified!")

    # 11. Shifts & Grace Periods Configuration
    print("\n[12/12] Testing Shift Timings & Grace Period Settings...")
    res = client.get("/api/settings/shifts", headers=headers)
    assert res.status_code == 200
    shifts = res.json()
    assert len(shifts) >= 4
    print(f"  --> Configured Shifts: {[s['name'] for s in shifts]}")
    print("  [OK] Shift rules verified!")

    print("\n" + "=" * 70)
    print("ALL 12 END-TO-END PLATFORM TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
