"""健康检查。"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ai-huxinjing-backend", "version": "0.1.0"}
