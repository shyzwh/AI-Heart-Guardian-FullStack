"""患者档案模型：一名医生可管理多名患者。"""
from __future__ import annotations

import datetime as dt

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # 患者登录账号（可空：档案可先于注册存在，由医生建档）
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    # 主治医生
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    gender: Mapped[str] = mapped_column(String(8), default="未指定")  # 男/女/未指定（沿用旧字段 sex 语义）
    birth_date: Mapped[str] = mapped_column(String(16), default="")  # ISO 日期字符串，可空
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    past_history: Mapped[str] = mapped_column(Text, default="")  # JSON 数组字符串
    medication: Mapped[str] = mapped_column(Text, default="")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    doctor = relationship(
        "app.models.user.User",
        foreign_keys=[doctor_id],
        back_populates="patients",
    )
    user = relationship(
        "app.models.user.User",
        foreign_keys=[user_id],
        back_populates="patient_profile",
    )
    ecg_records: Mapped[list["EcgRecord"]] = relationship(  # noqa: F821
        back_populates="patient",
        cascade="all, delete-orphan",
    )
