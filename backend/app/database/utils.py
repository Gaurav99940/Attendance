from bson import ObjectId
from typing import Dict, Any, List, Optional

def query_by_id(id_val: Any, additional_id_fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Builds a MongoDB query dictionary that safely matches a document by its primary identifier:
    - BSON ObjectId (_id: ObjectId(id_val)) when id_val is a valid 24-char hex string
    - String _id (_id: id_val)
    - Custom 'id' field (id: id_val)
    - Any additional custom ID fields (e.g. 'leaveRequestId', 'regId', 'employeeId')
    """
    if id_val is None:
        return {"_id": None}

    id_str = str(id_val).strip()
    clauses: List[Dict[str, Any]] = [
        {"id": id_str},
        {"_id": id_str}
    ]

    if additional_id_fields:
        for field in additional_id_fields:
            clauses.append({field: id_str})

    if ObjectId.is_valid(id_str):
        try:
            clauses.append({"_id": ObjectId(id_str)})
        except Exception:
            pass

    return {"$or": clauses}
