import os
import uvicorn
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.config.settings import settings
from app.database.connection import DatabaseManager, get_db
from app.face_recognition.engine import get_face_engine
from app.services.seed_service import seed_database

# Routes
from app.routes.auth_routes import router as auth_router
from app.routes.employee_routes import router as employee_router
from app.routes.attendance_routes import router as attendance_router
from app.routes.camera_routes import router as camera_router
from app.routes.dashboard_routes import router as dashboard_router
from app.routes.report_routes import router as report_router
from app.routes.settings_routes import router as settings_router
from app.routes.unknown_routes import router as unknown_router
from app.routes.audit_routes import router as audit_router
from app.routes.employee_portal_routes import router as portal_router
from app.routes.leave_routes import router as leave_router
from app.routes.websocket_routes import router as ws_router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("smartface.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SmartFace Attendance Management Platform...")
    # Initialize DB
    db_mgr = DatabaseManager.get_instance()
    db = db_mgr.db
    
    # Ensure admin account and default shifts exist
    admin_count = db.admins.count_documents({})
    if admin_count == 0:
        import bcrypt
        pwd_bytes = settings.DEFAULT_ADMIN_PASSWORD.encode('utf-8')
        hashed = bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode('utf-8')
        db.admins.insert_one({
            "id": "admin_master_1",
            "name": settings.DEFAULT_ADMIN_NAME,
            "email": settings.DEFAULT_ADMIN_EMAIL,
            "passwordHash": hashed,
            "role": "Super Admin",
            "createdAt": "2026-01-01T00:00:00"
        })
    
    if db.shifts.count_documents({}) == 0:
        from app.services.clean_service import DEFAULT_SHIFTS
        for s in DEFAULT_SHIFTS:
            db.shifts.update_one({"id": s["id"]}, {"$set": s}, upsert=True)

    # Initialize Face Recognition Engine & Cache
    engine = get_face_engine()
    engine.load_embeddings_from_db(db)
    logger.info("Face Recognition Engine initialized and ready.")

    yield
    logger.info("Shutting down SmartFace platform...")
    db_mgr.save_state()

app = FastAPI(
    title="SmartFace Attendance Management API",
    version=settings.VERSION,
    description="Enterprise Face Recognition Attendance Platform with Real-time Camera Analytics",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded static media (avatars, face registrations, verification snapshots)
uploads_dir = settings.UPLOAD_DIR
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Mount API Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(employee_router, prefix=settings.API_V1_STR)
app.include_router(attendance_router, prefix=settings.API_V1_STR)
app.include_router(camera_router, prefix=settings.API_V1_STR)
app.include_router(dashboard_router, prefix=settings.API_V1_STR)
app.include_router(report_router, prefix=settings.API_V1_STR)
app.include_router(settings_router, prefix=settings.API_V1_STR)
app.include_router(unknown_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)
app.include_router(portal_router, prefix=settings.API_V1_STR)
app.include_router(leave_router, prefix=settings.API_V1_STR)
app.include_router(ws_router)


@app.get("/api/health")
def health_check():
    db = get_db()
    emp_count = db.employees.count_documents({})
    att_count = db.attendance.count_documents({})
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "databaseEmployees": emp_count,
        "attendanceRecords": att_count,
        "visionDevice": "CPU/FaceNet-PyTorch"
    }

# Mount React Frontend Build (Single-Port Production Deployment)
frontend_dist = os.path.join(os.path.dirname(settings.BASE_DIR), "frontend", "dist")
if not os.path.exists(frontend_dist):
    frontend_dist = os.path.join(settings.BASE_DIR, "..", "frontend", "dist")

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_frontend(full_path: str):
        if full_path.startswith("api") or full_path.startswith("uploads") or full_path.startswith("ws"):
            return None
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
