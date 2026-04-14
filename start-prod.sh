#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/backend"

export DJANGO_SETTINGS_MODULE=config.settings

exec gunicorn config.wsgi:application --config gunicorn.conf.py
