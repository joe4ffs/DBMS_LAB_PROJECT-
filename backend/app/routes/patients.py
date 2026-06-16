from fastapi import APIRouter
from app.database import supabase

router = APIRouter()


@router.get("")
async def list_patients(search: str = ""):
    q = supabase.table("patient").select("*").order("full_name")
    if search:
        q = q.ilike("full_name", f"%{search}%")
    result = q.execute()
    return result.data or []


@router.get("/{patient_id}/adherence")
async def get_patient_adherence(patient_id: int):
    result = supabase.table("doselog") \
        .select("status") \
        .eq("patient_id", patient_id) \
        .neq("status", "pending") \
        .execute()
    data = result.data or []
    total  = len(data)
    taken  = sum(1 for d in data if d["status"] == "taken")
    missed = sum(1 for d in data if d["status"] == "missed")
    pct    = round((taken / total) * 100) if total > 0 else 0
    return {"total": total, "taken": taken, "missed": missed, "pct": pct}
