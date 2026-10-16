"""心电分析接口：上传文件并运行双通路分析，结果落库。

- POST /ecg/analyze  multipart 上传文件 + patient_id + symptoms，同步分析
- GET  /ecg         记录列表（可按 patient_id / risk / 关键字过滤）
- GET  /ecg/{id}    记录详情（含特征/SHAP/报告）
- GET  /ecg/{id}/waveform  清洗信号 + R峰 + 异常位置（供前端绘波形）
- DELETE /ecg/{id}
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, require_roles
from app.db.database import get_db
from app.models.ecg_record import EcgRecord
from app.models.patient import Patient
from app.models.user import User
from app.schemas.ecg import EcgRecordOut, EcgRecordSummary
from app.services.analysis_bridge import analyze_file

router = APIRouter(prefix="/ecg", tags=["ecg"])


def _check_patient_access(db: Session, patient_id: int, user: User) -> Patient:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="患者档案不存在")
    if user.role == "doctor" and patient.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="无权为该患者发起分析")
    if user.role == "patient" and patient.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权访问该患者数据")
    return patient


def _save_upload(upload: UploadFile) -> str:
    """校验扩展与大小并保存到 uploads/，返回绝对路径。"""
    name = os.path.basename(upload.filename or "")
    ext = Path(name).suffix.lower()
    if ext not in settings.ALLOWED_UPLOAD_EXTS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型：{ext}")
    # 防路径穿越：只取文件名
    safe_name = f"{name}"
    dest = settings.UPLOAD_DIR / safe_name
    size = 0
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    with open(dest, "wb") as handle:
        while True:
            chunk = upload.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_bytes:
                handle.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="文件超过大小限制")
            handle.write(chunk)
    return str(dest)


@router.post("/analyze", response_model=EcgRecordOut, status_code=201)
def analyze(
    patient_id: int = Form(...),
    symptoms: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> EcgRecord:
    patient = _check_patient_access(db, patient_id, current)
    saved_path = _save_upload(file)

    patient_info = {
        "name": patient.name,
        "age": patient.age or 0,
        "sex": patient.gender,
        "gender": patient.gender,
        "height_cm": patient.height_cm or 170,
        "weight_kg": patient.weight_kg or 65.0,
    }
    result, message = analyze_file(
        saved_path, os.path.basename(saved_path), patient_info=patient_info, symptoms=symptoms
    )
    if result is None:
        raise HTTPException(status_code=422, detail=f"心电分析失败：{message}")

    # 保存清洗信号到 .npy（不入库 JSON，避免体积过大）
    waveform_path = settings.WAVEFORM_DIR / f"{result['record_id']}.npy"
    np.save(waveform_path, np.asarray(result["signal"], dtype=np.float32))

    record = EcgRecord(
        record_id=result["record_id"],
        patient_id=patient.id,
        doctor_id=patient.doctor_id,
        file_name=result["file_name"],
        file_path=saved_path.replace("\\", "/"),
        waveform_path=str(waveform_path).replace("\\", "/"),
        fs=result["fs"],
        total_beats=len(result["r_peaks"]),
        abnormal_beats=len(result["abnormal_positions"]),
        risk_level=result["risk_level"],
        risk_num=result["risk_num"],
        risk_score=result["score"],
        risk_probs=result["risk_probs"],
        features=result["features"],
        r_peaks=result["r_peaks"],
        abnormal_positions=result["abnormal_positions"],
        cnn_status=result["cnn_status"],
        cnn_confidence=result["cnn_confidence"],
        shap_result=result["shap_result"],
        shap_visualizations=result["shap_visualizations"],
        report_text=result["report_text"],
        report_data=result["report_data"],
        symptoms=result["symptoms"],
        status="analysis_ok",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def _scope_records(stmt, user: User, patient_id: int | None):
    """按角色收敛数据可见范围。"""
    if user.role == "doctor":
        stmt = stmt.where(EcgRecord.doctor_id == user.id)
        if patient_id is not None:
            stmt = stmt.where(EcgRecord.patient_id == patient_id)
    else:  # patient：仅能看自己档案下的记录
        stmt = stmt.join(Patient, EcgRecord.patient_id == Patient.id).where(
            Patient.user_id == user.id
        )
        if patient_id is not None:
            stmt = stmt.where(EcgRecord.patient_id == patient_id)
    return stmt


@router.get("", response_model=list[EcgRecordSummary])
def list_records(
    patient_id: int | None = None,
    risk: str | None = None,
    keyword: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[EcgRecord]:
    stmt = select(EcgRecord)
    stmt = _scope_records(stmt, current, patient_id)
    if risk:
        stmt = stmt.where(EcgRecord.risk_level == risk)
    if keyword:
        stmt = stmt.where(EcgRecord.file_name.contains(keyword))
    stmt = stmt.order_by(EcgRecord.created_at.desc()).limit(min(max(limit, 1), 500))
    return list(db.scalars(stmt).all())


@router.get("/{record_pk}", response_model=EcgRecordOut)
def get_record(
    record_pk: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> EcgRecord:
    record = db.get(EcgRecord, record_pk)
    if record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    _check_patient_access(db, record.patient_id, current)
    return record


@router.get("/{record_pk}/waveform")
def get_waveform(
    record_pk: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    record = db.get(EcgRecord, record_pk)
    if record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    _check_patient_access(db, record.patient_id, current)

    signal: list[float] = []
    if record.waveform_path and os.path.exists(record.waveform_path):
        signal = np.load(record.waveform_path).astype(float).tolist()
    return {
        "record_id": record.record_id,
        "fs": record.fs,
        "signal": signal,
        "r_peaks": record.r_peaks or [],
        "abnormal_positions": record.abnormal_positions or [],
    }


@router.delete("/{record_pk}", status_code=204)
def delete_record(
    record_pk: int,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_roles("doctor")),
) -> None:
    record = db.get(EcgRecord, record_pk)
    if record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    if record.doctor_id != doctor.id:
        raise HTTPException(status_code=403, detail="无权删除该记录")
    # 同时清理波形文件
    if record.waveform_path and os.path.exists(record.waveform_path):
        try:
            os.remove(record.waveform_path)
        except OSError:
            pass
    db.delete(record)
    db.commit()
