@echo off
setlocal enabledelayedexpansion

rem =====================================================================
rem AI HuXinJing - Smart Healthcare ECG Screening Platform
rem Windows one-click launcher (ASCII-safe to avoid codepage issues)
rem
rem Usage:
rem   start.bat          Production: Uvicorn serves frontend/dist on same origin
rem   start.bat prod     Same as above (explicit)
rem   start.bat dev       Development: backend + Vite dev server (two windows)
rem   start.bat build     Build frontend assets only, then exit
rem
rem Overridable env vars:
rem   PYTHON  Python interpreter (default: python)
rem   HOST    Bind host (default: 127.0.0.1)
rem   PORT    Backend port (default: 8000)
rem =====================================================================

set "MODE=%~1"
if "%MODE%"=="" set "MODE=prod"

cd /d "%~dp0"

if not defined PYTHON set "PYTHON=python"
if not defined HOST set "HOST=127.0.0.1"
if not defined PORT set "PORT=8000"

set "BACKEND_DIR=%~dp0backend"
set "FRONTEND_DIR=%~dp0frontend"

echo ============================================================
echo  AI HuXinJing launcher - mode: %MODE%
echo  Python: %PYTHON%
echo  Backend: http://%HOST%:%PORT%
echo ============================================================

if /i "%MODE%"=="build" goto build_frontend

rem ---- Check backend dependencies ----
"%PYTHON%" -c "import uvicorn, fastapi" >nul 2>&1
if errorlevel 1 (
  echo [INFO] Backend deps not found, installing backend\requirements.txt ...
  "%PYTHON%" -m pip install -r "%BACKEND_DIR%\requirements.txt"
  if errorlevel 1 (
    echo [ERROR] Backend dependency install failed. Check your Python env.
    pause
    exit /b 1
  )
)

if /i "%MODE%"=="dev" goto dev_mode

rem ---------------- Production ----------------
:prod_mode
if not exist "%FRONTEND_DIR%\dist\index.html" (
  echo [INFO] frontend\dist\index.html not found, building first ...
  call :build_frontend
  if errorlevel 1 exit /b 1
)
echo [START] Backend (serving frontend on same origin) ...
echo [OPEN]  Open http://%HOST%:%PORT% in your browser
echo [STOP]  Press Ctrl+C in this window
pushd "%BACKEND_DIR%"
"%PYTHON%" -m uvicorn app.main:app --host %HOST% --port %PORT%
popd
goto end

rem ---------------- Development ----------------
:dev_mode
echo [START] Backend Uvicorn :%PORT% (new window, reload) ...
start "AI-HuXinJing-Backend" cmd /k "cd /d %BACKEND_DIR% && %PYTHON% -m uvicorn app.main:app --host %HOST% --port %PORT% --reload"

echo [START] Frontend Vite (new window, /api proxied to backend) ...
pushd "%FRONTEND_DIR%"
if not exist "node_modules" (
  echo [INFO] Installing frontend deps ...
  call npm install
)
start "AI-HuXinJing-Frontend" cmd /k "cd /d %FRONTEND_DIR% && npm run dev"
popd
echo [INFO] Two services started in separate windows. Close them to stop.
goto end

rem ---------------- Frontend build subroutine ----------------
:build_frontend
pushd "%FRONTEND_DIR%"
if not exist "node_modules" (
  echo [INFO] Installing frontend deps ...
  call npm install
  if errorlevel 1 ( popd ^& echo [ERROR] npm install failed ^& exit /b 1 )
)
echo [BUILD] Producing self-hosted assets to frontend\dist ...
call npm run build:local
if errorlevel 1 ( popd ^& echo [ERROR] Frontend build failed ^& exit /b 1 )
popd
echo [DONE] Frontend assets ready.
if /i "%MODE%"=="build" exit /b 0
goto:eof

:end
endlocal
