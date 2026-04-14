#!/bin/bash
# Start backend (Gunicorn) and frontend (Vite)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=============================="
echo "  TruckLog Pro - Dev Startup  "
echo "=============================="
echo ""

# Start backend using Gunicorn
echo "Starting backend via Gunicorn on http://localhost:8000 ..."
cd "$ROOT/backend"
export DJANGO_SETTINGS_MODULE=config.settings
gunicorn config.wsgi:application --config gunicorn.conf.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 2

# Start Vite frontend
echo "Starting React frontend on http://localhost:5173 ..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo ""
echo "=============================="
echo "App running:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  Health:   http://localhost:8000/api/healthz/"
echo "  API test: http://localhost:8000/api/calculate-trip/"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "=============================="

# Wait for both
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait $BACKEND_PID $FRONTEND_PID
