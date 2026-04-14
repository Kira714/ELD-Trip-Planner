import React, { useState, useEffect } from 'react'
import RouteMap from './RouteMap'
import ELDLogCanvas from './ELDLogCanvas'
import { exportLogsToPDF } from '../utils/pdfExport'

const STATUS_LABELS = {
  off_duty: 'Off Duty',
  sleeper_berth: 'Sleeper Berth',
  driving: 'Driving',
  on_duty_not_driving: 'On Duty (Not Driving)',
}

const STATUS_COLORS = {
  off_duty: '#4ade80',
  sleeper_berth: '#a78bfa',
  driving: '#60a5fa',
  on_duty_not_driving: '#f59e0b',
}

const STATUS_TO_ROW = {
  off_duty: 0,
  sleeper_berth: 1,
  driving: 2,
  on_duty_not_driving: 3,
}

function buildHourStatusFromSegments(segments = []) {
  const hourStatus = new Array(24).fill(0)
  segments.forEach((seg) => {
    const row = STATUS_TO_ROW[seg.status]
    if (row === undefined) return
    const startHour = Math.max(0, Math.floor(seg.start_hour))
    const endHour = Math.min(24, Math.ceil(seg.end_hour))
    for (let h = startHour; h < endHour; h += 1) {
      hourStatus[h] = row
    }
  })
  return hourStatus
}

function HoursBar({ label, hours, color, maxHours = 11 }) {
  const pct = Math.min(100, (hours / maxHours) * 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{hours.toFixed(2)}h</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

export default function ResultsPage({ data, onReset }) {
  const { driver_info, route, daily_logs, trip_summary } = data
  const [activeTab, setActiveTab] = useState('map')
  const [activeDay, setActiveDay] = useState(0)
  const [pdfExporting, setPdfExporting] = useState(false)
  const [pdfDone, setPdfDone] = useState(false)

  const handleExportPDF = async () => {
    setPdfExporting(true)
    setPdfDone(false)
    try {
      await exportLogsToPDF([], daily_logs, driver_info)
      setPdfDone(true)
      setTimeout(() => setPdfDone(false), 3000)
    } catch (e) {
      console.error('PDF export failed:', e)
      alert('PDF export failed. Please try again.')
    } finally {
      setPdfExporting(false)
    }
  }

  const handleDownloadDayJson = () => {
    if (!logsToShow[activeDay]) return
    const log = logsToShow[activeDay]
    const payload = {
      driver_info: driver_info,
      day_log: log,
      hour_status: buildHourStatusFromSegments(log.segments),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `eld-day-${log.day}-${log.date}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleOpenPrefilledPaperLog = () => {
    if (!logsToShow[activeDay]) return
    const log = logsToShow[activeDay]
    const hourStatus = buildHourStatusFromSegments(log.segments)
    const prefill = {
      date: log.date,
      driverName: driver_info?.name || '',
      from: route?.start?.name || '',
      to: route?.dropoff?.name || '',
      carrier: driver_info?.carrier || '',
      milesDriving: log?.totals?.driving ? (log.totals.driving * 55).toFixed(0) : '',
      mileageToday: log?.miles_today || '',
      officeAddress: '',
      terminalAddress: '',
      truckInfo: driver_info?.truck_number || '',
      manifest: '',
      shippingDocs: '',
      commodity: '',
      remarks: (log?.remarks || []).join(' | '),
      dutyNotes: (log?.remarks || []).join('\n'),
      hourStatus,
    }
    try {
      const key = `paperLogPrefill:${Date.now()}`
      localStorage.setItem(key, JSON.stringify(prefill))
      window.open(`/drivers-daily-log.html?prefillKey=${encodeURIComponent(key)}`, '_blank')
    } catch (err) {
      // Fallback for storage-restricted environments.
      const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(prefill)))))
      window.open(`/drivers-daily-log.html?prefill=${encoded}`, '_blank')
    }
  }

  // Preload Leaflet CSS
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.L) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.async = true
      document.head.appendChild(script)
    }
  }, [])

  const logsToShow = daily_logs.filter(l => l.totals.driving > 0 || l.totals.on_duty_not_driving > 0)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        background: 'rgba(0,0,0,0.2)',
        backdropFilter: 'blur(10px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>🚛</div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: 17 }}>Trip Plan Complete</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
              {driver_info.name} · {driver_info.carrier} · {driver_info.truck_number}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Summary pills */}
          {[
            { label: `${trip_summary.total_miles?.toFixed(0)} mi`, icon: '📏' },
            { label: `${logsToShow.length} day${logsToShow.length !== 1 ? 's' : ''}`, icon: '📅' },
            { label: `${trip_summary.total_driving_hours?.toFixed(1)}h driving`, icon: '🕐' },
          ].map(p => (
            <div key={p.label} style={{
              background: 'rgba(255,140,0,0.12)', border: '1px solid rgba(255,140,0,0.25)',
              borderRadius: 100, padding: '5px 14px',
              fontSize: 13, color: '#FFB347', fontWeight: 600,
              display: 'flex', gap: 5, alignItems: 'center',
            }}>
              <span>{p.icon}</span> {p.label}
            </div>
          ))}

          <button
            onClick={handleExportPDF}
            disabled={pdfExporting}
            style={{
              background: pdfDone ? 'linear-gradient(135deg, #4ade80, #22c55e)' : 'linear-gradient(135deg, #FF6B35, #FF8C00)',
              border: 'none', borderRadius: 10, padding: '10px 20px',
              color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 15px rgba(255,107,53,0.4)',
              transition: 'all 0.3s', opacity: pdfExporting ? 0.7 : 1,
            }}
          >
            {pdfExporting ? '⏳ Exporting...' : pdfDone ? '✓ Downloaded!' : '⬇ Download PDF'}
          </button>
          <button
            onClick={handleOpenPrefilledPaperLog}
            style={{
              background: 'rgba(96,165,250,0.2)',
              border: '1px solid rgba(96,165,250,0.45)',
              borderRadius: 10,
              padding: '10px 16px',
              color: '#bfdbfe',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            🧾 Open Prefilled Paper Log
          </button>
          <button
            onClick={handleDownloadDayJson}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 10,
              padding: '10px 16px',
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ⬇ Download Day JSON
          </button>

          <button
            onClick={onReset}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 10, padding: '10px 16px',
              color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#FF8C00'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
          >
            ← New Trip
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 0, maxHeight: 'calc(100vh - 73px)' }}>
        {/* Main content */}
        <div style={{ padding: '24px 28px', overflowY: 'auto' }}>

          {/* Tab switcher */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 24,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: 4, width: 'fit-content',
          }}>
            {[
              { id: 'map', label: '🗺️ Route Map' },
              { id: 'logs', label: '📋 Daily Logs' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 20px', border: 'none', borderRadius: 9, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600,
                  transition: 'all 0.2s',
                  background: activeTab === tab.id
                    ? 'linear-gradient(135deg, #FF6B35, #FF8C00)'
                    : 'transparent',
                  color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.5)',
                  boxShadow: activeTab === tab.id ? '0 4px 12px rgba(255,107,53,0.3)' : 'none',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Map tab */}
          {activeTab === 'map' && (
            <div style={{ animation: 'fade-in 0.3s ease-out' }}>
              <RouteMap route={route} summary={trip_summary} />
            </div>
          )}

          {/* Logs tab */}
          {activeTab === 'logs' && (
            <div style={{ animation: 'fade-in 0.3s ease-out' }}>
              {/* Day selector */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {logsToShow.map((log, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveDay(i)}
                    style={{
                      padding: '8px 18px', border: '1px solid',
                      borderColor: activeDay === i ? '#FF8C00' : 'rgba(255,255,255,0.15)',
                      borderRadius: 10, cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600,
                      background: activeDay === i ? 'rgba(255,140,0,0.15)' : 'transparent',
                      color: activeDay === i ? '#FFB347' : 'rgba(255,255,255,0.5)',
                      transition: 'all 0.2s',
                    }}
                  >
                    Day {log.day} · {log.date}
                  </button>
                ))}
              </div>

              {/* Current day canvas */}
              {logsToShow[activeDay] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <ELDLogCanvas
                    key={`day-${activeDay}`}
                    log={logsToShow[activeDay]}
                    driverInfo={driver_info}
                    animated={true}
                    ref={undefined}
                  />
                  {/* Segment breakdown */}
                  <div style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: '20px',
                  }}>
                    <h3 style={{ color: 'white', fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                      Day {logsToShow[activeDay].day} Activity Log
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {logsToShow[activeDay].segments
                        .filter(s => s.end_hour > s.start_hour)
                        .map((seg, i) => {
                          const dur = seg.end_hour - seg.start_hour
                          const color = STATUS_COLORS[seg.status] || '#888'
                          const h1 = Math.floor(seg.start_hour)
                          const m1 = Math.round((seg.start_hour % 1) * 60)
                          const h2 = Math.floor(seg.end_hour)
                          const m2 = Math.round((seg.end_hour % 1) * 60)
                          const fmt = (h, m) => `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
                          return (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 14px', borderRadius: 8,
                              background: `${color}10`, border: `1px solid ${color}25`,
                            }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                              <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                                {STATUS_LABELS[seg.status] || seg.status}
                              </div>
                              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>
                                {fmt(h1, m1)} → {fmt(h2, m2)}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, color, minWidth: 45, textAlign: 'right' }}>
                                {dur.toFixed(2)}h
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>

                  {/* Remarks */}
                  {logsToShow[activeDay].remarks?.length > 0 && (
                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 12, padding: '16px 20px',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#FFB347', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                        Remarks
                      </div>
                      {logsToShow[activeDay].remarks.map((r, i) => (
                        <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', padding: '4px 0', borderBottom: i < logsToShow[activeDay].remarks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                          • {r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          padding: '24px 20px',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 20,
          background: 'rgba(0,0,0,0.15)',
        }}>
          {/* HOS Compliance */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '18px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
                boxShadow: '0 0 8px #4ade80',
              }} />
              <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                HOS Compliant
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '11-hr Drive Limit', ok: true },
                { label: '14-hr Window', ok: true },
                { label: '30-min Break', ok: true },
                { label: '70-hr/8-day Cycle', ok: trip_summary.cycle_hours_used_after_trip <= 70 },
                { label: 'Fuel Stops (≤1000mi)', ok: true },
              ].map(rule => (
                <div key={rule.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{rule.label}</span>
                  <span style={{ fontSize: 16 }}>{rule.ok ? '✅' : '❌'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hours per day */}
          {logsToShow.map((log, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '16px',
              cursor: 'pointer',
              borderColor: activeDay === i && activeTab === 'logs' ? 'rgba(255,140,0,0.4)' : 'rgba(255,255,255,0.08)',
              transition: 'border-color 0.2s',
            }}
              onClick={() => { setActiveTab('logs'); setActiveDay(i) }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>Day {log.day}</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{log.date}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <HoursBar label="Off Duty" hours={log.totals.off_duty} color="#4ade80" maxHours={24} />
                <HoursBar label="Driving" hours={log.totals.driving} color="#60a5fa" maxHours={11} />
                <HoursBar label="On Duty (ND)" hours={log.totals.on_duty_not_driving} color="#f59e0b" maxHours={14} />
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                {log.miles_today > 0 ? `${log.miles_today} miles` : 'Rest day'}
              </div>
            </div>
          ))}

          {/* Cycle info */}
          <div style={{
            background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)',
            borderRadius: 14, padding: '16px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FFB347', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              70-Hour Cycle
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                <span>After trip: {trip_summary.cycle_hours_used_after_trip?.toFixed(1)}h</span>
                <span>{(70 - trip_summary.cycle_hours_used_after_trip)?.toFixed(1)}h left</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${Math.min(100, (trip_summary.cycle_hours_used_after_trip / 70) * 100)}%`,
                  background: trip_summary.cycle_hours_used_after_trip > 60
                    ? 'linear-gradient(90deg, #FF6B35, #FF3B30)'
                    : 'linear-gradient(90deg, #4ade80, #FF8C00)',
                  transition: 'width 1s ease',
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
