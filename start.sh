#!/usr/bin/env bash
# =====================================================================
# AI护心镜 全龄心电风险与医患协同平台 —— Linux/macOS 一键启动脚本
#
# 用法：
#   ./start.sh            生产模式：后端(Uvicorn) 同源托管 frontend/dist
#   ./start.sh prod       同上（显式生产模式）
#   ./start.sh dev        开发模式：后端 + 前端 Vite 热更新
#   ./start.sh build      仅构建前端产物后退出
#
# 可覆盖的环境变量：
#   PYTHON   Python 解释器（默认 python3）
#   HOST     监听地址（默认 127.0.0.1）
#   PORT     后端端口（默认 8000）
# =====================================================================
set -euo pipefail

MODE="${1:-prod}"

# 切到脚本所在目录（项目根）
cd "$(dirname "$0")"

PYTHON="${PYTHON:-python3}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"

BACKEND_DIR="$(pwd)/backend"
FRONTEND_DIR="$(pwd)/frontend"

echo "============================================================"
echo " AI护心镜 启动模式: $MODE"
echo " Python: $PYTHON"
echo " 后端地址: http://$HOST:$PORT"
echo "============================================================"

build_frontend() {
  cd "$FRONTEND_DIR"
  if [ ! -d node_modules ]; then
    echo "[提示] 安装前端依赖 ..."
    npm install
  fi
  echo "[构建] 生成自托管产物到 frontend/dist ..."
  npm run build:local
  cd - >/dev/null
  echo "[完成] 前端产物已就绪。"
}

if [ "$MODE" = "build" ]; then
  build_frontend
  exit 0
fi

# ---- 检查后端依赖 ----
if ! "$PYTHON" -c "import uvicorn, fastapi" >/dev/null 2>&1; then
  echo "[提示] 未检测到后端依赖，正在安装 backend/requirements.txt ..."
  "$PYTHON" -m pip install -r "$BACKEND_DIR/requirements.txt"
fi

if [ "$MODE" = "dev" ]; then
  echo "[启动] 后端 Uvicorn（热更新）..."
  ( cd "$BACKEND_DIR" && "$PYTHON" -m uvicorn app.main:app --host "$HOST" --port "$PORT" --reload ) &
  BACK_PID=$!
  echo "[启动] 前端 Vite（/api 代理到后端）..."
  cd "$FRONTEND_DIR"
  [ -d node_modules ] || npm install
  npm run dev &
  FRONT_PID=$!
  trap "echo; echo '[停止] 正在关闭服务...'; kill $BACK_PID $FRONT_PID 2>/dev/null || true" INT TERM
  echo "[提示] 前端地址以 Vite 输出为准（默认 http://localhost:5173）；按 Ctrl+C 停止全部。"
  wait
  exit 0
fi

# ---------------- 生产模式 ----------------
if [ ! -f "$FRONTEND_DIR/dist/index.html" ]; then
  echo "[提示] 未发现前端产物 frontend/dist/index.html，先执行生产构建 ..."
  build_frontend
fi
echo "[启动] 后端服务（同源托管前端）..."
echo "[访问] 浏览器打开 http://$HOST:$PORT"
echo "[停止] 按 Ctrl+C"
cd "$BACKEND_DIR"
exec "$PYTHON" -m uvicorn app.main:app --host "$HOST" --port "$PORT"
