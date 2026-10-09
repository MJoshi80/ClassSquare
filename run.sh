#!/bin/bash
set -e

echo "=========================================================="
echo "  ClassSquare: Smart Timetable & Scheduling Platform"
echo "  Autonomous Academic Scheduling & Resource Optimization"
echo "=========================================================="

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Check Python & Node
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }

echo "[1/3] Checking Backend Environment..."
if [ ! -d "backend/venv" ]; then
    echo "Setting up Python virtual environment..."
    python3 -m venv backend/venv
    backend/venv/bin/pip install -r backend/requirements.txt
fi

echo "[2/3] Checking Database & Demo Dataset..."
if [ ! -f "backend/data/classsquare.db" ] && [ ! -f "backend/data/smay.db" ]; then
    echo "Initializing demo dataset..."
    backend/venv/bin/python backend/seed_demo.py
fi

echo "[3/3] Launching ClassSquare Services..."
echo "  - Backend:  http://127.0.0.1:8000 (FastAPI Swagger Docs at /docs)"
echo "  - Frontend: http://localhost:5173 (Vite React App)"
echo ""
echo "Demo Accounts:"
echo "  - Admin:   admin@opticlass.edu          / admin123"
echo "  - HOD:     hod.cse@opticlass.edu        / hod123"
echo "  - Faculty: faculty.turing@opticlass.edu / faculty123"
echo "  - Student: student.cse@opticlass.edu    / student123"
echo ""

# Trap to kill background processes on exit
trap 'kill $(jobs -p)' EXIT

# Start Backend
backend/venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --app-dir backend &

# Start Frontend
(cd frontend && npm run dev) &

wait
