from fastapi import APIRouter
from app.database import supabase

router = APIRouter()


@router.get("/interactions")
async def get_all_interactions():
    result = supabase.table("druginteraction") \
        .select("severity, warning_message, medicine1_id, medicine2_id") \
        .order("severity") \
        .execute()
    return result.data or []


@router.get("/interactions/check")
async def check_interaction(m1: int, m2: int):
    result = supabase.table("druginteraction") \
        .select("severity, warning_message") \
        .or_(f"and(medicine1_id.eq.{m1},medicine2_id.eq.{m2}),and(medicine1_id.eq.{m2},medicine2_id.eq.{m1})") \
        .execute()
    return result.data or []


@router.get("/allergies")
async def get_all_allergies():
    result = supabase.table("patientallergy") \
        .select("noted_date, patient(full_name), allergy(allergy_name)") \
        .order("noted_date", desc=True) \
        .execute()
    return result.data or []


@router.get("/allergies/check")
async def check_allergy_conflict(patient_id: int, medicine_id: int):
    allergies = supabase.table("patientallergy") \
        .select("allergy_id") \
        .eq("patient_id", patient_id) \
        .execute()

    if not allergies.data:
        return []

    allergy_ids = [a["allergy_id"] for a in allergies.data]
    conflicts = supabase.table("medicineallergyconflict") \
        .select("reaction, severity, allergy_id, allergy(allergy_name)") \
        .eq("medicine_id", medicine_id) \
        .in_("allergy_id", allergy_ids) \
        .execute()

    return conflicts.data or []
