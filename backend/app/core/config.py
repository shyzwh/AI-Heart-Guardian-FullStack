"""后端全局配置。

- 通过 pydantic-settings / .env 读取环境变量；无该库时用 dotenv 兜底。
- 项目根目录（src/、models/、uploads/、storage/ 的所在目录）在 backend 的上一级。
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# backend/ 目录（本文件位于 backend/app/core/config.py：core→app→backend）
BACKEND_DIR = Path(__file__).resolve().parents[2]
# 项目根目录（算法 src/ 与模型文件所在）
PROJECT_ROOT = BACKEND_DIR.parent

# 优先读取 backend/.env
load_dotenv(BACKEND_DIR / ".env")


def _get_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    """运行期配置（只读）。"""

    PROJECT_ROOT: Path = PROJECT_ROOT
    BACKEND_DIR: Path = BACKEND_DIR

    # 鉴权
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-insecure-secret-change-me")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

    # 数据库：默认固定在项目根 storage/ecg_web.db（绝对路径，避免随启动目录漂移）
    DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip()
    if not DATABASE_URL:
        DATABASE_URL = "sqlite:///" + (PROJECT_ROOT / "storage" / "ecg_web.db").as_posix()

    # CORS
    CORS_ORIGINS: list[str] = [
        item.strip()
        for item in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if item.strip()
    ]

    # GLM（仅环境变量，不写入代码）
    ZHIPU_API_KEY: str = os.getenv("ZHIPU_API_KEY", "").strip()

    # 上传 / 模型 / 波形目录（复用根目录资源）
    UPLOAD_DIR: Path = PROJECT_ROOT / "uploads"
    WAVEFORM_DIR: Path = PROJECT_ROOT / "storage" / "waveforms"
    MODEL_DIR: Path = PROJECT_ROOT / "models"
    TRAINING_DATA: Path = PROJECT_ROOT / "training_data.csv"

    # 前端生产产物目录（npm run build:local 输出）：由后端同源静态托管。
    # 可用 FRONTEND_DIST 环境变量覆盖为任意绝对路径。
    FRONTEND_DIST: Path = Path(
        os.getenv("FRONTEND_DIST", "").strip() or (PROJECT_ROOT / "frontend" / "dist")
    )
    # 是否启用前端静态托管（无产物时自动跳过，不影响纯 API 部署）
    SERVE_FRONTEND: bool = _get_bool("SERVE_FRONTEND", True)

    XGB_MODEL_PATH: str = (MODEL_DIR / "ecg_risk_xgb_model.json").as_posix()
    CNN_MODEL_PATH: str = (MODEL_DIR / "cnn_model.h5").as_posix()
    SCALER_PATH: str = (MODEL_DIR / "ecg_scaler.pkl").as_posix()

    # 允许上传的扩展名
    ALLOWED_UPLOAD_EXTS: tuple[str, ...] = (".csv", ".txt", ".dat")
    MAX_UPLOAD_MB: int = 50


settings = Settings()

# 确保运行期目录存在
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.WAVEFORM_DIR.mkdir(parents=True, exist_ok=True)
(PROJECT_ROOT / "storage").mkdir(parents=True, exist_ok=True)
