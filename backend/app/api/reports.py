"""报告接口：查看详情 + 导出 TXT / PDF。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from urllib.parse import quote

from app.api.ecg import _check_patient_access
from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.ecg_record import EcgRecord
from app.models.patient import Patient
from app.models.user import User
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["reports"])


def _load(record_pk: int, db: Session, user: User) -> tuple[EcgRecord, Patient]:
    record = db.get(EcgRecord, record_pk)
    if record is None:
        raise HTTPException(status_code=404, detail="报告对应记录不存在")
    patient = _check_patient_access(db, record.patient_id, user)
    return record, patient


@router.get("/{record_pk}")
def get_report(
    record_pk: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    record, patient = _load(record_pk, db, current)
    return {
        "record_pk": record.id,
        "record_id": record.record_id,
        "patient_name": patient.name,
        "patient_gender": patient.gender,
        "patient_age": patient.age,
        "file_name": record.file_name,
        "risk_level": record.risk_level,
        "risk_score": record.risk_score,
        "risk_probs": record.risk_probs,
        "total_beats": record.total_beats,
        "abnormal_beats": record.abnormal_beats,
        "report_text": record.report_text,
        "report_data": record.report_data,
        "has_shap": bool(record.shap_visualizations or record.shap_result),
        "created_at": record.created_at.isoformat(),
    }


@router.get("/{record_pk}/download")
def download_report(
    record_pk: int,
    format: str = Query("txt", pattern="^(txt|pdf)$"),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> Response:
    record, patient = _load(record_pk, db, current)
    filename = report_service.report_filename(record, format)
    # 中文文件名走 RFC 5987
    disposition = f"attachment; filename*=UTF-8''{quote(filename)}"

    if format == "txt":
        return Response(
            content=report_service.build_txt(record, patient),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": disposition},
        )

    pdf_bytes = report_service.build_pdf(record, patient)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": disposition},
    )
