"""SQLAlchemy 引擎与会话。

SQLite 需要 check_same_thread=False（FastAPI 多线程访问）。
切换 PostgreSQL 时仅改 DATABASE_URL，引擎参数自动适配。
"""
from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


_connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    """所有 ORM 模型的声明基类。"""


def get_db() -> Generator[Session, None, None]:
    """FastAPI 依赖：提供一个请求级数据库会话。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """建表（开发期使用；生产建议用 Alembic 迁移）。"""
    # 导入模型以确保它们注册到 Base.metadata
    from app.models import all_models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_columns()


def _ensure_sqlite_columns() -> None:
    """对已存在的 SQLite 表做幂等补列（create_all 不会修改既有表结构）。

    当前需要补齐：ecg_records.shap_visualizations 和 followups.result。
    """
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "ecg_records" in tables:
        existing = {col["name"] for col in inspector.get_columns("ecg_records")}
        if "shap_visualizations" not in existing:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE ecg_records ADD COLUMN shap_visualizations JSON"))
    if "followups" in tables:
        followup_columns = {col["name"] for col in inspector.get_columns("followups")}
        if "result" not in followup_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE followups ADD COLUMN result TEXT"))
