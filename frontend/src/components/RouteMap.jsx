import React, { useEffect, useRef } from 'react'

const STATUS_COLORS = {
  start: '#FF6B35',
  pickup: '#4ade80',
  dropoff: '#60a5fa',
  fuel: '#FFA500',
  rest: '#a78bfa',
  end: '#60a5fa',
}

const STATUS_LABELS = {
  start: 'Start',
  pickup: 'Pickup',
  dropoff: 'Dropoff',
  fuel: 'Fuel Stop',
  rest: 'Rest Stop',
  end: 'End',
}

export default function RouteMap({ route, summary }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (!route || initialized.current) return
    if (typeof window === 'undefined') return

    // Dynamically load Leaflet
    const L = window.L
    if (!L) {
      console.warn('Leaflet not loaded')
      return
    }

    initialized.current = true

    // Center map on route
    const allLat = route.geometry.map(p => p.lat)
    const allLng = route.geometry.map(p => p.lng)
    const centerLat = (Math.min(...allLat) + Math.max(...allLat)) / 2
    const centerLng = (Math.min(...allLng) + Math.max(...allLng)) / 2

    const map = L.map(mapRef.current, {
      center: [centerLat, centerLng],
      zoom: 6,
      zoomControl: true,
    })

    mapInstanceRef.current = map

    // OpenStreetMap tiles (free, no key)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    // Draw route polyline
    if (route.geometry && route.geometry.length > 1) {
      const latLngs = route.geometry.map(p => [p.lat, p.lng])
      L.polyline(latLngs, {
        color: '#FF8C00',
        weight: 5,
        opacity: 0.9,
        dashArray: null,
      }).addTo(map)
    }

    // Add markers for key stops
    const uniqueStops = []
    const seenTypes = new Set()
    for (const stop of route.stops || []) {
      const key = `${stop.type}-${stop.location}`
      if (!seenTypes.has(key)) {
        seenTypes.add(key)
        uniqueStops.push(stop)
      }
    }

    // Also add start/pickup/dropoff from route info
    const keyPoints = [
      { ...route.start, type: 'start', icon: '🚛' },
      { ...route.pickup, type: 'pickup', icon: '📦' },
      { ...route.dropoff, type: 'dropoff', icon: '🏁' },
    ]

    keyPoints.forEach(pt => {
      if (!pt.lat || !pt.lng) return
      const color = STATUS_COLORS[pt.type] || '#FF8C00'
      const icon = L.divIcon({
        html: `
          <div style="
            background: ${color};
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            width: 36px; height: 36px;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 3px 12px rgba(0,0,0,0.4);
            font-size: 16px;
          ">
            <span style="transform: rotate(45deg); display: block;">${pt.icon}</span>
          </div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
      })

      L.marker([pt.lat, pt.lng], { icon })
        .bindPopup(`
          <div style="font-family: Inter, sans-serif; min-width: 140px;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${STATUS_LABELS[pt.type] || pt.type}</div>
            <div style="color: #555; font-size: 12px;">${pt.name || ''}</div>
          </div>`)
        .addTo(map)
    })

    // Add fuel/rest stops
    ;(route.stops || []).forEach(stop => {
      if (!['fuel', 'rest'].includes(stop.type)) return
      if (!stop.lat || !stop.lng) return

      const color = STATUS_COLORS[stop.type] || '#888'
      const icon = L.divIcon({
        html: `<div style="
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">${stop.icon || '📍'}</div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      })

      L.marker([stop.lat, stop.lng], { icon })
        .bindPopup(`
          <div style="font-family: Inter, sans-serif; min-width: 140px;">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">${STATUS_LABELS[stop.type]}</div>
            <div style="color: #555; font-size: 12px;">${stop.location || ''}</div>
            <div style="color: #888; font-size: 11px; margin-top: 2px;">Day ${stop.day || 1}</div>
          </div>`)
        .addTo(map)
    })

    // Fit bounds
    const bounds = L.latLngBounds([
      [route.start.lat, route.start.lng],
      [route.pickup.lat, route.pickup.lng],
      [route.dropoff.lat, route.dropoff.lng],
    ])
    map.fitBounds(bounds, { padding: [40, 40] })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        initialized.current = false
      }
    }
  }, [route])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Map container */}
      <div style={{
        borderRadius: 16, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        height: 420,
        position: 'relative',
      }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 16, flexWrap: 'wrap', padding: '12px 16px',
        background: 'rgba(255,255,255,0.04)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {[
          { type: 'start', label: 'Start', icon: '🚛' },
          { type: 'pickup', label: 'Pickup', icon: '📦' },
          { type: 'dropoff', label: 'Dropoff', icon: '🏁' },
          { type: 'fuel', label: 'Fuel Stop', icon: '⛽' },
          { type: 'rest', label: 'Rest Stop', icon: '🛌' },
        ].map(item => (
          <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span>{item.icon}</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{item.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{ width: 24, height: 3, background: '#FF8C00', borderRadius: 2 }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Route</span>
        </div>
      </div>

      {/* Trip stats */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
          {[
            { label: 'Total Miles', value: `${summary.total_miles?.toFixed(0) || 0} mi`, icon: '📏' },
            { label: 'Trip Days', value: `${summary.total_days || 1} day${summary.total_days > 1 ? 's' : ''}`, icon: '📅' },
            { label: 'Drive Hours', value: `${summary.total_driving_hours?.toFixed(1) || 0}h`, icon: '🕐' },
            { label: 'Cycle After', value: `${summary.cycle_hours_used_after_trip?.toFixed(1) || 0}h / 70h`, icon: '⏱️' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '14px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ color: '#FF8C00', fontWeight: 700, fontSize: 20, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
