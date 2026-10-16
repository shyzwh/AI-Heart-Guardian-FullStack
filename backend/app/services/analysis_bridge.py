"""算法桥接层：把根目录 src/ 的分析流程包装成 Web 可调用的纯函数。

- 直接复用 src/（data_loader / preprocess / feature_extract / cnn_inference /
  inference / report_gen），不改动算法代码。
- 与 legacy Streamlit 的 analysis_service 等价，但不依赖 st.session_state，
  配置由 backend/app/core/config 提供。
- TensorFlow / XGBoost 模型在首次调用时加载并缓存（线程安全）。
"""
from __future__ import annotations

import datetime as dt
import threading
import uuid

import numpy as np

from app.core.config import settings

# 根目录 src/ 通过 PYTHONPATH 引入（main.py / conftest 中把 PROJECT_ROOT 加入 sys.path）
from src.cnn_inference import predict_abnormal_beats
from src.data_loader import load_ecg
from src.feature_extract import extract_all_features, pan_tompkins
from src.inference import FEATURE_ORDER, explain_shap_visualizations, explain_with_shap, predict_risk
from src.preprocess import preprocess_ecg
from src.report_gen import generate_report

_model_lock = threading.Lock()


def _build_config() -> dict:
    """构造与算法层约定一致的 config 字典（绝对路径）。"""
    return {
        "model_path": settings.XGB_MODEL_PATH,
        "cnn_model_path": settings.CNN_MODEL_PATH,
        "scaler_path": settings.SCALER_PATH,
        "qtc_threshold_male": 440,
        "qtc_threshold_female": 460,
        "qtc_threshold_default": 450,
        "qtc_threshold_mild_high": 500,
        "risk_threshold_medium": 0.4,
        "risk_threshold_high": 0.7,
    }


def _risk_probs(features: dict, config: dict, risk_num: int, score: float) -> list[float]:
    """计算三类概率，模型不可用时给出兜底值（与 legacy 逻辑一致）。"""
    import os

    import joblib
    import xgboost as xgb

    try:
        model = xgb.XGBClassifier()
        model.load_model(config["model_path"])
        arr = np.array([[features[name] for name in FEATURE_ORDER]], dtype=float)
        if os.path.exists(config["scaler_path"]):
            arr = joblib.load(config["scaler_path"]).transform(arr)
        probs = model.predict_proba(arr)[0]
        return [float(probs[i]) for i in range(len(probs))]
    except Exception:
        fallback = [0.0, 0.0, 0.0]
        fallback[int(risk_num)] = max(float(score), 0.0)
        return fallback


def analyze_file(
    file_path: str,
    file_name: str,
    patient_info: dict | None = None,
    symptoms: str = "",
) -> tuple[dict | None, str]:
    """执行端到端分析。

    返回 (result_dict, message)。成功时 result_dict 非空。
    result_dict 中包含 numpy 数组（signal），持久化前需另行处理。
    """
    patient_info = patient_info or {}
    sex = patient_info.get("sex", patient_info.get("gender", "未指定"))
    config = _build_config()

    status, signal, fs, message = load_ecg(file_path)
    if status != "success":
        return None, message

    status, clean_signal, message = preprocess_ecg(signal, fs)
    if status != "success":
        return None, message

    status, r_peaks, message = pan_tompkins(clean_signal, fs)
    if status != "success":
        return None, message

    status, features, message = extract_all_features(clean_signal, r_peaks, fs)
    if status != "success":
        return None, message
    features = {k: (0.0 if v is None else v) for k, v in features.items()}

    cnn_status, abnormal_positions, cnn_confidence, _ = predict_abnormal_beats(
        clean_signal, r_peaks, fs, config["cnn_model_path"]
    )
    abnormal_positions = abnormal_positions or []

    xgb_status, risk_level, risk_num, score, risk_message = predict_risk(
        features, config["model_path"], config=config, sex=sex
    )
    if xgb_status != "success":
        return None, risk_message
    risk_probs = _risk_probs(features, config, risk_num, score)

    shap_status, shap_result, _ = explain_with_shap(features, config["model_path"])

    # SHAP 四图（条形/蜂群/交互/决策）数据；缺训练数据时返回 partial（仅单样本+决策图）
    viz_status, shap_viz, viz_msg = explain_shap_visualizations(
        features,
        model_path=config["model_path"],
        background_path=settings.TRAINING_DATA.as_posix(),
    )

    report_status, report_text, report_data = generate_report(
        risk_num=risk_num,
        risk_score=score,
        risk_probs=risk_probs,
        features=features,
        abnormal_count=len(abnormal_positions),
        total_beats=len(r_peaks),
        sex=sex,
        cnn_status=cnn_status,
    )

    result = {
        "record_id": uuid.uuid4().hex,
        "file_name": file_name,
        "created_at": dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "patient_info": patient_info,
        "symptoms": (symptoms or "").strip(),
        "signal": clean_signal,            # numpy 数组，不入库
        "fs": float(fs),
        "r_peaks": [int(p) for p in r_peaks],
        "features": features,
        "abnormal_positions": [int(p) for p in abnormal_positions],
        "cnn_status": cnn_status,
        "cnn_confidence": float(cnn_confidence or 0.0),
        "risk_level": risk_level,
        "risk_num": int(risk_num),
        "score": float(score),
        "risk_probs": [float(p) for p in risk_probs],
        "shap_status": shap_status,
        "shap_result": shap_result if shap_status == "success" else None,
        "shap_viz_status": viz_status,  # success / partial / error
        "shap_viz_message": viz_msg,
        "shap_visualizations": shap_viz if viz_status in {"success", "partial"} else None,
        "report_status": report_status,
        "report_text": report_text,
        "report_data": report_data,
    }
    return result, "分析完成"
