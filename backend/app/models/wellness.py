"""康养业务相关模型（随访 / 紧急联系人 / 健康打卡 / 康复方案 / 政策资讯）。

批次1先建表保证结构完整，相关 API 在批次2开放。
"""
from __future__ import annotations

import datetime as dt

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class FollowUp(Base):
    """医生为患者设置的随访提醒。"""

    __tablename__ = "followups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    ecg_record_id: Mapped[int | None] = mapped_column(ForeignKey("ecg_records.id"), nullable=True)
    due_date: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending/done/overdue
    content: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)


class EmergencyContact(Base):
    """患者紧急联系人。patient_id 可空以支持"未登录先添加联系人 + tel: 唤起"。"""

    __tablename__ = "emergency_contacts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    patient_id: Mapped[int | None] = mapped_column(ForeignKey("patients.id"), nullable=True, index=True)
    # 未登录场景下由前端生成并保存的本地设备标识
    device_key: Mapped[str] = mapped_column(String(64), default="", index=True)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    relation: Mapped[str] = mapped_column(String(32), default="")
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())


class HealthCheckIn(Base):
    """患者每日健康打卡。"""

    __tablename__ = "health_checkins"
    __table_args__ = (UniqueConstraint("patient_id", "checkin_date", name="uq_patient_checkin_date"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    checkin_date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    symptoms: Mapped[str] = mapped_column(Text, default="")
    symptom_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    blood_pressure: Mapped[str] = mapped_column(String(32), default="")
    mood: Mapped[str] = mapped_column(String(32), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())


class RehabPlan(Base):
    """依据心电风险结果生成的居家康复方案（八段锦/太极拳/慢走等）。"""

    __tablename__ = "rehab_plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    ecg_record_id: Mapped[int | None] = mapped_column(ForeignKey("ecg_records.id"), nullable=True)
    risk_level: Mapped[str] = mapped_column(String(8), default="低危")
    exercise_type: Mapped[str] = mapped_column(String(64), default="")
    intensity: Mapped[str] = mapped_column(String(32), default="")
    duration_min: Mapped[int] = mapped_column(Integer, default=20)
    frequency: Mapped[str] = mapped_column(String(64), default="")
    guidance: Mapped[str] = mapped_column(Text, default="")
    cautions: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())


class PolicyArticle(Base):
    """政策资讯（康养 / 智慧养老 / 心脑血管防治）。"""

    __tablename__ = "policy_articles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(64), default="", index=True)
    source: Mapped[str] = mapped_column(String(128), default="")
    source_url: Mapped[str] = mapped_column(String(512), default="")
    published_at: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    cover_image: Mapped[str] = mapped_column(String(512), default="")
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())
