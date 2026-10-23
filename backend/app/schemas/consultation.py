"""Consultation request schemas."""
from pydantic import BaseModel, Field


class ConsultationCreate(BaseModel):
    patient_id: int | None = Field(default=None, gt=0)
