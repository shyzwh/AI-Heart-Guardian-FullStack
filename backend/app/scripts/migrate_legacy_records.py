"""一次性数据迁移：把旧 Streamlit 版本的历史记录导入新库。

数据来源（按优先级）：
1. 旧 SQLite：storage/ecg.db 的 records 表（legacy/database/db.py 写入）
2. 旧 JSON ：storage/records.json

迁移策略：
- 创建/复用一个迁移医生账号（用户名 __migration_doctor__）
- 按旧记录里的患者姓名（patient_info.name / patient_name）去重建档
- 旧记录映射为 ecg_records（特征/报告/SHAP 等保留；旧库通常无 r_peaks/波形）

用法（在 backend/ 目录）：
    python -m app.scripts.migrate_legacy_records
"""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

# 允许从 backend/ 直接运行
BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.security import hash_password  # noqa: E402
from app.db.database import SessionLocal, init_db  # noqa: E402
from app.models.ecg_record import EcgRecord  # noqa: E402
from app.models.patient import Patient  # noqa: E402
from app.models.user import User  # noqa: E402
from sqlalchemy import select  # noqa: E402

PROJECT_ROOT = BACKEND_DIR.parent
MIGRATION_DOCTOR = "__migration_doctor__"
MIGRATION_DOCTOR_PWD = "migration-not-used-for-login"

_RISK_NUM = {"低危": 0, "中危": 1, "高危": 2}


def _load_legacy_rows() -> list[dict]:
    """优先读旧 SQLite，读不到再读旧 JSON。"""
    old_db = PROJECT_ROOT / "storage" / "ecg.db"
    if old_db.exists():
        try:
            conn = sqlite3.connect(str(old_db))
            conn.row_factory = sqlite3.Row
            rows = [dict(r) for r in conn.execute("SELECT * FROM records").fetchall()]
            conn.close()
            if rows:
                parsed = []
                for row in rows:
                    row = dict(row)
                    for field in ("特征", "patient_info"):
                        try:
                            row[field] = json.loads(row.get(field) or "{}")
                        except (TypeError, json.JSONDecodeError):
                            row[field] = {}
                    parsed.append(row)
                print(f"[来源] 旧 SQLite，{len(parsed)} 条")
                return parsed
        except sqlite3.Error as exc:
            print(f"[警告] 读取旧 SQLite 失败：{exc}，尝试 JSON")

    old_json = PROJECT_ROOT / "storage" / "records.json"
    if old_json.exists():
        data = json.loads(old_json.read_text(encoding="utf-8"))
        print(f"[来源] 旧 JSON，{len(data)} 条")
        return data if isinstance(data, list) else []
    return []


def _patient_name(row: dict) -> str:
    info = row.get("patient_info")
    if isinstance(info, dict) and info.get("name"):
        return str(info["name"]).strip()
    if row.get("patient_name"):
        return str(row["patient_name"]).strip()
    return "未命名患者"


def main() -> None:
    init_db()
    rows = _load_legacy_rows()
    if not rows:
        print("没有可迁移的历史记录。")
        return

    db = SessionLocal()
    try:
        # 迁移医生
        doctor = db.scalar(select(User).where(User.username == MIGRATION_DOCTOR))
        if doctor is None:
            doctor = User(
                username=MIGRATION_DOCTOR,
                password_hash=hash_password(MIGRATION_DOCTOR_PWD),
                role="doctor",
                display_name="历史数据迁移医生",
                is_active=False,  # 不用于登录
            )
            db.add(doctor)
            db.flush()

        # 姓名 -> Patient 缓存
        name_to_patient: dict[str, Patient] = {}

        migrated = 0
        skipped = 0
        for row in rows:
            record_id = str(row.get("record_id") or "").strip()
            if not record_id:
                skipped += 1
                continue
            exists = db.scalar(select(EcgRecord).where(EcgRecord.record_id == record_id))
            if exists:
                skipped += 1
                continue

            name = _patient_name(row)
            patient = name_to_patient.get(name)
            if patient is None:
                patient = db.scalar(
                    select(Patient).where(
                        Patient.doctor_id == doctor.id, Patient.name == name
                    )
                )
                if patient is None:
                    info = row.get("patient_info") if isinstance(row.get("patient_info"), dict) else {}
                    patient = Patient(
                        doctor_id=doctor.id,
                        name=name,
                        gender=str(info.get("sex", "未指定")),
                        age=_safe_int(info.get("age")),
                    )
                    db.add(patient)
                    db.flush()
                name_to_patient[name] = patient

            features = row.get("特征") if isinstance(row.get("特征"), dict) else {}
            risk_level = str(row.get("风险等级") or "低危")
            record = EcgRecord(
                record_id=record_id,
                patient_id=patient.id,
                doctor_id=doctor.id,
                file_name=str(row.get("文件名") or ""),
                total_beats=int(row.get("总心拍数") or 0),
                abnormal_beats=int(row.get("异常心拍数") or 0),
                risk_level=risk_level,
                risk_num=_RISK_NUM.get(risk_level, 0),
                risk_score=float(row.get("风险评分") or 0.0),
                features=features,
                report_text=str(row.get("报告") or ""),
                symptoms=str(row.get("symptoms") or ""),
                status="migrated",
            )
            # 旧记录的"时间"是文本，尽量保留；created_at 由服务端默认值无法直接覆盖时忽略
            db.add(record)
            migrated += 1

        db.commit()
        print(f"迁移完成：新增 {migrated} 条，跳过(已存在/无ID) {skipped} 条。")
    finally:
        db.close()


def _safe_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


if __name__ == "__main__":
    main()
