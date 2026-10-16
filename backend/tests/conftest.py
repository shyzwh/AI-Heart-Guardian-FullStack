"""pytest 公共夹具。

- 把 backend/ 与项目根（含 src/）加入 sys.path，保证 `app` 与 `src` 可导入。
- 在导入应用配置前，将 DATABASE_URL 指向临时测试库，避免污染开发库 storage/ecg_web.db。
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent

for p in (str(BACKEND_DIR), str(PROJECT_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

# 测试使用独立临时 SQLite 库（必须在导入 app.core.config 之前设置）
_TEST_DB_DIR = tempfile.mkdtemp(prefix="ecg_test_")
_TEST_DB_PATH = Path(_TEST_DB_DIR) / "test_ecg_web.db"
os.environ["DATABASE_URL"] = "sqlite:///" + _TEST_DB_PATH.as_posix()
# 测试不依赖真实 GLM 密钥
os.environ.setdefault("ZHIPU_API_KEY", "")

from fastapi.testclient import TestClient  # noqa: E402

from app.db.database import SessionLocal, init_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    """整轮测试共享一个 TestClient，并在建表后使用。"""
    init_db()
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()
