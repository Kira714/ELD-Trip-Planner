"""
Geocoding (Nominatim) and Routing (OSRM) utilities.
Both APIs are free with no key required.
"""

import requests
import math

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "http://router.project-osrm.org/route/v1/driving"
HEADERS = {"User-Agent": "ELDTripPlanner/1.0 (educational project)"}


def geocode(location: str) -> dict:
    """
    Geocode a location string to lat/lng using Nominatim.
    Returns {"lat": float, "lng": float, "display_name": str}
    """
    params = {
        "q": location,
        "format": "json",
        "limit": 1,
        "countrycodes": "us",
    }
    try:
        resp = requests.get(NOMINATIM_URL, params=params, headers=HEADERS, timeout=6)
        resp.raise_for_status()
        results = resp.json()
        if results:
            r = results[0]
            return {
                "lat": float(r["lat"]),
                "lng": float(r["lon"]),
                "display_name": r.get("display_name", location),
            }
    except Exception as e:
        print(f"Geocoding failed for '{location}': {e}")

    # Fallback: return None so caller can handle
    return None


def suggest_locations(query: str, limit: int = 5) -> list:
    """
    Return up to `limit` location suggestions from Nominatim.
    Each item: {"display_name": str, "lat": float, "lng": float}
    """
    if not query or len(query.strip()) < 2:
        return []

    params = {
        "q": query.strip(),
        "format": "json",
        "limit": max(1, min(limit, 10)),
        "countrycodes": "us",
        "addressdetails": 0,
    }
    try:
        resp = requests.get(NOMINATIM_URL, params=params, headers=HEADERS, timeout=4)
        resp.raise_for_status()
        results = resp.json() or []
        suggestions = []
        for item in results:
            suggestions.append({
                "display_name": item.get("display_name", ""),
                "lat": float(item["lat"]),
                "lng": float(item["lon"]),
            })
        return suggestions
    except Exception as e:
        print(f"Location suggest failed for '{query}': {e}")
        return []


def get_route(waypoints: list) -> dict:
    """
    Get driving route between waypoints using OSRM.
    waypoints: list of {"lat": float, "lng": float}
    Returns {"distance_miles": float, "geometry": [{"lat", "lng"}], "legs": [...]}
    """
    if len(waypoints) < 2:
        return None

    coords = ";".join(f"{p['lng']},{p['lat']}" for p in waypoints)
    url = f"{OSRM_URL}/{coords}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
    }

    try:
        # Keep route lookup responsive; fallback kicks in if OSRM is slow.
        resp = requests.get(url, params=params, headers=HEADERS, timeout=8)
        resp.raise_for_status()
        data = resp.json()

        if data.get("code") == "Ok" and data.get("routes"):
            route = data["routes"][0]
            distance_m = route["distance"]
            distance_miles = distance_m * 0.000621371

            # Decode geometry
            coords_list = route["geometry"]["coordinates"]
            geometry = [{"lat": c[1], "lng": c[0]} for c in coords_list]

            # Per-leg distances
            legs = []
            for leg in route.get("legs", []):
                legs.append({
                    "distance_miles": leg["distance"] * 0.000621371,
                    "duration_hours": leg["duration"] / 3600,
                })

            return {
                "distance_miles": distance_miles,
                "geometry": geometry,
                "legs": legs,
            }
    except Exception as e:
        print(f"OSRM routing failed: {e}")

    # Fallback: haversine straight-line estimate
    return _fallback_route(waypoints)


def _haversine(lat1, lng1, lat2, lng2):
    """Straight-line distance in miles between two lat/lng points."""
    R = 3958.8  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _fallback_route(waypoints):
    """Straight-line route estimate when OSRM is unavailable."""
    total_miles = 0.0
    legs = []
    geometry = [waypoints[0]]

    for i in range(len(waypoints) - 1):
        p1, p2 = waypoints[i], waypoints[i + 1]
        d = _haversine(p1["lat"], p1["lng"], p2["lat"], p2["lng"])
        # Road factor: actual road distance ~1.3x straight line
        road_miles = d * 1.3
        total_miles += road_miles
        legs.append({
            "distance_miles": road_miles,
            "duration_hours": road_miles / 55.0,
        })
        # Interpolate a few midpoints for map rendering
        for t in [0.25, 0.5, 0.75, 1.0]:
            geometry.append({
                "lat": p1["lat"] + t * (p2["lat"] - p1["lat"]),
                "lng": p1["lng"] + t * (p2["lng"] - p1["lng"]),
            })

    return {
        "distance_miles": total_miles,
        "geometry": geometry,
        "legs": legs,
    }
