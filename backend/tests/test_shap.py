"""SHAP 四图接口测试。"""
from __future__ import annotations

import io
import time
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_CSV = PROJECT_ROOT / "uploads" / "100_30s.csv"


def _register_doctor_and_analyze(client):
    username = f"doc_shap_{int(time.time() * 1000)}"
    client.post(
        "/api/v1/auth/register",
        json={"username": username, "password": "test123456", "role": "doctor"},
    )
    r = client.post(
        "/api/v1/auth/login",
        data={"username": username, "password": "test123456"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    pid = client.post(
        "/api/v1/patients",
        json={"name": "SHAP患者", "gender": "男", "age": 70},
        headers=h,
    ).json()["id"]
    raw = SAMPLE_CSV.read_bytes()
    r = client.post(
        "/api/v1/ecg/analyze",
        data={"patient_id": str(pid), "symptoms": ""},
        files={"file": ("100_30s.csv", io.BytesIO(raw), "text/csv")},
        headers=h,
    )
    assert r.status_code == 201, r.text
    return h, r.json()["id"]


@pytest.mark.skipif(not SAMPLE_CSV.exists(), reason="缺少测试样本")
def test_shap_four_charts(client):
    h, rec_id = _register_doctor_and_analyze(client)

    # 决策图：仅依赖单样本，必须可用
    r = client.get(f"/api/v1/ecg/{rec_id}/shap/decision", headers=h)
    assert r.status_code == 200, r.text
    decision = r.json()
    assert decision["available"] is True
    assert len(decision["chart"]["contributions"]) == 12

    # 条形图 / 蜂群图 / 交互图：依赖训练背景数据，可用或 partial 降级两种都合法
    for path in ("summary", "beeswarm", "interaction"):
        r = client.get(f"/api/v1/ecg/{rec_id}/shap/{path}", headers=h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "available" in body and "chart" in body
        if not body["available"]:
            # partial 时必须给出降级说明
            assert body["message"]


def test_shap_requires_auth(client):
    assert client.get("/api/v1/ecg/1/shap/decision").status_code == 401
