"""患者档案接口。

- 医生：创建 / 列表 / 详情 / 更新 / 删除（多患者管理）
- 患者：查看自己绑定的档案
"""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.database import get_db
from app.models.patient import Patient
from app.models.user import User
from app.schemas.patient import PatientCreate, PatientOut, PatientUpdate

router = APIRouter(prefix="/patients", tags=["patients"])


def _serialize(patient: Patient) -> PatientOut:
    """ORM -> Schema，past_history 以 JSON 字符串存储，输出为列表。"""
    try:
        history = json.loads(patient.past_history or "[]")
        if not isinstance(history, list):
            history = []
    except (TypeError, json.JSONDecodeError):
        history = []
    return PatientOut(
        id=patient.id,
        user_id=patient.user_id,
        doctor_id=patient.doctor_id,
        name=patient.name,
        gender=patient.gender,
        age=patient.age,
        birth_date=patient.birth_date or "",
        height_cm=patient.height_cm,
        weight_kg=patient.weight_kg,
        past_history=history,
        medication=patient.medication or "",
        note=patient.note or "",
        created_at=patient.created_at,
        updated_at=patient.updated_at,
    )


def _get_owned_patient(db: Session, patient_id: int, doctor_id: int) -> Patient:
    patient = db.get(Patient, patient_id)
    if patient is None or patient.doctor_id != doctor_id:
        raise HTTPException(status_code=404, detail="患者档案不存在或无权访问")
    return patient


@router.post("", response_model=PatientOut, status_code=201)
def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_roles("doctor")),
) -> PatientOut:
    # 若绑定患者账号，校验该账号确实是 patient 角色
    if payload.user_id is not None:
        target = db.get(User, payload.user_id)
        if target is None or target.role != "patient":
            raise HTTPException(status_code=400, detail="绑定的用户不存在或不是患者角色")
    patient = Patient(
        doctor_id=doctor.id,
        user_id=payload.user_id,
        name=payload.name.strip(),
        gender=payload.gender,
        age=payload.age,
        birth_date=payload.birth_date,
        height_cm=payload.height_cm,
        weight_kg=payload.weight_kg,
        past_history=json.dumps(payload.past_history, ensure_ascii=False),
        medication=payload.medication,
        note=payload.note,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return _serialize(patient)


@router.get("", response_model=list[PatientOut])
def list_patients(
    keyword: str | None = None,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_roles("doctor")),
) -> list[PatientOut]:
    stmt = select(Patient).where(Patient.doctor_id == doctor.id)
    if keyword:
        stmt = stmt.where(Patient.name.contains(keyword))
    stmt = stmt.order_by(Patient.updated_at.desc())
    return [_serialize(p) for p in db.scalars(stmt).all()]


@router.get("/me/profile", response_model=PatientOut)
def my_profile(
    db: Session = Depends(get_db),
    current: User = Depends(require_roles("patient")),
) -> PatientOut:
    patient = db.scalar(select(Patient).where(Patient.user_id == current.id))
    if patient is None:
        raise HTTPException(status_code=404, detail="尚未建立患者档案")
    return _serialize(patient)


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> PatientOut:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="患者档案不存在")
    # 医生只能看自己名下的；患者只能看自己绑定的
    if current.role == "doctor" and patient.doctor_id != current.id:
        raise HTTPException(status_code=403, detail="无权访问该档案")
    if current.role == "patient" and patient.user_id != current.id:
        raise HTTPException(status_code=403, detail="无权访问该档案")
    return _serialize(patient)


@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int,
    payload: PatientUpdate,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_roles("doctor")),
) -> PatientOut:
    patient = _get_owned_patient(db, patient_id, doctor.id)
    data = payload.model_dump(exclude_unset=True)
    if "past_history" in data and data["past_history"] is not None:
        patient.past_history = json.dumps(data.pop("past_history"), ensure_ascii=False)
    if "user_id" in data:
        uid = data["user_id"]
        if uid is not None:
            target = db.get(User, uid)
            if target is None or target.role != "patient":
                raise HTTPException(status_code=400, detail="绑定的用户不存在或不是患者角色")
    for key, value in data.items():
        setattr(patient, key, value)
    db.commit()
    db.refresh(patient)
    return _serialize(patient)


@router.delete("/{patient_id}", status_code=204)
def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    doctor: User = Depends(require_roles("doctor")),
) -> None:
    patient = _get_owned_patient(db, patient_id, doctor.id)
    db.delete(patient)
    db.commit()
