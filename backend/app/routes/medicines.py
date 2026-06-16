from fastapi import APIRouter
from app.database import supabase

router = APIRouter()


@router.get("/medicines")
async def get_medicines():
    result = supabase.table("medicine") \
        .select("medicine_id, generic_name, brand_name") \
        .order("generic_name") \
        .execute()
    return result.data or []
