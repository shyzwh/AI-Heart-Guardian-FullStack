"""心电筛查记录模型：映射并扩展旧 records 表字段。"""
from __future__ import annotations

import datetime as dt

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class EcgRecord(Base):
    __tablename__ = "ecg_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # 沿用旧 uuid hex，便于和历史数据对齐
    record_id: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    file_name: Mapped[str] = mapped_column(String(255), default="")
    file_path: Mapped[str] = mapped_column(String(512), default="")
    waveform_path: Mapped[str] = mapped_column(String(512), default="")  # 清洗信号 .npy

    fs: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_beats: Mapped[int] = mapped_column(Integer, default=0)
    abnormal_beats: Mapped[int] = mapped_column(Integer, default=0)

    risk_level: Mapped[str] = mapped_column(String(8), default="低危")
    risk_num: Mapped[int] = mapped_column(Integer, default=0)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    risk_probs: Mapped[list | None] = mapped_column(JSON, nullable=True)

    features: Mapped[dict | None] = mapped_column(JSON, nullable=True)       # 12 项特征
    r_peaks: Mapped[list | None] = mapped_column(JSON, nullable=True)        # R 峰位置
    abnormal_positions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    cnn_status: Mapped[str] = mapped_column(String(32), default="")
    cnn_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    shap_result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # SHAP 四图（条形/蜂群/交互/决策）所需的可序列化数据；缺训练数据时为 partial（仅单样本+决策图）
    shap_visualizations: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    report_text: Mapped[str] = mapped_column(Text, default="")
    report_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    symptoms: Mapped[str] = mapped_column(Text, default="")

    status: Mapped[str] = mapped_column(String(16), default="analysis_ok")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, server_default=func.now(), index=True)

    patient = relationship("app.models.patient.Patient", back_populates="ecg_records")
