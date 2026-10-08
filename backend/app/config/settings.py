import os
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv

# Load .env file from project root or backend folder
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(base_dir, ".env"))
load_dotenv(os.path.join(os.path.dirname(base_dir), ".env"))

class Settings(BaseModel):
    PROJECT_NAME: str = "SmartFace Attendance Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # MongoDB Connection (Supports Local MongoDB or MongoDB Atlas mongodb+srv://...)
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    DB_NAME: str = os.getenv("DB_NAME", "smart_attendance")
    
    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "smart_attendance_secret_jwt_key_2026_prod")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Face Recognition
    FACE_CONFIDENCE_THRESHOLD: float = float(os.getenv("FACE_CONFIDENCE_THRESHOLD", "0.62"))
    DETECTION_COOLDOWN_SECONDS: int = int(os.getenv("DETECTION_COOLDOWN_SECONDS", "15"))
    SESSION_TIMEOUT_MINUTES: int = int(os.getenv("SESSION_TIMEOUT_MINUTES", "480"))
    
    # Storage
    BASE_DIR: str = base_dir
    UPLOAD_DIR: str = os.path.join(base_dir, "uploads")
    DATA_DIR: str = os.path.join(base_dir, "data")
    
    # Default Admin
    DEFAULT_ADMIN_EMAIL: str = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@smartface.com")
    DEFAULT_ADMIN_PASSWORD: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
    DEFAULT_ADMIN_NAME: str = os.getenv("DEFAULT_ADMIN_NAME", "Chief Administrator")

settings = Settings()

# Ensure directories exist
os.makedirs(os.path.join(settings.UPLOAD_DIR, "faces"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "verification"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "unknown"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "avatars"), exist_ok=True)
os.makedirs(settings.DATA_DIR, exist_ok=True)
