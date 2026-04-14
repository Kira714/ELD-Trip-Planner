from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from datetime import date
from concurrent.futures import ThreadPoolExecutor

from .geocoding import geocode, get_route, suggest_locations
from .hos_calculator import calculate_trip_schedule


class HealthCheckView(APIView):
    """
    GET /api/healthz/
    Lightweight health check for uptime monitoring.
    """

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok"})


class LocationSuggestView(APIView):
    """
    GET /api/location-suggest/?q=...
    Returns lightweight location suggestions for dropdown/autocomplete.
    """

    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        limit_param = request.query_params.get("limit", "5")
        try:
            limit = int(limit_param)
        except ValueError:
            limit = 5

        suggestions = suggest_locations(query, limit=limit)
        return Response({"suggestions": suggestions})


class CalculateTripView(APIView):
    """
    POST /api/calculate-trip/
    Geocodes locations, gets route via OSRM, then runs HOS scheduler.
    """

    def post(self, request):
        data = request.data

        required = ["current_location", "pickup_location", "dropoff_location",
                    "current_cycle_used"]
        missing = [f for f in required if not data.get(f)]
        if missing:
            return Response(
                {"error": f"Missing required fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_location = data["current_location"].strip()
        pickup_location = data["pickup_location"].strip()
        dropoff_location = data["dropoff_location"].strip()
        driver_name = data.get("driver_name", "Driver").strip() or "Driver"
        carrier_name = data.get("carrier_name", "Independent").strip()
        truck_number = data.get("truck_number", "N/A").strip()

        try:
            current_cycle_used = float(data["current_cycle_used"])
        except (ValueError, TypeError):
            return Response(
                {"error": "current_cycle_used must be a number"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if current_cycle_used < 0 or current_cycle_used > 70:
            return Response(
                {"error": "current_cycle_used must be between 0 and 70 hours"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if current_cycle_used >= 70:
            return Response(
                {"error": "Current cycle used is 70h. No legal driving hours remain before cycle recapture."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Geocode all three locations in parallel to reduce wait time.
        with ThreadPoolExecutor(max_workers=3) as pool:
            future_current = pool.submit(geocode, current_location)
            future_pickup = pool.submit(geocode, pickup_location)
            future_dropoff = pool.submit(geocode, dropoff_location)
            geo_current = future_current.result()
            geo_pickup = future_pickup.result()
            geo_dropoff = future_dropoff.result()

        if not geo_current:
            return Response(
                {"error": f"Could not geocode current location: '{current_location}'"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not geo_pickup:
            return Response(
                {"error": f"Could not geocode pickup location: '{pickup_location}'"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not geo_dropoff:
            return Response(
                {"error": f"Could not geocode dropoff location: '{dropoff_location}'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Get route: current -> pickup -> dropoff
        waypoints = [
            {"lat": geo_current["lat"], "lng": geo_current["lng"]},
            {"lat": geo_pickup["lat"], "lng": geo_pickup["lng"]},
            {"lat": geo_dropoff["lat"], "lng": geo_dropoff["lng"]},
        ]
        route_data = get_route(waypoints)

        if not route_data:
            return Response(
                {"error": "Could not calculate route between locations"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Extract leg distances
        legs = route_data.get("legs", [])
        if len(legs) >= 2:
            distance_to_pickup = legs[0]["distance_miles"]
            distance_pickup_to_dropoff = legs[1]["distance_miles"]
        elif len(legs) == 1:
            distance_to_pickup = legs[0]["distance_miles"] * 0.3
            distance_pickup_to_dropoff = legs[0]["distance_miles"] * 0.7
        else:
            distance_to_pickup = route_data["distance_miles"] * 0.3
            distance_pickup_to_dropoff = route_data["distance_miles"] * 0.7

        total_distance = distance_to_pickup + distance_pickup_to_dropoff

        # 3. Run HOS scheduler
        try:
            schedule = calculate_trip_schedule(
                total_distance_miles=total_distance,
                distance_to_pickup=distance_to_pickup,
                distance_pickup_to_dropoff=distance_pickup_to_dropoff,
                current_cycle_used=current_cycle_used,
                start_location=current_location,
                pickup_location=pickup_location,
                dropoff_location=dropoff_location,
                start_date=date.today(),
                waypoints=waypoints,
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Build stop markers for the map
        # Approximate stop locations by interpolating along route geometry
        geometry = route_data.get("geometry", waypoints)
        stop_markers = _build_stop_markers(
            schedule["stop_events"],
            geo_current, geo_pickup, geo_dropoff,
            geometry
        )

        return Response({
            "driver_info": {
                "name": driver_name,
                "carrier": carrier_name,
                "truck_number": truck_number,
            },
            "route": {
                "geometry": geometry,
                "distance_miles": round(total_distance, 1),
                "stops": stop_markers,
                "start": {
                    "lat": geo_current["lat"],
                    "lng": geo_current["lng"],
                    "name": current_location,
                },
                "pickup": {
                    "lat": geo_pickup["lat"],
                    "lng": geo_pickup["lng"],
                    "name": pickup_location,
                },
                "dropoff": {
                    "lat": geo_dropoff["lat"],
                    "lng": geo_dropoff["lng"],
                    "name": dropoff_location,
                },
            },
            "daily_logs": schedule["daily_logs"],
            "trip_summary": schedule["trip_summary"],
        })


def _build_stop_markers(stop_events, geo_current, geo_pickup, geo_dropoff, geometry):
    """Build map marker data for each stop event."""
    markers = []
    type_icons = {
        "start": "🚛",
        "pickup": "📦",
        "dropoff": "🏁",
        "fuel": "⛽",
        "rest": "🛌",
        "end": "✅",
    }

    for evt in stop_events:
        stop_type = evt["type"]
        location = evt["location"]

        # Assign coordinates based on type
        if stop_type in ("start",):
            lat, lng = geo_current["lat"], geo_current["lng"]
        elif stop_type == "pickup":
            lat, lng = geo_pickup["lat"], geo_pickup["lng"]
        elif stop_type in ("dropoff", "end"):
            lat, lng = geo_dropoff["lat"], geo_dropoff["lng"]
        else:
            # Fuel/rest stops: interpolate along geometry
            lat, lng = _interpolate_geometry(geometry, 0.5)

        markers.append({
            "type": stop_type,
            "location": location,
            "lat": lat,
            "lng": lng,
            "icon": type_icons.get(stop_type, "📍"),
            "day": evt.get("day", 1),
            "hour": evt.get("hour", 0),
        })

    return markers


def _interpolate_geometry(geometry, fraction):
    """Get lat/lng at a fractional point along the route geometry."""
    if not geometry:
        return 0, 0
    idx = int(len(geometry) * fraction)
    idx = max(0, min(idx, len(geometry) - 1))
    pt = geometry[idx]
    return pt["lat"], pt["lng"]
