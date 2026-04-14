#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

BACKEND_PID=""
FRONTEND_PID=""
STOPPED=0

cleanup() {
  STOPPED=1
  echo ""
  echo "Stopping services..."
  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup INT TERM

start_backend() {
  echo "[backend] starting Gunicorn on :8000"
  cd "$BACKEND_DIR"
  export DJANGO_SETTINGS_MODULE=config.settings
  gunicorn config.wsgi:application --config gunicorn.conf.py &
  BACKEND_PID=$!
}

start_frontend() {
  echo "[frontend] starting on :5173"
  cd "$FRONTEND_DIR"
  npm run dev -- --host 0.0.0.0 --port 5173 &
  FRONTEND_PID=$!
}

echo "======================================="
echo " TruckLog Pro resilient dev launcher"
echo "======================================="
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:8000"
echo "Health:   http://localhost:8000/api/healthz/"
echo ""

start_backend
sleep 1
start_frontend

while [[ $STOPPED -eq 0 ]]; do
  sleep 3

  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[watchdog] backend exited, restarting..."
    start_backend
  fi

  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "[watchdog] frontend exited, restarting..."
    start_frontend
  fi
done
