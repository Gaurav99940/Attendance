from fastapi import APIRouter, Depends
from typing import List
from app.database.connection import get_db
from app.services.auth_service import get_current_admin

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

@router.get("")
def get_audit_logs(limit: int = 100, admin=Depends(get_current_admin)):
    db = get_db()
    logs = list(db.audit_logs.find({}).sort("timestamp", -1).limit(limit))
    results = []
    for l in logs:
        d = dict(l)
        d["id"] = str(d.get("_id", d.get("id", "")))
        if "_id" in d:
            del d["_id"]
        results.append(d)
    return results
