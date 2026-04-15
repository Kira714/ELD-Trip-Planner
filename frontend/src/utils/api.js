import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
})
const locationSuggestionCache = new Map()
// Keep this list in sync with backend/eldapp/offline_us_locations.py OFFLINE_PLACES.
const HARDCODED_LOCATIONS = [
  'Chicago, IL',
  'St Louis, MO',
  'Dallas, TX',
  'Houston, TX',
  'Atlanta, GA',
  'Nashville, TN',
  'Indianapolis, IN',
  'Kansas City, MO',
  'Denver, CO',
  'Los Angeles, CA',
  'Phoenix, AZ',
  'Seattle, WA',
  'Miami, FL',
  'Columbus, OH',
  'Memphis, TN',
  'Louisville, KY',
  'Cincinnati, OH',
  'Minneapolis, MN',
  'Salt Lake City, UT',
  'New York, NY',
  'Boston, MA',
  'Philadelphia, PA',
  'Washington, DC',
  'Baltimore, MD',
  'Charlotte, NC',
  'Raleigh, NC',
  'Jacksonville, FL',
  'Tampa, FL',
  'Orlando, FL',
  'San Antonio, TX',
  'Austin, TX',
  'Fort Worth, TX',
  'Oklahoma City, OK',
  'Tulsa, OK',
  'Albuquerque, NM',
  'Las Vegas, NV',
  'San Diego, CA',
  'San Francisco, CA',
  'Sacramento, CA',
  'Portland, OR',
  'Boise, ID',
  'Detroit, MI',
  'Milwaukee, WI',
  'Omaha, NE',
  'Des Moines, IA',
  'Little Rock, AR',
  'Birmingham, AL',
  'Mobile, AL',
  'New Orleans, LA',
  'Shreveport, LA',
  'Jackson, MS',
  'Knoxville, TN',
  'Chattanooga, TN',
  'Lexington, KY',
  'Richmond, VA',
  'Norfolk, VA',
  'Charleston, SC',
  'Savannah, GA',
  'Buffalo, NY',
  'Pittsburgh, PA',
  'Cleveland, OH',
  'Toledo, OH',
  'El Paso, TX',
  'Laredo, TX',
  'Corpus Christi, TX',
  'Baton Rouge, LA',
  'Green Bay, WI',
  'Fargo, ND',
  'Sioux Falls, SD',
  'Cheyenne, WY',
  'Anchorage, AK',
  'Honolulu, HI',
]

function normalizeLocationText(value) {
  return (value || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

function hasWordPrefix(queryNorm, candidateNorm) {
  return candidateNorm.split(/[,\s]+/).some((word) => word && word.startsWith(queryNorm))
}

function localHardcodedSuggestions(query, limit) {
  const q = normalizeLocationText(query)
  if (!q) return []
  const scored = HARDCODED_LOCATIONS.map((name) => {
    const n = normalizeLocationText(name)
    let score = 0
    if (n.startsWith(q)) score = 100 - n.length
    else if (q.length >= 4 && n.includes(q)) score = 50
    else if (hasWordPrefix(q, n)) score = 55
    return { name, score }
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => ({ display_name: row.name, lat: 0, lng: 0 }))
  return scored
}

export async function calculateTrip(payload) {
  try {
    const response = await api.post('/api/calculate-trip/', payload)
    return response.data
  } catch (err) {
    if (err.response?.data?.error) {
      throw new Error(err.response.data.error)
    }
    if (err.code === 'ECONNABORTED') {
      throw new Error('Trip planning timed out. Use pickup/drop from dropdown and try again.')
    }
    throw new Error('Unable to connect to the server. Is the backend running?')
  }
}

export async function suggestLocations(query, limit = 5, signal) {
  if (!query || query.trim().length < 2) return []
  const key = `${query.trim().toLowerCase()}::${limit}`
  if (locationSuggestionCache.has(key)) {
    return locationSuggestionCache.get(key)
  }
  // Intentionally frontend-only hardcoded suggestions: no API dependency for autocomplete.
  if (signal?.aborted) return []
  const suggestions = localHardcodedSuggestions(query, limit)
  locationSuggestionCache.set(key, suggestions)
  return suggestions
}
