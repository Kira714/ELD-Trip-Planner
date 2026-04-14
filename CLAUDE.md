# ELD Trip Planner — Project Context

## What This App Does
A full-stack Django + React app for truck drivers that:
1. Collects driver info (name, carrier, truck number) and trip details (current location, pickup, dropoff, cycle hours used)
2. Calculates a fully FMCSA-HOS-compliant trip schedule
3. Animates the ELD log being drawn live on screen
4. Shows an interactive Leaflet map with route, stops, rest points, fuel stops
5. Generates downloadable PDF log sheets (one per day)

## Stack
- **Backend**: Django 4.2 + Django REST Framework + django-cors-headers
- **Frontend**: React 18 + Vite, Leaflet.js, jsPDF + html2canvas, Framer Motion
- **Geocoding**: OpenStreetMap Nominatim (free, no key)
- **Routing**: OSRM public API (free, no key) — fallback: straight-line estimate
- **Map tiles**: OpenStreetMap (free)
- **PDF**: jsPDF with canvas-rendered ELD log grids

## FMCSA HOS Rules Enforced (Property-Carrying, 70hr/8-day)
| Rule | Limit |
|------|-------|
| Driving limit per shift | 11 hours |
| On-duty window per shift | 14 consecutive hours |
| Mandatory break | 30 min after 8 cumulative driving hours |
| Off-duty between shifts | 10 consecutive hours |
| Weekly cycle | 70 hours on-duty in any 8-day rolling period |
| Fuel stop | At least once every 1,000 miles |
| Pickup time | 1 hour (On Duty Not Driving) |
| Dropoff time | 1 hour (On Duty Not Driving) |
| Avg truck speed | 55 mph |

## Key Files
```
backend/
  eldapp/hos_calculator.py   ← Core HOS scheduling engine
  eldapp/geocoding.py        ← Nominatim geocoding + OSRM routing
  eldapp/views.py            ← /api/calculate-trip/ endpoint
  eldapp/serializers.py      ← Request/Response serialization
  config/settings.py         ← Django config (CORS, DRF)

frontend/src/
  App.jsx                    ← Route: landing → wizard → results
  components/
    LandingPage.jsx          ← Hero, animated orange truck, CTA
    MultiStepForm.jsx        ← Wizard: Step 1 driver info, Step 2 trip details
    ResultsPage.jsx          ← Map + log viewer + PDF download
    RouteMap.jsx             ← Leaflet map with markers and route polyline
    ELDLogCanvas.jsx         ← Canvas drawing of daily log with animation
  utils/
    api.js                   ← Axios calls to Django backend
    pdfExport.js             ← jsPDF export of ELD canvas per day
```

## API Contract
**POST /api/calculate-trip/**

Request:
```json
{
  "driver_name": "John Doe",
  "carrier_name": "ACME Transport",
  "truck_number": "TRK-001",
  "current_location": "Chicago, IL",
  "pickup_location": "St. Louis, MO",
  "dropoff_location": "Dallas, TX",
  "current_cycle_used": 14.5
}
```

Response:
```json
{
  "trip_summary": { "total_miles": 850, "total_days": 2, "total_driving_hours": 15.5 },
  "route": {
    "waypoints": [{"lat":..., "lng":...}],
    "stops": [{"type":"start|pickup|fuel|rest|dropoff", "location":"...", "lat":..., "lng":..., "arrival_time":"..."}]
  },
  "daily_logs": [{
    "day": 1,
    "date": "2024-01-15",
    "miles_today": 550,
    "segments": [{"status":"off_duty|driving|on_duty_not_driving|sleeper_berth", "start_hour":0.0, "end_hour":6.0, "location":"..."}],
    "totals": {"off_duty":10, "sleeper_berth":0, "driving":11, "on_duty_not_driving":3},
    "remarks": ["Chicago, IL - Start of shift", "Springfield, IL - 30-min break"]
  }]
}
```

## ELD Log Grid Drawing
- Canvas is 900×300px per day
- 24 columns (0–23 hours), 4 rows (Off Duty, Sleeper Berth, Driving, On Duty Not Driving)
- Each hour = 37.5px wide
- Horizontal solid line drawn in the row corresponding to duty status
- Vertical tick at status change transitions
- Remarks drawn below grid diagonally (as on real paper log)
- Animation: lines drawn segment-by-segment with requestAnimationFrame

## UI Theme
- Primary: Orange gradient (#FF6B35 → #FF8C00 → #FFA500)
- Secondary: Dark navy (#1A1A2E) for contrast
- Font: Inter (sans-serif)
- Animations: floating truck, gradient pulse, step slide-in transitions
- Inspired by schneiderjobs.com — clean, professional, driver-friendly

## Running Locally
```bash
# Backend
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000

# Frontend
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

## Deployment Notes
- Backend: Deployable to Railway.app or Render (free tier)
- Frontend: Deployable to Vercel (free)
- Set DJANGO_ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS accordingly
- VITE_API_URL env var points frontend to deployed backend URL

## Known Constraints / Decisions
- OSRM is a public demo API — may have rate limits. Fallback uses estimated driving time at 55mph
- No auth/login — app is stateless, trip data not persisted
- Multi-day logs: one canvas per day, scrollable in the UI, all exported to single PDF
- Cycle used hours (input) reduces available 70-hour weekly budget
- Pre/post-trip inspection: 30 min On Duty Not Driving at start/end of each day (included in 14-hour window)
