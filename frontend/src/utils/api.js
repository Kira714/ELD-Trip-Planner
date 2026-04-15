import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
})
const locationSuggestionCache = new Map()
const locationSuggestionInFlight = new Map()
const FALLBACK_LOCATIONS = [
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
]

function localFallbackSuggestions(query, limit) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return []
  return FALLBACK_LOCATIONS
    .filter((name) => name.toLowerCase().includes(q))
    .slice(0, limit)
    .map((display_name) => ({ display_name, lat: 0, lng: 0 }))
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
  if (locationSuggestionInFlight.has(key)) {
    return locationSuggestionInFlight.get(key)
  }
  const request = (async () => {
    try {
      const response = await api.get('/api/location-suggest/', {
        params: { q: query.trim(), limit },
        // 5s was frequently aborting in production while backend was still processing.
        timeout: 12000,
        signal,
      })
      const suggestions = response.data?.suggestions || []
      locationSuggestionCache.set(key, suggestions)
      return suggestions
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
        return []
      }
      const fallback = localFallbackSuggestions(query, limit)
      locationSuggestionCache.set(key, fallback)
      return fallback
    } finally {
      locationSuggestionInFlight.delete(key)
    }
  })()
  locationSuggestionInFlight.set(key, request)
  return request
}
