"""冒烟用例：健康检查、鉴权、患者档案、心电分析全链路。

运行（在 backend/ 目录）：
    python -m pytest tests -v
"""
from __future__ import annotations

import io
import time
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_CSV = PROJECT_ROOT / "uploads" / "100_30s.csv"


def _unique(prefix: str) -> str:
    return f"{prefix}_{int(time.time() * 1000)}"


def _register_and_login(client, role: str, prefix: str) -> tuple[str, str]:
    """注册并登录，返回 (token, username)。"""
    username = _unique(prefix)
    r = client.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "password": "test123456",
            "role": role,
            "display_name": ("测试医生" if role == "doctor" else "测试患者"),
            "phone": "13800000000",
        },
    )
    assert r.status_code == 201, r.text
    r = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": "test123456"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["role"] == role
    assert data["access_token"]
    return data["access_token"], username


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_register_login_me(client):
    token, _ = _register_and_login(client, "doctor", "doctor")
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["role"] == "doctor"


def test_duplicate_username_rejected(client):
    username = _unique("dup")
    payload = {"username": username, "password": "test123456", "role": "doctor"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    assert client.post("/api/v1/auth/register", json=payload).status_code == 400


def test_login_wrong_password(client):
    username = _unique("wrongpwd")
    client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "test123456", "role": "patient"},
    )
    r = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": "bad-password"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 401


def test_patient_crud_and_role_guard(client):
    doctor_token, _ = _register_and_login(client, "doctor", "doc_crud")
    patient_token, _ = _register_and_login(client, "patient", "pat_crud")
    dh = {"Authorization": f"Bearer {doctor_token}"}
    ph = {"Authorization": f"Bearer {patient_token}"}

    # 患者角色不能建档
    r = client.post("/api/v1/patients", json={"name": "越权建档"}, headers=ph)
    assert r.status_code == 403

    # 医生建档
    r = client.post(
        "/api/v1/patients",
        json={
            "name": "张三",
            "gender": "男",
            "age": 66,
            "past_history": ["高血压"],
            "medication": "阿司匹林",
        },
        headers=dh,
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]

    # 列表 / 详情
    assert client.get("/api/v1/patients", headers=dh).status_code == 200
    r = client.get(f"/api/v1/patients/{pid}", headers=dh)
    assert r.status_code == 200 and r.json()["name"] == "张三"

    # 更新
    r = client.put(
        f"/api/v1/patients/{pid}",
        json={"note": "复查"},
        headers=dh,
    )
    assert r.status_code == 200 and r.json()["note"] == "复查"


def test_ecg_full_pipeline(client):
    """注册医生 → 建患者 → 上传真实心电 → 双通路分析落库 → 列表/详情/波形。"""
    if not SAMPLE_CSV.exists():
        pytest.skip(f"缺少测试样本：{SAMPLE_CSV}")

    token, _ = _register_and_login(client, "doctor", "doc_ecg")
    h = {"Authorization": f"Bearer {token}"}

    r = client.post(
        "/api/v1/patients",
        json={"name": "心电患者", "gender": "男", "age": 70},
        headers=h,
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]

    raw = SAMPLE_CSV.read_bytes()
    files = {"file": ("100_30s.csv", io.BytesIO(raw), "text/csv")}
    data = {"patient_id": str(pid), "symptoms": "偶发心悸"}
    r = client.post("/api/v1/ecg/analyze", data=data, files=files, headers=h)
    assert r.status_code == 201, r.text
    record = r.json()
    assert record["risk_level"] in {"低危", "中危", "高危"}
    assert record["patient_id"] == pid
    assert record["symptoms"] == "偶发心悸"
    rec_pk = record["id"]

    # 列表
    r = client.get("/api/v1/ecg", headers=h)
    assert r.status_code == 200 and any(x["id"] == rec_pk for x in r.json())

    # 详情
    r = client.get(f"/api/v1/ecg/{rec_pk}", headers=h)
    assert r.status_code == 200
    assert r.json()["features"] is not None

    # 波形
    r = client.get(f"/api/v1/ecg/{rec_pk}/waveform", headers=h)
    assert r.status_code == 200
    wf = r.json()
    assert "signal" in wf and "r_peaks" in wf
    assert len(wf["signal"]) > 0


def test_ecg_requires_auth(client):
    assert client.get("/api/v1/ecg").status_code == 401
