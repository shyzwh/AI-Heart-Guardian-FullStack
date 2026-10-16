"""康养接口测试：联系人+SOS、健康打卡、康复方案、随访、政策。"""
from __future__ import annotations

import io
import time
import uuid
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_CSV = PROJECT_ROOT / "uploads" / "100_30s.csv"


def _signup(client, role: str, prefix: str):
    username = f"{prefix}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:4]}"
    client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "test123456", "role": role,
              "display_name": prefix},
    )
    r = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": "test123456"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _bound_patient(client, doc_h, pat_h):
    """医生建档并绑定患者账号，返回 patient_id。"""
    me = client.get("/api/v1/auth/me", headers=pat_h).json()
    r = client.post(
        "/api/v1/patients",
        json={"name": "康养患者", "gender": "男", "age": 72, "user_id": me["id"]},
        headers=doc_h,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


# ------------------------------------------------- 紧急联系人 + SOS

def test_anonymous_contacts_and_sos(client):
    device = f"dev_{uuid.uuid4().hex[:12]}"
    # 匿名添加联系人
    r = client.post(
        f"/api/v1/emergency-contacts?device_key={device}",
        json={"name": "家属", "relation": "子女", "phone": "13900000001", "is_primary": True},
    )
    assert r.status_code == 201, r.text
    cid = r.json()["id"]

    r = client.get(f"/api/v1/emergency-contacts?device_key={device}")
    assert r.status_code == 200 and len(r.json()) == 1

    # SOS 返回 tel: 拨号串与120兜底，且明确不代拨
    r = client.post("/api/v1/emergency/sos", json={"device_key": device})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["dial"] == "tel:13900000001"
    assert body["fallback_emergency"] == "tel:120"
    assert "不代为拨号" in body["notice"]

    # 删除
    assert client.delete(f"/api/v1/emergency-contacts/{cid}?device_key={device}").status_code == 204
    assert client.get(f"/api/v1/emergency-contacts?device_key={device}").json() == []


def test_sos_no_contacts(client):
    r = client.post("/api/v1/emergency/sos", json={"device_key": f"empty_{uuid.uuid4().hex[:8]}"})
    assert r.status_code == 200
    assert r.json()["dial"] is None
    assert r.json()["fallback_emergency"] == "tel:120"


# ------------------------------------------------------- 健康打卡

def test_checkin_upsert(client):
    doc_h = _signup(client, "doctor", "doc_ci")
    pat_h = _signup(client, "patient", "pat_ci")
    pid = _bound_patient(client, doc_h, pat_h)

    payload = {
        "patient_id": pid,
        "symptom_tags": ["胸闷", "乏力"],
        "heart_rate": 78,
        "blood_pressure": "130/85",
        "mood": "一般",
        "note": "饭后略闷",
    }
    r = client.post("/api/v1/checkins", json=payload, headers=pat_h)
    assert r.status_code == 201, r.text

    # 同日再打卡 -> 更新而非新增
    payload["heart_rate"] = 80
    client.post("/api/v1/checkins", json=payload, headers=pat_h)
    r = client.get(f"/api/v1/checkins/{pid}", headers=pat_h)
    rows = r.json()
    assert len(rows) == 1 and rows[0]["heart_rate"] == 80

    # 医生可查看
    assert client.get(f"/api/v1/checkins/{pid}", headers=doc_h).status_code == 200


def test_checkin_requires_auth(client):
    assert client.post("/api/v1/checkins", json={"patient_id": 1}).status_code == 401


# ------------------------------------------------------- 康复方案

@pytest.mark.skipif(not SAMPLE_CSV.exists(), reason="缺少测试样本")
def test_rehab_generate_and_list(client):
    doc_h = _signup(client, "doctor", "doc_rh")
    pat_h = _signup(client, "patient", "pat_rh")
    pid = _bound_patient(client, doc_h, pat_h)

    # 先做一次心电分析
    raw = SAMPLE_CSV.read_bytes()
    r = client.post(
        "/api/v1/ecg/analyze",
        data={"patient_id": str(pid)},
        files={"file": ("100_30s.csv", io.BytesIO(raw), "text/csv")},
        headers=doc_h,
    )
    assert r.status_code == 201, r.text

    r = client.post("/api/v1/rehab/generate", json={"patient_id": pid}, headers=doc_h)
    assert r.status_code == 201, r.text
    plan = r.json()
    assert plan["risk_level"] in {"低危", "中危", "高危"}
    assert plan["exercise_type"] and plan["guidance"]
    # 高危时不得给出高强度运动
    if plan["risk_level"] == "高危":
        assert "静养" in plan["exercise_type"]

    r = client.get(f"/api/v1/rehab/{pid}", headers=pat_h)
    assert r.status_code == 200 and len(r.json()) >= 1


# ----------------------------------------------------------- 随访

def test_followup_doctor_only(client):
    doc_h = _signup(client, "doctor", "doc_fu")
    pat_h = _signup(client, "patient", "pat_fu")
    pid = _bound_patient(client, doc_h, pat_h)

    # 患者不能建随访
    assert client.post("/api/v1/followups", json={"patient_id": pid, "content": "复查"}, headers=pat_h).status_code == 403

    r = client.post(
        "/api/v1/followups",
        json={"patient_id": pid, "content": "一周后复查心电图"},
        headers=doc_h,
    )
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    assert r.json()["status"] == "pending"

    r = client.get("/api/v1/followups", headers=doc_h)
    assert r.status_code == 200 and any(x["id"] == fid for x in r.json())

    # 患者只看自己的随访
    r = client.get("/api/v1/followups", headers=pat_h)
    assert r.status_code == 200 and all(x["patient_id"] == pid for x in r.json())

    # 完成
    r = client.patch(f"/api/v1/followups/{fid}/done", headers=doc_h)
    assert r.status_code == 200 and r.json()["status"] == "done"


# --------------------------------------------------------- 政策资讯

def test_policy_public(client):
    r = client.get("/api/v1/policy")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 3
    titles = " ".join(i["title"] for i in items)
    assert "心脑血管" in titles and "智慧健康养老" in titles

    # 分类
    r = client.get("/api/v1/policy/categories")
    assert r.status_code == 200 and len(r.json()["categories"]) >= 1

    # 详情
    pid = items[0]["id"]
    r = client.get(f"/api/v1/policy/{pid}")
    assert r.status_code == 200 and r.json()["content"]
