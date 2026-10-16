"""报告相关响应模型。"""
from __future__ import annotations

import datetime as dt

from pydantic import BaseModel


class ReportOut(BaseModel):
    """报告详情：文本 + 结构化数据 + 患者与记录元信息。"""

    record_pk: int
    record_id: str
    patient_name: str
    patient_gender: str
    patient_age: int | None
    file_name: str
    risk_level: str
    risk_score: float
    risk_probs: list[float] | None
    total_beats: int
    abnormal_beats: int
    report_text: str
    report_data: dict | None
    has_shap: bool
    created_at: dt.datetime

    model_config = {"from_attributes": True}
