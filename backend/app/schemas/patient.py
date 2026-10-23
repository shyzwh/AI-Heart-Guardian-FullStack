"""患者档案请求/响应模型。"""
from __future__ import annotations

import datetime as dt
from typing import Literal, Optional

from pydantic import BaseModel, Field

Gender = Literal["男", "女", "未指定"]


class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    gender: Gender = "未指定"
    age: int | None = Field(default=None, ge=0, le=120)
    birth_date: str = Field(default="", max_length=16)
    height_cm: float | None = Field(default=None, ge=0, le=300)
    weight_kg: float | None = Field(default=None, ge=0, le=500)
    past_history: list[str] = Field(default_factory=list)
    medication: str = Field(default="", max_length=512)
    note: str = Field(default="", max_length=1024)
    # 可绑定已注册的患者账号 id（可选）
    user_id: int | None = None
    patient_username: Optional[str] = None


class PatientUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=64)
    gender: Gender | None = None
    age: int | None = Field(default=None, ge=0, le=120)
    birth_date: str | None = Field(default=None, max_length=16)
    height_cm: float | None = Field(default=None, ge=0, le=300)
    weight_kg: float | None = Field(default=None, ge=0, le=500)
    past_history: list[str] | None = None
    medication: str | None = Field(default=None, max_length=512)
    note: str | None = Field(default=None, max_length=1024)
    user_id: int | None = None
    patient_username: Optional[str] = None


class PatientOut(BaseModel):
    id: int
    user_id: int | None
    doctor_id: int
    name: str
    gender: str
    age: int | None
    birth_date: str
    height_cm: float | None
    weight_kg: float | None
    past_history: list[str]
    medication: str
    note: str
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}
