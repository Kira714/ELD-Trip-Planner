"""
Geocoding (Nominatim) and Routing (OSRM) utilities.
Both APIs are free with no key required.
"""

import requests
import math
import time
import os

from eldapp.offline_us_locations import offline_geocode, offline_suggest

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "http://router.project-osrm.org/route/v1/driving"
HEADERS = {"User-Agent": "ELDTripPlanner/1.0 (educational project)"}
SUGGEST_CACHE_TTL_SEC = 60 * 30
GEOCODE_CACHE_TTL_SEC = 60 * 60

_suggest_cache = {}
_geocode_cache = {}

# Fallback suggestions used when provider is unavailable or returns nothing.
_FALLBACK_LOCATIONS = [
    "Chicago, IL",
    "St Louis, MO",
    "Dallas, TX",
    "Houston, TX",
    "Atlanta, GA",
    "Nashville, TN",
    "Indianapolis, IN",
    "Kansas City, MO",
    "Denver, CO",
    "Los Angeles, CA",
    "Phoenix, AZ",
    "Seattle, WA",
    "Miami, FL",
    "Columbus, OH",
    "Memphis, TN",
    "Louisville, KY",
    "Cincinnati, OH",
    "Minneapolis, MN",
    "Salt Lake City, UT",
    "New York, NY",
]

_FALLBACK_CITY_COORDS = {
    "chicago, il": {"lat": 41.8781, "lng": -87.6298},
    "st louis, mo": {"lat": 38.6270, "lng": -90.1994},
    "saint louis, mo": {"lat": 38.6270, "lng": -90.1994},
    "dallas, tx": {"lat": 32.7767, "lng": -96.7970},
    "houston, tx": {"lat": 29.7604, "lng": -95.3698},
    "atlanta, ga": {"lat": 33.7490, "lng": -84.3880},
    "nashville, tn": {"lat": 36.1627, "lng": -86.7816},
    "indianapolis, in": {"lat": 39.7684, "lng": -86.1581},
    "kansas city, mo": {"lat": 39.0997, "lng": -94.5786},
    "denver, co": {"lat": 39.7392, "lng": -104.9903},
    "los angeles, ca": {"lat": 34.0522, "lng": -118.2437},
    "phoenix, az": {"lat": 33.4484, "lng": -112.0740},
    "seattle, wa": {"lat": 47.6062, "lng": -122.3321},
    "miami, fl": {"lat": 25.7617, "lng": -80.1918},
    "columbus, oh": {"lat": 39.9612, "lng": -82.9988},
    "memphis, tn": {"lat": 35.1495, "lng": -90.0490},
    "louisville, ky": {"lat": 38.2527, "lng": -85.7585},
    "cincinnati, oh": {"lat": 39.1031, "lng": -84.5120},
    "minneapolis, mn": {"lat": 44.9778, "lng": -93.2650},
    "salt lake city, ut": {"lat": 40.7608, "lng": -111.8910},
    "new york, ny": {"lat": 40.7128, "lng": -74.0060},
}


def _cache_get(cache, key):
    entry = cache.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if expires_at < time.time():
        cache.pop(key, None)
        return None
    return value


def _cache_set(cache, key, value, ttl_sec):
    cache[key] = (time.time() + ttl_sec, value)


def _fallback_geocode(location: str):
    normalized = location.strip().lower()
    if normalized in _FALLBACK_CITY_COORDS:
        coords = _FALLBACK_CITY_COORDS[normalized]
        return {
            "lat": coords["lat"],
            "lng": coords["lng"],
            "display_name": location,
        }
    # Loose contains fallback (e.g. "Chicago, Illinois, USA")
    for city_key, coords in _FALLBACK_CITY_COORDS.items():
        if city_key in normalized or normalized in city_key:
            return {
                "lat": coords["lat"],
                "lng": coords["lng"],
                "display_name": city_key.title(),
            }
    return None


def geocode(location: str) -> dict:
    """
    Geocode a location string to lat/lng.
    Tries offline US reference first (reliable in prod), then Nominatim, then legacy fallback.
    Returns {"lat": float, "lng": float, "display_name": str}
    """
    cache_key = location.strip().lower()
    cached = _cache_get(_geocode_cache, cache_key)
    if cached:
        return cached

    # Offline DB first: avoids Nominatim blocking/timeouts on common lanes (e.g. Chicago, IL).
    off = offline_geocode(location)
    if off:
        _cache_set(_geocode_cache, cache_key, off, GEOCODE_CACHE_TTL_SEC)
        return off

    skip_remote = os.environ.get("SKIP_NOMINATIM", "").lower() in ("1", "true", "yes")
    if skip_remote:
        fb = _fallback_geocode(location)
        if fb:
            _cache_set(_geocode_cache, cache_key, fb, GEOCODE_CACHE_TTL_SEC)
        return fb

    params = {
        "q": location,
        "format": "json",
        "limit": 1,
        "countrycodes": "us",
    }
    nominatim_email = os.environ.get("NOMINATIM_EMAIL", "").strip()
    if nominatim_email:
        params["email"] = nominatim_email
    try:
        resp = requests.get(NOMINATIM_URL, params=params, headers=HEADERS, timeout=6)
        resp.raise_for_status()
        results = resp.json()
        if results:
            r = results[0]
            resolved = {
                "lat": float(r["lat"]),
                "lng": float(r["lon"]),
                "display_name": r.get("display_name", location),
            }
            _cache_set(_geocode_cache, cache_key, resolved, GEOCODE_CACHE_TTL_SEC)
            return resolved
    except Exception as e:
        print(f"Geocoding failed for '{location}': {e}")

    # Fallback: built-in city/state resolver for common US logistics cities.
    fallback = _fallback_geocode(location)
    if fallback:
        _cache_set(_geocode_cache, cache_key, fallback, GEOCODE_CACHE_TTL_SEC)
        return fallback
    return None


def suggest_locations(query: str, limit: int = 5) -> list:
    """
    Return up to `limit` location suggestions: offline matches merged with Nominatim.
    Each item: {"display_name": str, "lat": float, "lng": float}
    """
    if not query or len(query.strip()) < 2:
        return []
    normalized = query.strip().lower()
    # v2 cache key: older entries used lat/lng 0.0 for string fallbacks.
    cache_key = f"v2:{normalized}:{limit}"
    cached = _cache_get(_suggest_cache, cache_key)
    if cached is not None:
        return cached

    offline = offline_suggest(query, limit)
    skip_remote = os.environ.get("SKIP_NOMINATIM", "").lower() in ("1", "true", "yes")
    # Very short queries match noise on Nominatim ("chi" -> unrelated "CHI" venues).
    short_query = len(normalized) <= 3
    if skip_remote or short_query:
        out = offline[:limit]
        _cache_set(_suggest_cache, cache_key, out, SUGGEST_CACHE_TTL_SEC)
        return out

    remote = []
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
        for item in results:
            remote.append({
                "display_name": item.get("display_name", ""),
                "lat": float(item["lat"]),
                "lng": float(item["lon"]),
            })
    except Exception as e:
        print(f"Location suggest failed for '{query}': {e}")

    seen = set()
    merged = []
    for item in offline + remote:
        name = (item.get("display_name") or "").strip()
        if not name:
            continue
        k = name.lower()
        if k in seen:
            continue
        seen.add(k)
        merged.append(item)
        if len(merged) >= limit:
            break

    if not merged:
        for item in _FALLBACK_LOCATIONS:
            if normalized in item.lower():
                og = offline_geocode(item)
                if og:
                    merged.append({
                        "display_name": og["display_name"],
                        "lat": og["lat"],
                        "lng": og["lng"],
                    })
                else:
                    merged.append({
                        "display_name": item,
                        "lat": 0.0,
                        "lng": 0.0,
                    })
            if len(merged) >= limit:
                break

    _cache_set(_suggest_cache, cache_key, merged, SUGGEST_CACHE_TTL_SEC)
    return merged[:limit]


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
