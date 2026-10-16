"""AI 相关请求模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class PolishRequest(BaseModel):
    record_id: int = Field(..., description="心电记录主键 id")


class DiagnosisRequest(BaseModel):
    record_id: int = Field(..., description="心电记录主键 id")


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
