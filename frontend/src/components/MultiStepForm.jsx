import React, { useEffect, useMemo, useState } from 'react'
import { calculateTrip, suggestLocations } from '../utils/api'

const STEPS = [
  { id: 1, label: "Trip Details", icon: "📍" },
  { id: 2, label: "Calculating", icon: "⚡" },
]

const INPUT_STYLE = {
  width: '100%',
  padding: '16px 20px',
  border: '2px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  background: 'rgba(255,255,255,0.06)',
  color: 'white',
  fontFamily: 'Inter, sans-serif',
  fontSize: 16,
  outline: 'none',
  transition: 'all 0.2s',
}

function FormInput({ label, icon, value, onChange, placeholder, type = 'text', hint }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{
        fontSize: 12, fontWeight: 700, color: '#FFB347',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'flex', alignItems: 'center', gap: 6
      }}>
        {icon && <span>{icon}</span>} {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...INPUT_STYLE,
          borderColor: focused ? '#FF8C00' : 'rgba(255,255,255,0.12)',
          boxShadow: focused ? '0 0 0 3px rgba(255,140,0,0.15)' : 'none',
          background: focused ? 'rgba(255,140,0,0.08)' : 'rgba(255,255,255,0.06)',
        }}
      />
      {hint && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function LocationAutocompleteInput({ label, icon, value, onChange, placeholder, hint, options = [], loading = false }) {
  const [focused, setFocused] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const visibleOptions = useMemo(() => options.filter(Boolean).slice(0, 6), [options])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
      <label style={{
        fontSize: 12, fontWeight: 700, color: '#FFB347',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        display: 'flex', alignItems: 'center', gap: 6
      }}>
        {icon && <span>{icon}</span>} {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => {
          setFocused(true)
          setShowMenu(true)
        }}
        onBlur={() => {
          setFocused(false)
          // Delay close so click can select option.
          setTimeout(() => setShowMenu(false), 150)
        }}
        style={{
          ...INPUT_STYLE,
          borderColor: focused ? '#FF8C00' : 'rgba(255,255,255,0.12)',
          boxShadow: focused ? '0 0 0 3px rgba(255,140,0,0.15)' : 'none',
          background: focused ? 'rgba(255,140,0,0.08)' : 'rgba(255,255,255,0.06)',
        }}
      />
      {showMenu && (loading || visibleOptions.length > 0) && (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 74,
          background: '#1a2238',
          border: '1px solid rgba(255,255,255,0.16)',
          borderRadius: 10,
          overflow: 'hidden',
          zIndex: 20,
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        }}>
          {loading && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
              Searching places...
            </div>
          )}
          {!loading && visibleOptions.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={() => onChange(option)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.86)',
                fontSize: 13,
                padding: '10px 12px',
                cursor: 'pointer',
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {hint && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

export default function MultiStepForm({ onComplete, onBack }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingFrame, setLoadingFrame] = useState(0)

  const [driverName, setDriverName] = useState('')
  const [carrierName, setCarrierName] = useState('')
  const [truckNumber, setTruckNumber] = useState('')

  const [currentLocation, setCurrentLocation] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [dropoffLocation, setDropoffLocation] = useState('')
  const [cycleUsed, setCycleUsed] = useState('')
  const [currentLocationOptions, setCurrentLocationOptions] = useState([])
  const [pickupLocationOptions, setPickupLocationOptions] = useState([])
  const [dropoffLocationOptions, setDropoffLocationOptions] = useState([])
  const [pickupLoading, setPickupLoading] = useState(false)
  const [dropoffLoading, setDropoffLoading] = useState(false)

  const step1Valid = driverName.trim() && carrierName.trim() && currentLocation.trim() && pickupLocation.trim() && dropoffLocation.trim() &&
    cycleUsed !== '' && parseFloat(cycleUsed) >= 0 && parseFloat(cycleUsed) <= 70

  const handleSubmit = async () => {
    if (!step1Valid) return
    setStep(2)
    setLoading(true)
    setError(null)

    const messages = [
      'Geocoding your locations...',
      'Calculating route via OpenStreetMap...',
      'Running HOS compliance engine...',
      'Building your daily log sheets...',
      'Almost done...',
    ]
    let msgIdx = 0
    setLoadingMsg(messages[0])
    setLoadingProgress(8)
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length
      setLoadingMsg(messages[msgIdx])
    }, 1800)
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => Math.min(95, prev + (prev < 70 ? 6 : 2)))
    }, 550)
    const frameInterval = setInterval(() => {
      setLoadingFrame((prev) => (prev + 1) % 3)
    }, 420)

    try {
      const result = await calculateTrip({
        driver_name: driverName.trim(),
        carrier_name: carrierName.trim(),
        truck_number: truckNumber.trim() || 'Unit',
        current_location: currentLocation.trim(),
        pickup_location: pickupLocation.trim(),
        dropoff_location: dropoffLocation.trim(),
        current_cycle_used: parseFloat(cycleUsed),
      })
      clearInterval(interval)
      clearInterval(progressInterval)
      clearInterval(frameInterval)
      setLoadingProgress(100)
      onComplete(result)
    } catch (err) {
      clearInterval(interval)
      clearInterval(progressInterval)
      clearInterval(frameInterval)
      setError(err.message || 'Failed to calculate trip. Please try again.')
      setStep(1)
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!currentLocation || currentLocation.trim().length < 2) {
        setCurrentLocationOptions([])
        return
      }
      const controller = new AbortController()
      const current = await suggestLocations(currentLocation, 6, controller.signal)
      setCurrentLocationOptions(current.map((s) => s.display_name))
    }, 180)

    return () => clearTimeout(timer)
  }, [currentLocation])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (!pickupLocation || pickupLocation.trim().length < 2) {
        setPickupLocationOptions([])
        return
      }
      setPickupLoading(true)
      const pickup = await suggestLocations(pickupLocation, 6, controller.signal)
      setPickupLocationOptions(pickup.map((s) => s.display_name))
      setPickupLoading(false)
    }, 150)

    return () => {
      clearTimeout(timer)
      controller.abort()
      setPickupLoading(false)
    }
  }, [pickupLocation])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (!dropoffLocation || dropoffLocation.trim().length < 2) {
        setDropoffLocationOptions([])
        return
      }
      setDropoffLoading(true)
      const dropoff = await suggestLocations(dropoffLocation, 6, controller.signal)
      setDropoffLocationOptions(dropoff.map((s) => s.display_name))
      setDropoffLoading(false)
    }, 150)

    return () => {
      clearTimeout(timer)
      controller.abort()
      setDropoffLoading(false)
    }
  }, [dropoffLocation])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 40%, #0F3460 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '20px 40px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        gap: 16,
      }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10, padding: '8px 16px', color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer', fontSize: 14, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.2s'
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#FF8C00'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'}
        >
          ← Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24 }}>🚛</span>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>TruckLog Pro</span>
        </div>
      </div>

      {/* Progress steps */}
      <div style={{ padding: '32px 40px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: 500, width: '100%' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: step >= s.id
                    ? 'linear-gradient(135deg, #FF6B35, #FF8C00)'
                    : 'rgba(255,255,255,0.08)',
                  border: step === s.id ? '2px solid #FFB347' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, transition: 'all 0.3s',
                  boxShadow: step >= s.id ? '0 4px 15px rgba(255,107,53,0.4)' : 'none',
                }}>
                  {step > s.id ? '✓' : s.icon}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: step >= s.id ? '#FFB347' : 'rgba(255,255,255,0.3)',
                  whiteSpace: 'nowrap'
                }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: 2, marginBottom: 24,
                  background: step > s.id
                    ? 'linear-gradient(90deg, #FF6B35, #FF8C00)'
                    : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.3s',
                }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Form content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{
          width: '100%', maxWidth: 620,
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24,
          padding: '40px',
          animation: 'slide-up 0.4s ease-out',
        }}>

          {/* Step 1: Trip Details */}
          {step === 1 && (
            <>
              <h2 style={{ color: 'white', fontSize: 28, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                Plan your trip 📍
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 32, lineHeight: 1.6 }}>
                First enter personal details, then trip details. Pickup and dropoff have smart dropdown suggestions.
              </p>

              {error && (
                <div style={{
                  background: 'rgba(255,59,48,0.15)', border: '1px solid rgba(255,59,48,0.4)',
                  borderRadius: 12, padding: '14px 18px', marginBottom: 20,
                  color: '#FF6B6B', fontSize: 14, lineHeight: 1.5
                }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  padding: 14,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#FFB347', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                    Personal Info
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <FormInput
                      label="Driver Name"
                      icon="👤"
                      value={driverName}
                      onChange={setDriverName}
                      placeholder="John Doe"
                      hint="Required"
                    />
                    <FormInput
                      label="Carrier Name"
                      icon="🏢"
                      value={carrierName}
                      onChange={setCarrierName}
                      placeholder="ACME Transport"
                      hint="Required"
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <FormInput
                      label="Truck / Unit # (optional)"
                      icon="🚛"
                      value={truckNumber}
                      onChange={setTruckNumber}
                      placeholder="TRK-001"
                    />
                  </div>
                </div>

                <LocationAutocompleteInput label="Current Location" icon="📍" value={currentLocation} onChange={setCurrentLocation}
                  placeholder="Chicago, IL" hint="Where you are right now"
                  options={currentLocationOptions} />
                <LocationAutocompleteInput label="Pickup Location" icon="📦" value={pickupLocation} onChange={setPickupLocation}
                  placeholder="St. Louis, MO" hint="Where you'll pick up your load"
                  options={pickupLocationOptions}
                  loading={pickupLoading} />
                <LocationAutocompleteInput label="Dropoff Location" icon="🏁" value={dropoffLocation} onChange={setDropoffLocation}
                  placeholder="Dallas, TX" hint="Where you'll deliver the load"
                  options={dropoffLocationOptions}
                  loading={dropoffLoading} />

                <div>
                  <label style={{
                    fontSize: 12, fontWeight: 700, color: '#FFB347',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8
                  }}>
                    ⏱️ Current Cycle Used (Hours)
                  </label>
                  <input
                    type="number"
                    min="0" max="70" step="0.5"
                    value={cycleUsed}
                    onChange={e => setCycleUsed(e.target.value)}
                    placeholder="e.g. 14.5"
                    style={{
                      ...INPUT_STYLE,
                      borderColor: 'rgba(255,255,255,0.12)',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#FF8C00'
                      e.target.style.boxShadow = '0 0 0 3px rgba(255,140,0,0.15)'
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.12)'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6, lineHeight: 1.5 }}>
                    Hours already on-duty in your current 8-day cycle (0–70). This reduces your available driving time.
                  </div>
                  {cycleUsed !== '' && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4
                      }}>
                        <span>Cycle used: {parseFloat(cycleUsed) || 0}h</span>
                        <span>Remaining: {Math.max(0, 70 - (parseFloat(cycleUsed) || 0)).toFixed(1)}h</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${Math.min(100, ((parseFloat(cycleUsed) || 0) / 70) * 100)}%`,
                          background: parseFloat(cycleUsed) > 60
                            ? 'linear-gradient(90deg, #FF6B35, #FF3B30)'
                            : 'linear-gradient(90deg, #4ade80, #FF8C00)',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={!step1Valid || loading}
                  style={{ flex: 1, padding: '16px', fontSize: 17 }}
                >
                  Calculate My Trip ⚡
                </button>
              </div>
            </>
          )}

          {/* Step 3: Loading */}
          {step === 2 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  width: 80, height: 80, margin: '0 auto 24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(255,107,53,0.2), rgba(255,165,0,0.1))',
                  border: '3px solid rgba(255,107,53,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 36,
                  animation: 'bounce 1s ease-in-out infinite',
                }}>
                  🚛
                </div>
                <div style={{ fontSize: 26, marginTop: -6 }}>
                  {loadingFrame === 0 ? '🗺️  •••' : loadingFrame === 1 ? '🧭  ••••' : '📋  •••••'}
                </div>
              </div>

              <h2 style={{ color: 'white', fontSize: 26, fontWeight: 800, marginBottom: 12 }}>
                Planning Your Trip
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, marginBottom: 32, lineHeight: 1.6, minHeight: 48 }}>
                {loadingMsg}
              </p>
              <div style={{ color: '#FFB347', fontSize: 22, fontWeight: 800, marginBottom: 14 }}>
                {loadingProgress}%
              </div>

              {/* Progress bar */}
              <div style={{
                height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3,
                overflow: 'hidden', maxWidth: 300, margin: '0 auto'
              }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  background: 'linear-gradient(90deg, #FF6B35, #FFA500)',
                  width: `${loadingProgress}%`,
                  transition: 'width 0.45s ease',
                }} />
              </div>

              <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                {[
                  '✓ HOS compliance rules loaded',
                  '✓ 70-hour/8-day cycle verified',
                  '⚡ Building daily schedule and log sheets...',
                ].map((item, i) => (
                  <div key={i} style={{
                    fontSize: 13, color: i < 2 ? '#4ade80' : 'rgba(255,255,255,0.5)',
                    animation: `fade-in 0.5s ease-out ${i * 0.3}s both`,
                  }}>{item}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
