"""SHAP 四图数据接口（条形图 / 蜂群图 / 交互图 / 决策力图）。

- 数据来自 ecg_records.shap_visualizations（分析时由 explain_shap_visualizations 生成）。
- 历史记录若未存该字段，则用记录中的 12 项特征即时重算（不改动算法层）。
- partial（缺 training_data.csv）时全局/蜂群/交互图返回 available=False，前端优雅降级。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.database import get_db
from app.api.ecg import _check_patient_access
from app.models.ecg_record import EcgRecord
from app.models.user import User
from src.inference import FEATURE_ORDER, explain_shap_visualizations

router = APIRouter(prefix="/ecg", tags=["shap"])


def _get_record_checked(record_pk: int, db: Session, user: User) -> EcgRecord:
    record = db.get(EcgRecord, record_pk)
    if record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    _check_patient_access(db, record.patient_id, user)
    return record


def _ensure_visualizations(record: EcgRecord, db: Session) -> dict:
    """优先用落库的 SHAP 可视化数据；缺失时用特征即时重算并回填。"""
    if record.shap_visualizations:
        return record.shap_visualizations
    if not record.features:
        raise HTTPException(status_code=422, detail="该记录缺少特征数据，无法生成 SHAP 图")
    status, data, _ = explain_shap_visualizations(
        record.features,
        model_path=settings.XGB_MODEL_PATH,
        background_path=settings.TRAINING_DATA.as_posix(),
    )
    if status not in {"success", "partial"} or data is None:
        raise HTTPException(status_code=422, detail="SHAP 可视化数据暂不可用")
    record.shap_visualizations = data
    db.commit()
    return data


def _payload(viz: dict, available: bool, chart: dict | None) -> dict:
    return {
        "available": available,
        "target_class": viz.get("target_class"),
        "target_label": viz.get("target_label"),
        "base_value": viz.get("base_value"),
        "feature_order": FEATURE_ORDER,
        "chart": chart,
        "message": None if available else "当前环境缺少训练背景数据，该全局/交互图暂不可用，已为你展示单样本解释。",
    }


@router.get("/{record_pk}/shap/summary")
def shap_summary(
    record_pk: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    """全局特征重要性条形图：各特征平均绝对 SHAP 值。"""
    record = _get_record_checked(record_pk, db, current)
    viz = _ensure_visualizations(record, db)
    global_data = viz.get("global")
    if not global_data:
        return _payload(viz, False, None)
    import numpy as np

    shap_values = np.asarray(global_data.get("shap_values", []), dtype=float)
    importance = np.abs(shap_values).mean(axis=0)
    chart = {
        "features": FEATURE_ORDER,
        "importance": [float(v) for v in importance],
        "sample_count": int(global_data.get("sample_count", 0)),
    }
    db.commit()
    return _payload(viz, True, chart)


@router.get("/{record_pk}/shap/beeswarm")
def shap_beeswarm(
    record_pk: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    """蜂群图：背景样本各特征取值（标准化）× SHAP 值散点。"""
    record = _get_record_checked(record_pk, db, current)
    viz = _ensure_visualizations(record, db)
    global_data = viz.get("global")
    if not global_data:
        return _payload(viz, False, None)
    chart = {
        "features": FEATURE_ORDER,
        "values": global_data.get("values", []),
        "shap_values": global_data.get("shap_values", []),
        "sample_count": int(global_data.get("sample_count", 0)),
    }
    return _payload(viz, True, chart)


@router.get("/{record_pk}/shap/interaction")
def shap_interaction(
    record_pk: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    """交互图：QRS 标准化取值 vs 其 SHAP 值，颜色编码 ST_shift。"""
    record = _get_record_checked(record_pk, db, current)
    viz = _ensure_visualizations(record, db)
    interaction = viz.get("interaction")
    if not interaction:
        return _payload(viz, False, None)
    points = [
        {"x": float(x), "y": float(y), "color": float(c)}
        for x, y, c in zip(
            interaction.get("x", []), interaction.get("y", []), interaction.get("color", [])
        )
    ]
    chart = {
        "feature": interaction.get("feature", "QRS"),
        "interaction_feature": interaction.get("interaction_feature", "ST_shift"),
        "points": points,
    }
    return _payload(viz, True, chart)


@router.get("/{record_pk}/shap/decision")
def shap_decision(
    record_pk: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    """单样本决策力图：base_value 起，按特征 SHAP 贡献累加，前端绘瀑布。"""
    record = _get_record_checked(record_pk, db, current)
    viz = _ensure_visualizations(record, db)
    decision = viz.get("decision") or {}
    contributions = (
        decision.get("contributions")
        if decision.get("contributions") is not None
        else [viz.get("sample_contributions", {}).get(name, 0.0) for name in FEATURE_ORDER]
    )
    chart = {
        "features": decision.get("features", FEATURE_ORDER),
        "contributions": [float(v) for v in contributions],
        "sample_values": viz.get("standardized_values", {}),
    }
    # 决策图只依赖单样本，partial 时也可用
    return _payload(viz, True, chart)
