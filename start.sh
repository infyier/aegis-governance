#!/bin/bash
# Aegis 1-Command Startup Script (Linux/macOS)

echo "🚀 Starting Aegis Governance Control Tower..."

# Start FastAPI Backend in background
python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start Vite React Frontend in background
cd frontend && npm run dev &
FRONTEND_PID=$!

# Kill both processes on exit / Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT INT TERM

wait
