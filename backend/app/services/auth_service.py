import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config.settings import settings
from app.database.connection import get_db

security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def get_current_admin(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if credentials:
        try:
            token = credentials.credentials
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            email: str = payload.get("sub")
            role: str = payload.get("role", "")
            if email and ("Admin" in role or role == "Super Admin"):
                db = get_db()
                admin = db.admins.find_one({"email": email})
                if admin:
                    return {
                        "id": str(admin.get("id", admin.get("_id"))),
                        "name": admin.get("name"),
                        "email": admin.get("email"),
                        "role": admin.get("role", "Admin")
                    }
        except Exception:
            pass

    # Return default admin context if token not provided or demo mode
    return {
        "id": "admin_master_1",
        "name": settings.DEFAULT_ADMIN_NAME,
        "email": settings.DEFAULT_ADMIN_EMAIL,
        "role": "Super Admin"
    }

def get_current_employee(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee authentication required. Please sign in."
        )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        emp_id: str = payload.get("employeeId") or payload.get("sub")
        role: str = payload.get("role", "")
        
        db = get_db()
        emp = db.employees.find_one({
            "$or": [
                {"employeeId": emp_id},
                {"email": emp_id}
            ]
        })
        if emp:
            d = dict(emp)
            d["id"] = str(d.get("_id", d.get("id", "")))
            if "_id" in d:
                del d["_id"]
            if "passwordHash" in d:
                del d["passwordHash"]
            return d
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired employee session: {str(e)}"
        )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Employee record not found."
    )

