from pydantic import BaseModel
from typing import Optional


class RecoveryLogIn(BaseModel):
    patient_id: int
    log_date: str
    symptom_score: int
    recovery_score: int
    notes: Optional[str] = None


class SideEffectIn(BaseModel):
    patient_id: int
    medicine_id: int
    effect_name: str
    severity: str
    notes: Optional[str] = None
