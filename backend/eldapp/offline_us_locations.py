"""
Offline US city/state reference for geocoding and autocomplete when remote APIs fail.

Each entry: display_name, lat, lng. Search matches normalized query against display_name
and common aliases.
"""

import re

# (display_name, lat, lng, *aliases) — aliases are optional extra lowercase strings to match
OFFLINE_PLACES = [
    ("Chicago, IL", 41.8781, -87.6298, "chicago illinois", "chi"),
    ("St Louis, MO", 38.6270, -90.1994, "st louis missouri", "saint louis mo", "stl"),
    ("Dallas, TX", 32.7767, -96.7970, "dallas texas"),
    ("Houston, TX", 29.7604, -95.3698, "houston texas"),
    ("Atlanta, GA", 33.7490, -84.3880, "atlanta georgia"),
    ("Nashville, TN", 36.1627, -86.7816, "nashville tennessee"),
    ("Indianapolis, IN", 39.7684, -86.1581, "indianapolis indiana", "indy"),
    ("Kansas City, MO", 39.0997, -94.5786, "kansas city missouri", "kc"),
    ("Denver, CO", 39.7392, -104.9903, "denver colorado"),
    ("Los Angeles, CA", 34.0522, -118.2437, "la california", "los angeles california"),
    ("Phoenix, AZ", 33.4484, -112.0740, "phoenix arizona"),
    ("Seattle, WA", 47.6062, -122.3321, "seattle washington"),
    ("Miami, FL", 25.7617, -80.1918, "miami florida"),
    ("Columbus, OH", 39.9612, -82.9988, "columbus ohio"),
    ("Memphis, TN", 35.1495, -90.0490, "memphis tennessee"),
    ("Louisville, KY", 38.2527, -85.7585, "louisville kentucky"),
    ("Cincinnati, OH", 39.1031, -84.5120, "cincinnati ohio"),
    ("Minneapolis, MN", 44.9778, -93.2650, "minneapolis minnesota", "mpls"),
    ("Salt Lake City, UT", 40.7608, -111.8910, "salt lake city utah", "slc"),
    ("New York, NY", 40.7128, -74.0060, "new york city", "nyc", "manhattan"),
    ("Boston, MA", 42.3601, -71.0589, "boston massachusetts"),
    ("Philadelphia, PA", 39.9526, -75.1652, "philadelphia pennsylvania", "philly"),
    ("Washington, DC", 38.9072, -77.0369, "washington dc", "dc"),
    ("Baltimore, MD", 39.2904, -76.6122, "baltimore maryland"),
    ("Charlotte, NC", 35.2271, -80.8431, "charlotte north carolina"),
    ("Raleigh, NC", 35.7796, -78.6382, "raleigh north carolina"),
    ("Jacksonville, FL", 30.3322, -81.6557, "jacksonville florida"),
    ("Tampa, FL", 27.9506, -82.4572, "tampa florida"),
    ("Orlando, FL", 28.5383, -81.3792, "orlando florida"),
    ("San Antonio, TX", 29.4241, -98.4936, "san antonio texas"),
    ("Austin, TX", 30.2672, -97.7431, "austin texas"),
    ("Fort Worth, TX", 32.7555, -97.3308, "fort worth texas"),
    ("Oklahoma City, OK", 35.4676, -97.5164, "oklahoma city oklahoma", "okc"),
    ("Tulsa, OK", 36.1540, -95.9928, "tulsa oklahoma"),
    ("Albuquerque, NM", 35.0844, -106.6504, "albuquerque new mexico"),
    ("Las Vegas, NV", 36.1699, -115.1398, "las vegas nevada", "vegas"),
    ("San Diego, CA", 32.7157, -117.1611, "san diego california"),
    ("San Francisco, CA", 37.7749, -122.4194, "san francisco california", "sf"),
    ("Sacramento, CA", 38.5816, -121.4944, "sacramento california"),
    ("Portland, OR", 45.5152, -122.6784, "portland oregon"),
    ("Boise, ID", 43.6150, -116.2023, "boise idaho"),
    ("Detroit, MI", 42.3314, -83.0458, "detroit michigan"),
    ("Milwaukee, WI", 43.0389, -87.9065, "milwaukee wisconsin"),
    ("Omaha, NE", 41.2565, -95.9345, "omaha nebraska"),
    ("Des Moines, IA", 41.5868, -93.6250, "des moines iowa"),
    ("Little Rock, AR", 34.7465, -92.2896, "little rock arkansas"),
    ("Birmingham, AL", 33.5207, -86.8025, "birmingham alabama"),
    ("Mobile, AL", 30.6954, -88.0399, "mobile alabama"),
    ("New Orleans, LA", 29.9511, -90.0715, "new orleans louisiana", "nola"),
    ("Shreveport, LA", 32.5252, -93.7502, "shreveport louisiana"),
    ("Jackson, MS", 32.2988, -90.1848, "jackson mississippi"),
    ("Knoxville, TN", 35.9606, -83.9207, "knoxville tennessee"),
    ("Chattanooga, TN", 35.0456, -85.3097, "chattanooga tennessee"),
    ("Lexington, KY", 38.0406, -84.5037, "lexington kentucky"),
    ("Richmond, VA", 37.5407, -77.4360, "richmond virginia"),
    ("Norfolk, VA", 36.8508, -76.2859, "norfolk virginia"),
    ("Charleston, SC", 32.7765, -79.9311, "charleston south carolina"),
    ("Savannah, GA", 32.0809, -81.0912, "savannah georgia"),
    ("Buffalo, NY", 42.8864, -78.8784, "buffalo new york"),
    ("Pittsburgh, PA", 40.4406, -79.9959, "pittsburgh pennsylvania"),
    ("Cleveland, OH", 41.4993, -81.6944, "cleveland ohio"),
    ("Toledo, OH", 41.6528, -83.5379, "toledo ohio"),
    ("El Paso, TX", 31.7619, -106.4850, "el paso texas"),
    ("Laredo, TX", 27.5036, -99.5075, "laredo texas"),
    ("Corpus Christi, TX", 27.8006, -97.3964, "corpus christi texas"),
    ("Baton Rouge, LA", 30.4515, -91.1871, "baton rouge louisiana"),
    ("Green Bay, WI", 44.5133, -88.0133, "green bay wisconsin"),
    ("Fargo, ND", 46.8772, -96.7898, "fargo north dakota"),
    ("Sioux Falls, SD", 43.5446, -96.7311, "sioux falls south dakota"),
    ("Cheyenne, WY", 41.1400, -104.8202, "cheyenne wyoming"),
    ("Anchorage, AK", 61.2181, -149.9003, "anchorage alaska"),
    ("Honolulu, HI", 21.3069, -157.8583, "honolulu hawaii"),
]


def _normalize(s: str) -> str:
    if not s:
        return ""
    s = s.strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = s.replace(".", "")
    return s


def _word_prefix_match(key: str, text_norm: str) -> bool:
    """True if any comma/space-separated token starts with key (avoids 'chi' in 'michigan')."""
    if not key or not text_norm:
        return False
    for w in re.split(r"[\s,]+", text_norm):
        if w and (w.startswith(key) or w == key):
            return True
    return False


def offline_geocode(location: str):
    """Return dict lat/lng/display_name or None."""
    key = _normalize(location)
    if not key:
        return None
    for row in OFFLINE_PLACES:
        display = row[0]
        lat, lng = row[1], row[2]
        aliases = row[3:] if len(row) > 3 else ()
        candidates = {_normalize(display), *(_normalize(a) for a in aliases)}
        if key in candidates or key == _normalize(display):
            return {"lat": lat, "lng": lng, "display_name": display}
        # prefix match on city part (e.g. "chicago" matches "chicago, il")
        disp_norm = _normalize(display)
        if key == disp_norm or disp_norm.startswith(key + ",") or disp_norm.startswith(key + " "):
            return {"lat": lat, "lng": lng, "display_name": display}
        for a in aliases:
            an = _normalize(a)
            if key == an or an.startswith(key) or _word_prefix_match(key, an):
                return {"lat": lat, "lng": lng, "display_name": display}
    # Longer substring (e.g. user pasted "chicago illinois" without comma)
    for row in OFFLINE_PLACES:
        display, lat, lng = row[0], row[1], row[2]
        aliases = row[3:] if len(row) > 3 else ()
        hay = _normalize(display)
        if len(key) >= 4 and (key in hay or hay in key):
            return {"lat": lat, "lng": lng, "display_name": display}
        for a in aliases:
            an = _normalize(a)
            if len(key) >= 4 and (key in an or an in key):
                return {"lat": lat, "lng": lng, "display_name": display}
    return None


def offline_suggest(query: str, limit: int = 6):
    """Return list of {display_name, lat, lng} from offline DB only."""
    key = _normalize(query)
    if len(key) < 1:
        return []
    scored = []
    for row in OFFLINE_PLACES:
        display, lat, lng = row[0], row[1], row[2]
        aliases = row[3:] if len(row) > 3 else ()
        disp_norm = _normalize(display)
        score = 0
        if disp_norm.startswith(key):
            score = 100 - len(disp_norm)
        elif len(key) >= 4 and key in disp_norm:
            score = 50
        elif _word_prefix_match(key, disp_norm):
            score = 55
        else:
            for a in aliases:
                an = _normalize(a)
                if an.startswith(key) or key == an or _word_prefix_match(key, an):
                    score = 40
                    break
                if len(key) >= 4 and key in an:
                    score = 40
                    break
        if score > 0:
            scored.append((score, {"display_name": display, "lat": lat, "lng": lng}))
    scored.sort(key=lambda x: -x[0])
    return [x[1] for x in scored[:limit]]
