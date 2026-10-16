"""FastAPI 应用入口。

运行（在 backend/ 目录）：
    uvicorn app.main:app --reload --port 8000

需要能 import 项目根目录的 src/，因此这里把 PROJECT_ROOT 加入 sys.path。
"""
from __future__ import annotations

import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

# 确保根目录（含 src/）在模块搜索路径中，且 backend/ 自身也在
from app.core.config import PROJECT_ROOT, settings

_root_str = str(PROJECT_ROOT)
if _root_str not in sys.path:
    sys.path.insert(0, _root_str)

from app.api import ai, auth, ecg, patients, policy, reports, shap, system, wellness  # noqa: E402
from app.db.database import init_db  # noqa: E402

app = FastAPI(
    title="AI护心镜——智慧康养心电风险筛查平台 API",
    version="0.1.0",
    description="双通路心电风险筛查 + 康养健康管理后端",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
app.include_router(system.router, prefix=API_PREFIX)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(patients.router, prefix=API_PREFIX)
app.include_router(ecg.router, prefix=API_PREFIX)
app.include_router(shap.router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)
app.include_router(ai.router, prefix=API_PREFIX)
app.include_router(wellness.router, prefix=API_PREFIX)
app.include_router(policy.router, prefix=API_PREFIX)


@app.on_event("startup")
def _on_startup() -> None:
    init_db()


@app.get("/api/health")
def api_root() -> dict:
    return {"name": "AI护心镜后端", "docs": "/docs", "health": f"{API_PREFIX}/health"}


class SPAStaticFiles(StaticFiles):
    """前端 SPA 静态托管：命中真实文件则返回，否则回退 index.html。

    这样浏览器直接打开/刷新 /patient/reports/123 等前端路由时不会 404；
    /api、/docs 等后端路由在挂载前已注册，优先匹配，不受影响。
    """

    async def get_response(self, path: str, scope):  # type: ignore[override]
        # 仅对页面导航类 GET 做回退；带文件后缀（.js/.css/.svg 等）找不到仍返回 404
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and "." not in path.rsplit("/", 1)[-1]:
                return FileResponse(str(settings.FRONTEND_DIST / "index.html"))
            raise


# 前端静态托管必须最后挂载到 "/"：显式 API/文档路由已在其前注册，优先命中。
if settings.SERVE_FRONTEND and (settings.FRONTEND_DIST / "index.html").exists():
    app.mount("/", SPAStaticFiles(directory=str(settings.FRONTEND_DIST), html=True), name="frontend")
else:

    @app.get("/")
    def root() -> dict:
        return {"name": "AI护心镜后端", "docs": "/docs", "health": f"{API_PREFIX}/health"}
