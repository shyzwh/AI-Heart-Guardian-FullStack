"""AI 接口测试：未配置密钥时必须优雅降级（available=false，不 500）。"""
from __future__ import annotations

import io
import time
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_CSV = PROJECT_ROOT / "uploads" / "100_30s.csv"


def _analyzed_record(client):
    username = f"doc_ai_{int(time.time() * 1000)}"
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
        "/api/v1/patients", json={"name": "AI患者", "gender": "男", "age": 70}, headers=h
    ).json()["id"]
    raw = SAMPLE_CSV.read_bytes()
    r = client.post(
        "/api/v1/ecg/analyze",
        data={"patient_id": str(pid)},
        files={"file": ("100_30s.csv", io.BytesIO(raw), "text/csv")},
        headers=h,
    )
    assert r.status_code == 201, r.text
    return h, r.json()["id"]


@pytest.mark.skipif(not SAMPLE_CSV.exists(), reason="缺少测试样本")
def test_ai_degrade_without_key(client, monkeypatch):
    # 强制无密钥，验证降级
    from app.core.config import settings
    monkeypatch.setattr(settings, "ZHIPU_API_KEY", "")
    h, rid = _analyzed_record(client)

    r = client.post("/api/v1/ai/polish", json={"record_id": rid}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["available"] is False
    assert body["fallback"]  # 返回离线报告兜底

    r = client.post("/api/v1/ai/diagnosis", json={"record_id": rid}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["available"] is False

    r = client.post("/api/v1/ai/ask", json={"question": "什么是QTc延长"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["available"] is False


def test_ai_requires_auth(client):
    assert client.post("/api/v1/ai/ask", json={"question": "hi"}).status_code == 401
