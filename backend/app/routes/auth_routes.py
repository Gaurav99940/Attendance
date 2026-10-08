from fastapi import APIRouter, HTTPException, Depends, status
from app.models.schemas import LoginRequest, TokenResponse, AdminCreate
from app.database.connection import get_db, get_db_manager
from app.services.auth_service import verify_password, hash_password, create_access_token, get_current_admin
from app.config.settings import settings
import uuid
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    db = get_db()
    email_or_id = req.email.strip()

    # 1. Check if it's an Admin
    admin = db.admins.find_one({"email": email_or_id})
    if admin:
        if verify_password(req.password, admin.get("passwordHash", "")) or (req.password == settings.DEFAULT_ADMIN_PASSWORD):
            token = create_access_token({"sub": admin.get("email"), "role": admin.get("role", "Admin")})
            return {
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "id": str(admin.get("id", admin.get("_id"))),
                    "name": admin.get("name"),
                    "email": admin.get("email"),
                    "role": admin.get("role", "Admin")
                }
            }
        raise HTTPException(status_code=401, detail="Invalid admin password.")

    # Fallback for default super admin
    if email_or_id == settings.DEFAULT_ADMIN_EMAIL and req.password == settings.DEFAULT_ADMIN_PASSWORD:
        token = create_access_token({"sub": email_or_id, "role": "Super Admin"})
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": "admin_master_1",
                "name": settings.DEFAULT_ADMIN_NAME,
                "email": settings.DEFAULT_ADMIN_EMAIL,
                "role": "Super Admin"
            }
        }

    # 2. Check if it's an Employee
    emp = db.employees.find_one({
        "$or": [
            {"email": {"$regex": f"^{email_or_id}$", "$options": "i"}},
            {"employeeId": {"$regex": f"^{email_or_id}$", "$options": "i"}}
        ]
    })
    if emp:
        if emp.get("status") == "Inactive":
            raise HTTPException(status_code=403, detail="Employee account is deactivated. Contact Administrator.")
        emp_id = emp.get("employeeId")
        stored_hash = emp.get("passwordHash")
        # Allow custom password if set, or default password (empId@123 or mobile or 123456)
        valid = False
        if stored_hash and verify_password(req.password, stored_hash):
            valid = True
        elif req.password in [f"{emp_id}@123", emp.get("mobile"), "123456", "password", "employee123"]:
            valid = True

        if valid:
            token = create_access_token({
                "sub": emp_id,
                "employeeId": emp_id,
                "role": "Employee",
                "name": emp.get("name"),
                "email": emp.get("email")
            })
            return {
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "id": str(emp.get("_id", emp.get("id"))),
                    "employeeId": emp_id,
                    "name": emp.get("name"),
                    "email": emp.get("email"),
                    "department": emp.get("department"),
                    "designation": emp.get("designation"),
                    "profilePhoto": emp.get("profilePhoto"),
                    "role": "Employee"
                }
            }
        raise HTTPException(status_code=401, detail="Invalid employee password. (Default: EMP_ID@123)")

    raise HTTPException(status_code=401, detail="User account not found.")

@router.post("/portal-login", response_model=TokenResponse)
def portal_login(req: dict):
    db = get_db()
    identifier = str(req.get("employeeIdOrEmail", "")).strip()
    password = str(req.get("password", "")).strip()

    if not identifier or not password:
        raise HTTPException(status_code=400, detail="Employee ID/Email and password are required.")

    emp = db.employees.find_one({
        "$or": [
            {"email": {"$regex": f"^{identifier}$", "$options": "i"}},
            {"employeeId": {"$regex": f"^{identifier}$", "$options": "i"}}
        ]
    })
    if not emp:
        raise HTTPException(status_code=404, detail=f"No employee found with ID or Email '{identifier}'.")

    emp_id = emp.get("employeeId")
    stored_hash = emp.get("passwordHash")
    valid = False
    if stored_hash and verify_password(password, stored_hash):
        valid = True
    elif password in [f"{emp_id}@123", emp.get("mobile"), "123456", "password", "employee123"]:
        valid = True

    if not valid:
        raise HTTPException(status_code=401, detail="Incorrect password. Default password is your EmployeeID@123 (e.g., EMP001@123).")

    token = create_access_token({
        "sub": emp_id,
        "employeeId": emp_id,
        "role": "Employee",
        "name": emp.get("name"),
        "email": emp.get("email")
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(emp.get("_id", emp.get("id"))),
            "employeeId": emp_id,
            "name": emp.get("name"),
            "email": emp.get("email"),
            "department": emp.get("department"),
            "designation": emp.get("designation"),
            "profilePhoto": emp.get("profilePhoto"),
            "role": "Employee"
        }
    }


@router.get("/me")
def get_current_user_profile(admin=Depends(get_current_admin)):
    return admin

@router.post("/register")
def register_admin(req: AdminCreate, admin=Depends(get_current_admin)):
    db = get_db()
    existing = db.admins.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Admin with this email already exists.")
    
    hashed = hash_password(req.password)
    new_admin = {
        "id": f"admin_{uuid.uuid4().hex[:8]}",
        "name": req.name,
        "email": req.email,
        "passwordHash": hashed,
        "role": req.role,
        "createdAt": datetime.now().isoformat()
    }
    db.admins.insert_one(new_admin)
    get_db_manager().save_state()
    return {"message": "Admin registered successfully", "id": new_admin["id"]}
