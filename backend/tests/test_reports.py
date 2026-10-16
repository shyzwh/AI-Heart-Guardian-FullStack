"""报告查看与导出测试（TXT / PDF）。"""
from __future__ import annotations

import io
import time
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SAMPLE_CSV = PROJECT_ROOT / "uploads" / "100_30s.csv"


def _analyzed_record(client):
    username = f"doc_rep_{int(time.time() * 1000)}"
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
        "/api/v1/patients", json={"name": "报告患者", "gender": "女", "age": 68}, headers=h
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
def test_report_detail(client):
    h, rid = _analyzed_record(client)
    r = client.get(f"/api/v1/reports/{rid}", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["risk_level"] in {"低危", "中危", "高危"}
    assert len(body["report_text"]) > 0
    assert body["report_data"] is not None


@pytest.mark.skipif(not SAMPLE_CSV.exists(), reason="缺少测试样本")
def test_report_download_txt(client):
    h, rid = _analyzed_record(client)
    r = client.get(f"/api/v1/reports/{rid}/download?format=txt", headers=h)
    assert r.status_code == 200, r.text
    assert "text/plain" in r.headers["content-type"]
    assert "attachment" in r.headers["content-disposition"]
    text = r.content.decode("utf-8")
    assert "心电风险辅助筛查报告" in text and "免责声明" in text


@pytest.mark.skipif(not SAMPLE_CSV.exists(), reason="缺少测试样本")
def test_report_download_pdf(client):
    h, rid = _analyzed_record(client)
    r = client.get(f"/api/v1/reports/{rid}/download?format=pdf", headers=h)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"  # PDF 魔数


def test_report_bad_format(client):
    # 未登录直接 401
    assert client.get("/api/v1/reports/1/download?format=docx").status_code in (401, 422)
