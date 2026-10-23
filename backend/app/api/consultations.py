"""Authenticated doctor/patient consultation endpoints."""
from __future__ import annotations

import datetime as dt
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.consultation import Consultation, ConsultationMessage
from app.models.notification import Notification
from app.models.patient import Patient
from app.models.user import User
from app.schemas.consultation import ConsultationCreate

router = APIRouter(prefix="/consultations", tags=["consultations"])

_MAX_IMAGE_BYTES = 8 * 1024 * 1024
_IMAGE_SIGNATURES = {
    "jpeg": (b"\xff\xd8\xff", ".jpg"),
    "png": (b"\x89PNG\r\n\x1a\n", ".png"),
    "webp": (b"RIFF", ".webp"),
}


def _get_accessible_consultation(db: Session, consultation_id: int, user: User) -> Consultation:
    consultation = db.get(Consultation, consultation_id)
    if consultation is None:
        raise HTTPException(status_code=404, detail="咨询会话不存在")
    if user.role == "doctor":
        if consultation.doctor_id != user.id:
            raise HTTPException(status_code=403, detail="无权访问该咨询会话")
    elif user.role == "patient":
        patient = db.get(Patient, consultation.patient_id)
        if patient is None or patient.user_id != user.id:
            raise HTTPException(status_code=403, detail="无权访问该咨询会话")
    else:
        raise HTTPException(status_code=403, detail="无权访问该咨询会话")
    return consultation


def _serialize_consultation(
    db: Session, consultation: Consultation, user: User
) -> dict[str, object]:
    patient = db.get(Patient, consultation.patient_id)
    doctor = db.get(User, consultation.doctor_id)
    latest = db.scalar(
        select(ConsultationMessage)
        .where(ConsultationMessage.consultation_id == consultation.id)
        .order_by(ConsultationMessage.created_at.desc(), ConsultationMessage.id.desc())
        .limit(1)
    )
    counterpart = doctor if user.role == "patient" else (
        db.get(User, patient.user_id) if patient and patient.user_id else None
    )
    return {
        "id": consultation.id,
        "patient_id": consultation.patient_id,
        "doctor_id": consultation.doctor_id,
        "patient_name": patient.name if patient else "患者",
        "counterpart_name": (
            counterpart.display_name or counterpart.username if counterpart else "患者"
        ),
        "status": consultation.status,
        "last_message": (
            latest.content or ("[图片]" if latest.image_filename else "")
            if latest
            else ""
        ),
        "last_message_at": latest.created_at if latest else consultation.created_at,
        "updated_at": consultation.updated_at,
    }


def _read_image(upload: UploadFile) -> tuple[bytes, str]:
    content_type = (upload.content_type or "").lower()
    allowed_types = {
        "image/jpeg": "jpeg",
        "image/png": "png",
        "image/webp": "webp",
    }
    expected = allowed_types.get(content_type)
    if expected is None:
        raise HTTPException(status_code=415, detail="仅支持 JPEG、PNG 或 WebP 图片")

    data = upload.file.read(_MAX_IMAGE_BYTES + 1)
    if len(data) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="图片不能超过 8 MB")

    signature, extension = _IMAGE_SIGNATURES[expected]
    if not data.startswith(signature):
        raise HTTPException(status_code=400, detail="图片内容与文件类型不匹配")
    if expected == "webp" and data[8:12] != b"WEBP":
        raise HTTPException(status_code=400, detail="图片内容与文件类型不匹配")
    return data, extension


@router.post("", status_code=201)
def create_consultation(
    payload: ConsultationCreate | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict[str, object]:
    if current.role == "patient":
        patient = db.scalar(select(Patient).where(Patient.user_id == current.id))
        if patient is None:
            raise HTTPException(status_code=404, detail="患者档案尚未绑定，请联系医生")
    elif current.role == "doctor":
        patient_id = payload.patient_id if payload else None
        if patient_id is None:
            raise HTTPException(status_code=422, detail="医生创建会话时必须指定患者档案")
        patient = db.get(Patient, patient_id)
        if patient is None or patient.doctor_id != current.id:
            raise HTTPException(status_code=404, detail="患者档案不存在或无权访问")
        if patient.user_id is None:
            raise HTTPException(status_code=400, detail="该患者尚未绑定登录账号")
    else:
        raise HTTPException(status_code=403, detail="当前账号不能创建咨询会话")

    consultation = db.scalar(
        select(Consultation).where(
            Consultation.patient_id == patient.id,
            Consultation.doctor_id == patient.doctor_id,
        )
    )
    if consultation is None:
        consultation = Consultation(patient_id=patient.id, doctor_id=patient.doctor_id)
        db.add(consultation)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            consultation = db.scalar(
                select(Consultation).where(
                    Consultation.patient_id == patient.id,
                    Consultation.doctor_id == patient.doctor_id,
                )
            )
            if consultation is None:
                raise
        else:
            db.refresh(consultation)
    return _serialize_consultation(db, consultation, current)


@router.get("")
def list_consultations(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[dict[str, object]]:
    statement = select(Consultation)
    if current.role == "doctor":
        statement = statement.where(Consultation.doctor_id == current.id)
    elif current.role == "patient":
        statement = statement.join(Patient, Consultation.patient_id == Patient.id).where(
            Patient.user_id == current.id
        )
    else:
        raise HTTPException(status_code=403, detail="当前账号不能查看咨询会话")
    consultations = db.scalars(
        statement.order_by(Consultation.updated_at.desc()).limit(100)
    ).all()
    return [_serialize_consultation(db, item, current) for item in consultations]


@router.get("/{consultation_id}/messages")
def list_messages(
    consultation_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[dict[str, object]]:
    consultation = _get_accessible_consultation(db, consultation_id, current)
    messages = db.scalars(
        select(ConsultationMessage)
        .where(ConsultationMessage.consultation_id == consultation.id)
        .order_by(ConsultationMessage.created_at.desc(), ConsultationMessage.id.desc())
        .limit(200)
    ).all()
    return [
        {
            "id": message.id,
            "consultation_id": message.consultation_id,
            "sender_id": message.sender_id,
            "sender_role": message.sender_role,
            "content": message.content,
            "has_image": bool(message.image_filename),
            "created_at": message.created_at,
        }
        for message in reversed(messages)
    ]


@router.post("/{consultation_id}/messages", status_code=201)
def send_message(
    consultation_id: int,
    content: str = Form(""),
    image: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> dict[str, object]:
    consultation = _get_accessible_consultation(db, consultation_id, current)
    clean_content = content.strip()
    if len(clean_content) > 5000:
        raise HTTPException(status_code=422, detail="消息不能超过 5000 个字符")
    if not clean_content and image is None:
        raise HTTPException(status_code=400, detail="请输入消息或选择图片")

    image_filename = None
    if image is not None:
        image_bytes, extension = _read_image(image)
        image_filename = f"{uuid.uuid4().hex}{extension}"
        image_dir = settings.UPLOAD_DIR / "consultations"
        image_dir.mkdir(parents=True, exist_ok=True)
        (image_dir / image_filename).write_bytes(image_bytes)

    message = ConsultationMessage(
        consultation_id=consultation.id,
        sender_id=current.id,
        sender_role=current.role,
        content=clean_content,
        image_filename=image_filename,
        created_at=dt.datetime.now(),
    )
    consultation.updated_at = message.created_at
    recipient_id = (
        consultation.doctor_id
        if current.role == "patient"
        else db.get(Patient, consultation.patient_id).user_id
    )
    db.add(message)
    db.flush()
    consultation.updated_at = message.created_at
    if recipient_id is not None:
        db.add(
            Notification(
                recipient_id=recipient_id,
                title="收到一条咨询消息",
                content=clean_content or "对方发送了一张图片",
                notification_type="consultation",
            )
        )
    db.commit()
    db.refresh(message)
    return {
        "id": message.id,
        "consultation_id": message.consultation_id,
        "sender_id": message.sender_id,
        "sender_role": message.sender_role,
        "content": message.content,
        "has_image": bool(message.image_filename),
        "created_at": message.created_at,
    }


@router.get("/{consultation_id}/messages/{message_id}/image")
def get_message_image(
    consultation_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> FileResponse:
    consultation = _get_accessible_consultation(db, consultation_id, current)
    message = db.get(ConsultationMessage, message_id)
    if (
        message is None
        or message.consultation_id != consultation.id
        or message.image_filename is None
    ):
        raise HTTPException(status_code=404, detail="图片不存在")
    image_path = Path(settings.UPLOAD_DIR / "consultations" / message.image_filename)
    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="图片文件不存在")
    return FileResponse(image_path)
