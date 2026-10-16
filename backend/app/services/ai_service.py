"""AI 服务：包装 src/llm_client，统一注入环境变量密钥与优雅降级。

- 不改动算法层。
- ZHIPU_API_KEY 仅从环境变量（settings）读取，绝不写入代码。
- 无密钥 / 网络失败 / 模型不可用：返回 (False, 兜底文案或 None, 原因)，由路由返回 available=false。
"""
from __future__ import annotations

from app.core.config import settings
from app.models.ecg_record import EcgRecord


def _api_key() -> str:
    return settings.ZHIPU_API_KEY or ""


def _build_analysis_result(record: EcgRecord) -> dict:
    """把落库记录还原为 llm_client 期望的 analysis_result 结构。"""
    return {
        "features": record.features or {},
        "shap_result": record.shap_result or {},
        "risk_level": record.risk_level,
        "score": record.risk_score,
        "risk_probs": record.risk_probs or [],
        "cnn_status": record.cnn_status,
        "cnn_confidence": record.cnn_confidence,
        "abnormal_positions": record.abnormal_positions or [],
        "r_peaks": record.r_peaks or [],
        "patient_info": {},
        "symptoms": record.symptoms or "",
        "report_data": record.report_data or {},
    }


def polish(record: EcgRecord) -> tuple[bool, str | None, str]:
    """报告通俗润色。"""
    from src.llm_client import polish_report_with_glm

    key = _api_key()
    if not key:
        return False, None, "未配置 ZHIPU_API_KEY，AI 润色不可用"
    text = polish_report_with_glm(
        record.report_text or "", api_key=key, symptoms=record.symptoms or ""
    )
    if text:
        return True, text, ""
    return False, None, "AI 服务暂时不可用，请稍后重试"


def diagnose(record: EcgRecord) -> tuple[bool, dict | None, str]:
    """结构化第二意见。"""
    from src.llm_client import generate_ai_diagnosis

    key = _api_key()
    if not key:
        return False, None, "未配置 ZHIPU_API_KEY，AI 解读不可用"
    data = generate_ai_diagnosis(
        _build_analysis_result(record), api_key=key, symptoms=record.symptoms or ""
    )
    if data:
        return True, data, ""
    return False, None, "AI 解读暂时不可用，请稍后重试"


def ask(question: str) -> tuple[bool, str | None, str]:
    """基于本地知识库 + GLM 的问答。"""
    from src.llm_client import answer_with_rag

    key = _api_key()
    if not key:
        return False, None, "未配置 ZHIPU_API_KEY，AI 问答不可用"
    text = answer_with_rag(question, api_key=key)
    if text:
        return True, text, ""
    return False, None, "AI 问答暂时不可用，请稍后重试"
