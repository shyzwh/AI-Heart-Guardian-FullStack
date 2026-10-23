"""康养接口：紧急联系人 + SOS、健康打卡、康复方案、随访。

权限：
- 紧急联系人 / SOS：未登录可用（device_key 标识设备）；登录患者绑定本人档案。
- 健康打卡 / 康复：患者本人或其主治医生可访问。
- 随访：医生创建与查看。
"""
from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_current_user_optional, require_roles
from app.db.database import get_db
from app.models.ecg_record import EcgRecord
from app.models.patient import Patient
from app.models.notification import Notification
from app.models.user import User
from app.models.wellness import (
    EmergencyContact,
    FollowUp,
    HealthCheckIn,
    RehabPlan,
)
from app.schemas.wellness import (
    CheckInCreate,
    CheckInOut,
    ContactCreate,
    ContactOut,
    FollowUpCreate,
    FollowUpComplete,
    FollowUpOut,
    RehabGenerateRequest,
    RehabOut,
    SosRequest,
)
from app.services import rehab_service

router = APIRouter(tags=["wellness"])


# ---------------------------------------------------------------- 辅助

def _resolve_patient_for_user(db: Session, user: User) -> Patient | None:
    """登录患者 -> 自己的档案。"""
    return db.scalar(select(Patient).where(Patient.user_id == user.id))


def _get_patient_or_403(db: Session, patient_id: int, user: User) -> Patient:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="患者档案不存在")
    if user.role == "doctor" and patient.doctor_id != user.id:
        raise HTTPException(status_code=403, detail="无权访问该患者")
    if user.role == "patient" and patient.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权访问该档案")
    return patient


# ------------------------------------------------------- 紧急联系人

@router.get("/emergency-contacts", response_model=list[ContactOut])
def list_contacts(
    device_key: str = "",
    db: Session = Depends(get_db),
    current: User | None = Depends(get_current_user_optional),
) -> list[EmergencyContact]:
    stmt = select(EmergencyContact)
    if current is not None and current.role == "patient":
        patient = _resolve_patient_for_user(db, current)
        pid = patient.id if patient else -1
        stmt = stmt.where(
            (EmergencyContact.patient_id == pid) | (EmergencyContact.device_key == device_key)
        )
    else:
        if not device_key:
            return []
        stmt = stmt.where(EmergencyContact.device_key == device_key)
    return list(db.scalars(stmt.order_by(EmergencyContact.is_primary.desc(), EmergencyContact.id)).all())


@router.post("/emergency-contacts", response_model=ContactOut, status_code=201)
def create_contact(
    payload: ContactCreate,
    device_key: str = "",
    db: Session = Depends(get_db),
    current: User | None = Depends(get_current_user_optional),
) -> EmergencyContact:
    patient_id = payload.patient_id
    resolved_device = device_key

    if current is not None:
        if current.role == "patient":
            patient = _resolve_patient_for_user(db, current)
            patient_id = patient.id if patient else payload.patient_id
        elif current.role == "doctor" and payload.patient_id is not None:
            _get_patient_or_403(db, payload.patient_id, current)
    if not patient_id and not resolved_device:
        raise HTTPException(status_code=400, detail="未登录状态需提供设备标识 device_key")

    # 设为主联系人时，先把同范围其他联系人取消主标记
    if payload.is_primary:
        _clear_primary(db, patient_id, resolved_device)

    contact = EmergencyContact(
        patient_id=patient_id,
        device_key=resolved_device,
        name=payload.name.strip(),
        relation=payload.relation,
        phone=payload.phone.strip(),
        is_primary=payload.is_primary,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


def _clear_primary(db: Session, patient_id: int | None, device_key: str) -> None:
    stmt = select(EmergencyContact)
    if patient_id is not None:
        stmt = stmt.where(EmergencyContact.patient_id == patient_id)
    else:
        stmt = stmt.where(EmergencyContact.device_key == device_key)
    for c in db.scalars(stmt).all():
        c.is_primary = False


@router.delete("/emergency-contacts/{contact_id}", status_code=204)
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current: User | None = Depends(get_current_user_optional),
) -> None:
    contact = db.get(EmergencyContact, contact_id)
    if contact is None:
        raise HTTPException(status_code=404, detail="联系人不存在")
    # 登录患者只能删自己的；未登录（匿名）允许按记录删除（设备本地管理）
    if current is not None and current.role == "patient":
        patient = _resolve_patient_for_user(db, current)
        if patient is None or contact.patient_id != patient.id:
            raise HTTPException(status_code=403, detail="无权删除该联系人")
    if current is not None and current.role == "doctor":
        if contact.patient_id is None:
            raise HTTPException(status_code=403, detail="无权删除该联系人")
        _get_patient_or_403(db, contact.patient_id, current)
    db.delete(contact)
    db.commit()


@router.post("/emergency/sos")
def sos(
    payload: SosRequest,
    db: Session = Depends(get_db),
    current: User | None = Depends(get_current_user_optional),
) -> dict:
    """返回应呼叫的联系人（主联系人优先）。实际拨号由前端 tel: 唤起，系统不代拨。"""
    contacts: list[EmergencyContact] = []
    patient_id = payload.patient_id

    if current is not None and current.role == "patient":
        patient = _resolve_patient_for_user(db, current)
        if patient:
            patient_id = patient.id
            contacts = list(
                db.scalars(
                    select(EmergencyContact)
                    .where(EmergencyContact.patient_id == patient.id)
                    .order_by(EmergencyContact.is_primary.desc(), EmergencyContact.id)
                ).all()
            )
    if not contacts and patient_id is not None:
        contacts = list(
            db.scalars(
                select(EmergencyContact)
                .where(EmergencyContact.patient_id == patient_id)
                .order_by(EmergencyContact.is_primary.desc(), EmergencyContact.id)
            ).all()
        )
    if not contacts and payload.device_key:
        contacts = list(
            db.scalars(
                select(EmergencyContact)
                .where(EmergencyContact.device_key == payload.device_key)
                .order_by(EmergencyContact.is_primary.desc(), EmergencyContact.id)
            ).all()
        )

    primary = contacts[0] if contacts else None
    return {
        "dial": "tel:" + primary.phone if primary else None,
        "primary": _contact_brief(primary),
        "contacts": [_contact_brief(c) for c in contacts],
        "fallback_emergency": "tel:120",
        "notice": "系统不代为拨号，请确认后由设备电话应用发起呼叫；情况危急请直接拨打 120。",
    }


def _contact_brief(c: EmergencyContact | None) -> dict | None:
    if c is None:
        return None
    return {"id": c.id, "name": c.name, "relation": c.relation, "phone": c.phone, "is_primary": c.is_primary}


# --------------------------------------------------------- 健康打卡

@router.post("/checkins", response_model=CheckInOut, status_code=201)
def create_checkin(
    payload: CheckInCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> HealthCheckIn:
    patient = _get_patient_or_403(db, payload.patient_id, current)
    checkin_date = payload.checkin_date or dt.date.today()

    # 同一天重复打卡 -> 更新（唯一约束 uq_patient_checkin_date）
    existing = db.scalar(
        select(HealthCheckIn).where(
            HealthCheckIn.patient_id == patient.id,
            HealthCheckIn.checkin_date == checkin_date,
        )
    )
    if existing:
        existing.symptoms = payload.symptoms
        existing.symptom_tags = payload.symptom_tags
        existing.heart_rate = payload.heart_rate
        existing.blood_pressure = payload.blood_pressure
        existing.mood = payload.mood
        existing.note = payload.note
        db.commit()
        db.refresh(existing)
        return existing

    checkin = HealthCheckIn(
        patient_id=patient.id,
        checkin_date=checkin_date,
        symptoms=payload.symptoms,
        symptom_tags=payload.symptom_tags,
        heart_rate=payload.heart_rate,
        blood_pressure=payload.blood_pressure,
        mood=payload.mood,
        note=payload.note,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)
    return checkin


@router.get("/checkins/{patient_id}", response_model=list[CheckInOut])
def list_checkins(
    patient_id: int,
    limit: int = 90,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[HealthCheckIn]:
    _get_patient_or_403(db, patient_id, current)
    stmt = (
        select(HealthCheckIn)
        .where(HealthCheckIn.patient_id == patient_id)
        .order_by(HealthCheckIn.checkin_date.desc())
        .limit(min(max(limit, 1), 365))
    )
    return list(db.scalars(stmt).all())


# --------------------------------------------------------- 康复方案

@router.post("/rehab/generate", response_model=RehabOut, status_code=201)
def generate_rehab(
    payload: RehabGenerateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> RehabPlan:
    patient = _get_patient_or_403(db, payload.patient_id, current)

    record = None
    if payload.ecg_record_id is not None:
        record = db.get(EcgRecord, payload.ecg_record_id)
        if record is None or record.patient_id != patient.id:
            raise HTTPException(status_code=404, detail="心电记录不存在或不属于该患者")
    else:
        record = db.scalar(
            select(EcgRecord)
            .where(EcgRecord.patient_id == patient.id)
            .order_by(EcgRecord.created_at.desc())
        )

    fields = rehab_service.generate_plan_fields(patient, record)
    plan = RehabPlan(
        patient_id=patient.id,
        ecg_record_id=record.id if record else None,
        **fields,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/rehab/{patient_id}", response_model=list[RehabOut])
def list_rehab(
    patient_id: int,
    limit: int = 10,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[RehabPlan]:
    _get_patient_or_403(db, patient_id, current)
    stmt = (
        select(RehabPlan)
        .where(RehabPlan.patient_id == patient_id)
        .order_by(RehabPlan.created_at.desc())
        .limit(min(max(limit, 1), 50))
    )
    return list(db.scalars(stmt).all())


# ----------------------------------------------------------- 随访

@router.get("/followups", response_model=list[FollowUpOut])
def list_followups(
    patient_id: int | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> list[FollowUp]:
    stmt = select(FollowUp)
    if current.role == "doctor":
        stmt = stmt.where(FollowUp.doctor_id == current.id)
    else:
        patient = _resolve_patient_for_user(db, current)
        pid = patient.id if patient else -1
        stmt = stmt.where(FollowUp.patient_id == pid)
    if patient_id is not None:
        stmt = stmt.where(FollowUp.patient_id == patient_id)
    if status_filter:
        stmt = stmt.where(FollowUp.status == status_filter)
    return list(
        db.scalars(stmt.order_by(FollowUp.due_date.asc().nullslast(), FollowUp.id.desc())).all()
    )


@router.post("/followups", response_model=FollowUpOut, status_code=201)
def create_followup(
    payload: FollowUpCreate,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_roles("doctor")),
) -> FollowUp:
    patient = _get_patient_or_403(db, payload.patient_id, doctor)
    followup = FollowUp(
        patient_id=payload.patient_id,
        doctor_id=doctor.id,
        ecg_record_id=payload.ecg_record_id,
        due_date=payload.due_date,
        content=payload.content,
        status="pending",
    )
    db.add(followup)
    if patient.user_id is not None:
        db.add(
            Notification(
                recipient_id=patient.user_id,
                title="收到新的随访计划",
                content=payload.content or "已安排新的随访计划，请查看随访计划页。",
                notification_type="followup",
            )
        )
    db.commit()
    db.refresh(followup)
    return followup


@router.patch("/followups/{followup_id}/done", response_model=FollowUpOut)
def complete_followup(
    followup_id: int,
    payload: FollowUpComplete,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_roles("doctor")),
) -> FollowUp:
    followup = db.get(FollowUp, followup_id)
    if followup is None or followup.doctor_id != doctor.id:
        raise HTTPException(status_code=404, detail="随访不存在或无权操作")
    followup.status = "done"
    followup.result = payload.result.strip()
    followup.completed_at = dt.datetime.now()
    db.commit()
    db.refresh(followup)
    return followup
