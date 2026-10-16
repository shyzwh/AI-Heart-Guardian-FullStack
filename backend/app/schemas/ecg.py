"""心电记录响应模型（分析结果）。"""
from __future__ import annotations

import datetime as dt

from pydantic import BaseModel


class EcgRecordSummary(BaseModel):
    """列表项摘要。"""

    id: int
    record_id: str
    patient_id: int
    file_name: str
    risk_level: str
    risk_num: int
    risk_score: float
    total_beats: int
    abnormal_beats: int
    symptoms: str
    status: str
    created_at: dt.datetime

    model_config = {"from_attributes": True}


class EcgRecordOut(EcgRecordSummary):
    """详情：包含特征、SHAP、报告等完整结果。"""

    fs: float | None
    risk_probs: list[float] | None
    features: dict | None
    r_peaks: list[int] | None
    abnormal_positions: list[int] | None
    cnn_status: str
    cnn_confidence: float | None
    shap_result: dict | None
    report_text: str
    report_data: dict | None

    # 清洗信号默认不放 JSON（体积大），由单独接口按需取
    model_config = {"from_attributes": True}
