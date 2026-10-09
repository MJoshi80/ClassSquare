@echo off
setlocal enabledelayedexpansion

echo ==========================================================
echo   OptiClass AI: Smart Timetable ^& Classroom Scheduler
echo   Autonomous Academic Scheduling & Resource Optimization
echo ==========================================================
echo.

cd /d "%~dp0"

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    pause
    exit /b 1
)

:: Check if Node is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

echo [1/3] Checking Backend Environment...
if not exist "backend\venv\Scripts\python.exe" (
    echo Setting up Python virtual environment...
    cd backend
    python -m venv venv
    call .\venv\Scripts\activate.bat
    pip install -r requirements.txt
    cd ..
)

echo.
echo [2/3] Checking Database ^& Demo Dataset...
set /p SEED="Do you want to re-seed fresh demo data? (y/N): "
if /i "%SEED%"=="y" (
    echo Seeding realistic demo dataset...
    cd backend
    .\venv\Scripts\python.exe seed_demo.py
    cd ..
) else (
    if not exist "backend\data\opticlass.db" (
        echo Initializing demo dataset for first run...
        cd backend
        .\venv\Scripts\python.exe seed_demo.py
        cd ..
    )
)

echo.
echo [3/3] Launching OptiClass AI Services...
echo   - Backend:  http://127.0.0.1:8000 (FastAPI Swagger Docs at /docs)
echo   - Frontend: http://localhost:5173 (Vite React App)
echo.
echo Demo Accounts:
echo   - Admin:   admin@opticlass.edu          / admin123
echo   - HOD:     hod.cse@opticlass.edu        / hod123
echo   - Faculty: faculty.turing@opticlass.edu / faculty123
echo   - Student: student.cse@opticlass.edu    / student123
echo.

:: Launch FastAPI backend in a new command window
start "OptiClass AI Backend (Port 8000)" cmd /k "cd /d %~dp0backend && .\venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

:: Launch Vite frontend in a new command window
start "OptiClass AI Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

timeout /t 3 >nul
start http://localhost:5173

echo Servers are running. Close the spawned terminal windows to stop.
