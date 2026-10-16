"""AI 接口：报告润色 / 结构化第二意见 / 知识问答。

无密钥或模型不可用时返回 HTTP 200 + available=false（前端优雅降级），不抛 500。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.ecg import _check_patient_access
from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.ecg_record import EcgRecord
from app.models.user import User
from app.schemas.ai import AskRequest, DiagnosisRequest, PolishRequest
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


def _load_authorized_record(record_pk: int, db: Session, user: User) -> EcgRecord:
    record = db.get(EcgRecord, record_pk)
    if record is None:
        raise HTTPException(status_code=404, detail="记录不存在")
    _check_patient_access(db, record.patient_id, user)
    return record


@router.post("/polish")
def polish(
    payload: PolishRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    record = _load_authorized_record(payload.record_id, db, current)
    ok, text, reason = ai_service.polish(record)
    return {"available": ok, "text": text, "fallback": None if ok else record.report_text, "reason": reason}


@router.post("/diagnosis")
def diagnosis(
    payload: DiagnosisRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict:
    record = _load_authorized_record(payload.record_id, db, current)
    ok, data, reason = ai_service.diagnose(record)
    return {"available": ok, "diagnosis": data, "reason": reason}


@router.post("/ask")
def ask(
    payload: AskRequest,
    current: User = Depends(get_current_user),
) -> dict:
    ok, text, reason = ai_service.ask(payload.question)
    return {"available": ok, "answer": text, "question": payload.question, "reason": reason}
