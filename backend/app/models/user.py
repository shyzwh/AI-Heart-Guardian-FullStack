"""登录账号模型：医生与患者统一表，用 role 区分。"""
from __future__ import annotations

import datetime as dt

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # doctor / patient
    display_name: Mapped[str] = mapped_column(String(64), default="")
    phone: Mapped[str] = mapped_column(String(32), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now())

    # 医生名下的患者档案（doctor_id 关联）
    patients: Mapped[list["Patient"]] = relationship(  # noqa: F821
        back_populates="doctor",
        foreign_keys="Patient.doctor_id",
    )
    # 患者账号反向关联到自己的档案（user_id 关联）
    patient_profile: Mapped["Patient | None"] = relationship(  # noqa: F821
        back_populates="user",
        foreign_keys="Patient.user_id",
        uselist=False,
    )
