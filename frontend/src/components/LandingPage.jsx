import React, { useEffect, useRef } from 'react'

const FEATURES = [
  { icon: '🗺️', title: 'Smart Route Planning', desc: 'Real map routing from pickup to dropoff with fuel stops auto-calculated every 1,000 miles' },
  { icon: '⏱️', title: 'HOS Compliance Engine', desc: 'Enforces all FMCSA rules: 11-hr drive, 14-hr window, 30-min breaks, 70-hr/8-day cycle' },
  { icon: '📋', title: 'Live Log Animation', desc: 'Watch your daily ELD log fill out in real-time, just like drawing on paper' },
  { icon: '📄', title: 'PDF Download', desc: 'Download all daily log sheets as a print-ready PDF — one page per day' },
]

export default function LandingPage({ onStart }) {
  const truckRef = useRef(null)

  useEffect(() => {
    const truck = truckRef.current
    if (!truck) return
    let pos = -300
    const animate = () => {
      pos += 1.2
      if (pos > window.innerWidth + 300) pos = -300
      // Flip the emoji so it faces the driving direction.
      truck.style.transform = `translateX(${pos}px) scaleX(-1)`
      requestAnimationFrame(animate)
    }
    const raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 40%, #0F3460 100%)' }}>
      {/* Navigation */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #FF6B35, #FF8C00)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, boxShadow: '0 4px 15px rgba(255,107,53,0.4)'
          }}>🚛</div>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>TruckLog Pro</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>ELD Trip Planner</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <a href="#features" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>Features</a>
          <a href="#how" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>How It Works</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '80px 40px 60px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Animated gradient orbs */}
        <div style={{
          position: 'absolute', top: -100, left: '20%', width: 600, height: 600,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,53,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', top: 50, right: '10%', width: 400, height: 400,
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,165,0,0.1) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.3)',
          borderRadius: 100, padding: '8px 20px', marginBottom: 32,
          fontSize: 13, color: '#FFB347', fontWeight: 600, letterSpacing: '0.05em'
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6B35', display: 'inline-block', animation: 'pulse-glow 2s infinite' }} />
          FMCSA COMPLIANT • PROPERTY CARRIERS • 70HR/8-DAY
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 900, color: 'white',
          lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 24, position: 'relative'
        }}>
          Plan Your Route.<br />
          <span style={{
            background: 'linear-gradient(135deg, #FF6B35, #FFA500)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text'
          }}>Stay Compliant.</span><br />
          Drive Confident.
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)', color: 'rgba(255,255,255,0.65)',
          maxWidth: 600, margin: '0 auto 48px', lineHeight: 1.7
        }}>
          Enter your trip details and get a fully HOS-compliant route with animated ELD log sheets — ready to download in seconds.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={onStart}
            style={{ fontSize: 18, padding: '20px 48px', borderRadius: 16 }}>
            Plan My Trip →
          </button>
          <a href="#how" className="btn btn-secondary btn-lg"
            style={{ fontSize: 18, padding: '20px 48px', borderRadius: 16 }}>
            See How It Works
          </a>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 48, marginTop: 64,
          flexWrap: 'wrap'
        }}>
          {[
            { num: '100%', label: 'FMCSA Compliant' },
            { num: 'Free', label: 'No Credit Card' },
            { num: '<10s', label: 'Trip Calculated' },
            { num: 'PDF', label: 'Instant Download' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 32, fontWeight: 900, color: '#FF8C00',
                letterSpacing: '-0.02em'
              }}>{s.num}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 500, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Animated truck road */}
      <div style={{
        position: 'relative', height: 100, overflow: 'hidden',
        background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.3))',
        borderTop: '2px solid rgba(255,140,0,0.2)',
      }}>
        <div style={{
          position: 'absolute', bottom: 20, left: 0, right: 0,
          height: 3, background: 'repeating-linear-gradient(90deg, rgba(255,165,0,0.6) 0px, rgba(255,165,0,0.6) 40px, transparent 40px, transparent 80px)',
        }} />
        <div ref={truckRef} style={{
          position: 'absolute', bottom: 18, fontSize: 52,
          filter: 'drop-shadow(0 4px 12px rgba(255,107,53,0.5))',
          willChange: 'transform',
        }}>🚛</div>
      </div>

      {/* Features */}
      <section id="features" style={{ padding: '80px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center', color: 'white', fontSize: 'clamp(28px, 4vw, 48px)',
            fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em'
          }}>Everything You Need</h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 17, marginBottom: 56 }}>
            Built for real truck drivers. Powered by FMCSA rules.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className="card" style={{
                display: 'flex', flexDirection: 'column', gap: 16,
                transition: 'transform 0.2s, border-color 0.2s',
                cursor: 'default',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-6px)'
                  e.currentTarget.style.borderColor = 'rgba(255,140,0,0.4)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                }}
              >
                <div style={{ fontSize: 40 }}>{f.icon}</div>
                <h3 style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>{f.title}</h3>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{
        padding: '80px 40px',
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{
            textAlign: 'center', color: 'white', fontSize: 'clamp(28px, 4vw, 48px)',
            fontWeight: 800, marginBottom: 56, letterSpacing: '-0.02em'
          }}>How It Works</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { step: '01', title: 'Enter Trip Details', desc: 'Provide current location, pickup, dropoff, and cycle hours used.' },
              { step: '02', title: 'Watch the Magic', desc: 'Our engine calculates your HOS-compliant schedule and animates your ELD logs.' },
              { step: '03', title: 'Review the Filled Logs', desc: 'See map route details plus each generated daily log sheet.' },
              { step: '04', title: 'Download & Drive', desc: 'Export the completed daily logs as PDF and hit the road with confidence.' },
            ].map((s, i) => (
              <div key={i} style={{
                display: 'flex', gap: 32, padding: '32px 0',
                borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  fontSize: 48, fontWeight: 900, color: 'rgba(255,107,53,0.25)',
                  fontVariantNumeric: 'tabular-nums', minWidth: 80, lineHeight: 1
                }}>{s.step}</div>
                <div>
                  <h3 style={{ color: 'white', fontWeight: 700, fontSize: 22, marginBottom: 10 }}>{s.title}</h3>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, lineHeight: 1.7 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 40px', textAlign: 'center' }}>
        <div style={{
          maxWidth: 700, margin: '0 auto',
          background: 'linear-gradient(135deg, rgba(255,107,53,0.15), rgba(255,165,0,0.1))',
          border: '1px solid rgba(255,107,53,0.3)',
          borderRadius: 24, padding: '60px 40px',
        }}>
          <div style={{ fontSize: 56, marginBottom: 20 }}>🚛</div>
          <h2 style={{ color: 'white', fontSize: 36, fontWeight: 800, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Ready to Plan Your Trip?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, marginBottom: 32, lineHeight: 1.7 }}>
            Takes less than 2 minutes. No signup required.
          </p>
          <button className="btn btn-primary btn-lg" onClick={onStart}
            style={{ fontSize: 20, padding: '22px 56px' }}>
            Start Planning Now →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '24px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12
      }}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          © 2024 TruckLog Pro — For educational purposes. Not a substitute for professional compliance advice.
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          FMCSA HOS rules per 49 CFR Part 395
        </div>
      </footer>
    </div>
  )
}
