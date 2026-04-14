import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
})
const locationSuggestionCache = new Map()

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
  try {
    const response = await api.get('/api/location-suggest/', {
      params: { q: query.trim(), limit },
      timeout: 5000,
      signal,
    })
    const suggestions = response.data?.suggestions || []
    locationSuggestionCache.set(key, suggestions)
    return suggestions
  } catch (err) {
    if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
      return []
    }
    return []
  }
}
