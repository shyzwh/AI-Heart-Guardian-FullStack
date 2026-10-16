"""康养相关请求/响应模型。"""
from __future__ import annotations

import datetime as dt
from typing import Literal, Optional

from pydantic import BaseModel, Field

# ---------- 紧急联系人 ----------

class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    relation: str = Field("", max_length=32)
    phone: str = Field(..., min_length=3, max_length=32)
    is_primary: bool = False
    patient_id: Optional[int] = None  # 未登录时不传，走 device_key


class ContactOut(BaseModel):
    id: int
    patient_id: Optional[int] = None
    device_key: str
    name: str
    relation: str
    phone: str
    is_primary: bool
    created_at: dt.datetime

    model_config = {"from_attributes": True}


class SosRequest(BaseModel):
    device_key: str = Field("", max_length=64)
    patient_id: Optional[int] = None  # 登录患者可带


# ---------- 健康打卡 ----------

class CheckInCreate(BaseModel):
    patient_id: int
    checkin_date: Optional[dt.date] = None  # 不传则取当天
    symptoms: str = Field("", max_length=1000)
    symptom_tags: list[str] = Field(default_factory=list)
    heart_rate: Optional[int] = Field(default=None, ge=20, le=250)
    blood_pressure: str = Field("", max_length=32)
    mood: str = Field("", max_length=32)
    note: str = Field("", max_length=500)


class CheckInOut(BaseModel):
    id: int
    patient_id: int
    checkin_date: dt.date
    symptoms: str
    symptom_tags: Optional[list[str]] = None
    heart_rate: Optional[int] = None
    blood_pressure: str
    mood: str
    note: str
    created_at: dt.datetime

    model_config = {"from_attributes": True}


# ---------- 康复方案 ----------

class RehabGenerateRequest(BaseModel):
    patient_id: int
    ecg_record_id: Optional[int] = None  # 不传则取该患者最新记录


class RehabOut(BaseModel):
    id: int
    patient_id: int
    ecg_record_id: Optional[int] = None
    risk_level: str
    exercise_type: str
    intensity: str
    duration_min: int
    frequency: str
    guidance: str
    cautions: str
    created_at: dt.datetime

    model_config = {"from_attributes": True}


# ---------- 随访 ----------

class FollowUpCreate(BaseModel):
    patient_id: int
    ecg_record_id: Optional[int] = None
    due_date: Optional[dt.datetime] = None
    content: str = Field("", max_length=500)


class FollowUpOut(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    ecg_record_id: Optional[int] = None
    due_date: Optional[dt.datetime] = None
    status: str
    content: str
    created_at: dt.datetime
    completed_at: Optional[dt.datetime] = None

    model_config = {"from_attributes": True}


# ---------- 政策资讯 ----------

class PolicyOut(BaseModel):
    id: int
    title: str
    category: str
    source: str
    source_url: str
    published_at: Optional[dt.date] = None
    summary: str
    content: str
    cover_image: str

    model_config = {"from_attributes": True}


class PolicyCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    category: str = Field("", max_length=64)
    source: str = Field("", max_length=128)
    source_url: str = Field("", max_length=512)
    published_at: Optional[dt.date] = None
    summary: str = ""
    content: str = ""
    cover_image: str = Field("", max_length=512)
    is_published: bool = True


class PolicyUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=64)
    source: Optional[str] = Field(None, max_length=128)
    source_url: Optional[str] = Field(None, max_length=512)
    published_at: Optional[dt.date] = None
    summary: Optional[str] = None
    content: Optional[str] = None
    cover_image: Optional[str] = Field(None, max_length=512)
    is_published: Optional[bool] = None

