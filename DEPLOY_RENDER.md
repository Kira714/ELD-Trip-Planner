# Render Deployment Guide

This project is configured for Render Blueprint deployment using `render.yaml`.

## Services Created

- `eld-trip-planner-backend` (Python web service, Gunicorn)
- `eld-trip-planner-frontend` (Static site, Vite build)
- `eld-trip-planner-db` (PostgreSQL)

All services are configured to `plan: free` in `render.yaml`.

## One-Time Setup

1. Push this repository to GitHub.
2. In Render, click **New +** -> **Blueprint**.
3. Select your repo and confirm `render.yaml`.
4. Render will provision backend, frontend, and database.

If your Render account/region does not offer a free PostgreSQL instance, create a free Neon or Supabase Postgres DB and set `DATABASE_URL` manually on backend, then remove/comment the `databases:` block from `render.yaml`.

## Important Post-Deploy Update

After first deploy, set these env vars on backend to your final domains:

- `DJANGO_ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`

If Render assigned different names than defaults in `render.yaml`, update:

- backend `DJANGO_ALLOWED_HOSTS` to your backend host
- frontend `VITE_API_URL` to your backend URL

## Runtime Details

- Backend start command:
  - `python manage.py migrate && gunicorn config.wsgi:application --config gunicorn.conf.py`
- Health endpoint:
  - `/api/healthz/`

## Local Production-Like Run

From project root:

```bash
./start-prod.sh
```

## Notes

- `DJANGO_DEBUG` is `False` by default.
- Database uses `DATABASE_URL` when present (PostgreSQL on Render).
- If backend URL changes, redeploy frontend after updating `VITE_API_URL`.
