import React, { useEffect, useRef, useState } from 'react'

// ELD log grid constants
const GRID_MARGIN_LEFT = 170
const GRID_MARGIN_RIGHT = 160
const GRID_TOP = 96
const GRID_ROW_HEIGHT = 52
const GRID_ROWS = 4  // Off Duty, Sleeper Berth, Driving, On Duty ND
const GRID_BOTTOM_LABEL = 36
const REMARKS_HEIGHT = 120
const CANVAS_WIDTH = 1320
const CANVAS_HEIGHT = GRID_TOP + GRID_ROWS * GRID_ROW_HEIGHT + GRID_BOTTOM_LABEL + REMARKS_HEIGHT + 84

const ROW_LABELS = ['Off Duty', 'Sleeper\nBerth', 'Driving', 'On Duty\n(Not Drv)']
const OFF_DUTY = 'off_duty'
const SLEEPER_BERTH = 'sleeper_berth'
const DRIVING = 'driving'
const ON_DUTY_ND = 'on_duty_not_driving'
const STATUS_ROW = {
  off_duty: 0,
  sleeper_berth: 1,
  driving: 2,
  on_duty_not_driving: 3,
}
const STATUS_COLORS = {
  off_duty: '#4ade80',
  sleeper_berth: '#a78bfa',
  driving: '#60a5fa',
  on_duty_not_driving: '#f59e0b',
}

const HOUR_WIDTH = (CANVAS_WIDTH - GRID_MARGIN_LEFT - GRID_MARGIN_RIGHT) / 24

function hourToX(hour) {
  return GRID_MARGIN_LEFT + hour * HOUR_WIDTH
}

function rowToY(row) {
  return GRID_TOP + row * GRID_ROW_HEIGHT + GRID_ROW_HEIGHT / 2
}

function drawInlineField(ctx, label, value, x, y, maxWidth) {
  ctx.fillStyle = '#333'
  ctx.font = 'bold 11px Inter, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`${label}:`, x, y)
  const prefixWidth = ctx.measureText(`${label}: `).width
  ctx.font = '11px Inter, sans-serif'
  const text = String(value ?? '')
  let clipped = text
  while (clipped.length > 0 && ctx.measureText(clipped).width > (maxWidth - prefixWidth)) {
    clipped = clipped.slice(0, -1)
  }
  if (clipped !== text && clipped.length > 3) {
    clipped = `${clipped.slice(0, -3)}...`
  }
  ctx.fillText(clipped, x + prefixWidth + 2, y)
}

function mergeAdjacentSegments(segments) {
  if (!segments.length) return segments
  const merged = [{ ...segments[0] }]
  for (let i = 1; i < segments.length; i += 1) {
    const current = segments[i]
    const last = merged[merged.length - 1]
    if (current.status === last.status && Math.abs(current.start_hour - last.end_hour) < 0.0001) {
      last.end_hour = current.end_hour
    } else {
      merged.push({ ...current })
    }
  }
  return merged
}

export function prepareLogForRender(log) {
  const rawSegments = Array.isArray(log?.segments) ? log.segments : []
  const filtered = rawSegments
    .map((seg) => ({
      status: seg.status,
      start_hour: Number(seg.start_hour),
      end_hour: Number(seg.end_hour),
      location: seg.location,
    }))
    .filter((seg) => STATUS_ROW[seg.status] !== undefined && Number.isFinite(seg.start_hour) && Number.isFinite(seg.end_hour))
    .map((seg) => ({
      ...seg,
      start_hour: Math.max(0, Math.min(24, seg.start_hour)),
      end_hour: Math.max(0, Math.min(24, seg.end_hour)),
    }))
    .filter((seg) => seg.end_hour > seg.start_hour)
    .sort((a, b) => a.start_hour - b.start_hour)

  const normalized = []
  let cursor = 0
  for (const seg of filtered) {
    if (seg.start_hour > cursor) {
      normalized.push({
        status: OFF_DUTY,
        start_hour: cursor,
        end_hour: seg.start_hour,
        location: seg.location,
      })
    }
    const start = Math.max(cursor, seg.start_hour)
    const end = Math.min(24, seg.end_hour)
    if (end > start) {
      normalized.push({ ...seg, start_hour: start, end_hour: end })
      cursor = end
    }
    if (cursor >= 24) break
  }
  if (normalized.length === 0) {
    normalized.push({ status: OFF_DUTY, start_hour: 0, end_hour: 24, location: '' })
  } else if (cursor < 24) {
    normalized.push({
      status: OFF_DUTY,
      start_hour: cursor,
      end_hour: 24,
      location: normalized[normalized.length - 1].location,
    })
  }

  const merged = mergeAdjacentSegments(normalized)
  const totals = {
    [OFF_DUTY]: 0,
    [SLEEPER_BERTH]: 0,
    [DRIVING]: 0,
    [ON_DUTY_ND]: 0,
  }
  merged.forEach((seg) => {
    totals[seg.status] += seg.end_hour - seg.start_hour
  })
  Object.keys(totals).forEach((key) => {
    totals[key] = Number(totals[key].toFixed(2))
  })

  return { segments: merged, totals, totalHours: 24 }
}

function drawBlankGrid(ctx, driverInfo, dayInfo) {
  const W = CANVAS_WIDTH
  ctx.clearRect(0, 0, W, CANVAS_HEIGHT)

  // Background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, CANVAS_HEIGHT)

  // Header box
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, W, 56)

  // Title text
  ctx.fillStyle = '#FF8C00'
  ctx.font = 'bold 16px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText("DRIVER'S DAILY LOG — ONE CALENDAR DAY (24 HOURS)", W / 2, 22)
  ctx.fillStyle = '#aaa'
  ctx.font = '11px Inter, sans-serif'
  ctx.fillText('U.S. DEPARTMENT OF TRANSPORTATION', W / 2, 40)

  // Date / driver info bar
  ctx.fillStyle = '#f5f5f5'
  ctx.fillRect(0, 56, W, 34)
  const fieldY = 77
  const gap = 10
  const dateW = 180
  const driverW = 250
  const carrierW = 280
  const truckW = 170
  const milesW = 140
  drawInlineField(ctx, 'Date', dayInfo.date || '', 10, fieldY, dateW)
  drawInlineField(ctx, 'Driver', driverInfo.name || '', 10 + dateW + gap, fieldY, driverW)
  drawInlineField(ctx, 'Carrier', driverInfo.carrier || '', 10 + dateW + driverW + gap * 2, fieldY, carrierW)
  drawInlineField(ctx, 'Truck', driverInfo.truck_number || '', 10 + dateW + driverW + carrierW + gap * 3, fieldY, truckW)
  drawInlineField(ctx, 'Miles Today', dayInfo.miles_today ?? 0, 10 + dateW + driverW + carrierW + truckW + gap * 4, fieldY, milesW)
  ctx.fillStyle = '#333'
  ctx.font = 'bold 11px Inter, sans-serif'
  ctx.textAlign = 'right'
  // Keep day label left of totals column to avoid any overlap.
  ctx.fillText(`Day ${dayInfo.day} of trip`, W - GRID_MARGIN_RIGHT - 10, fieldY)

  // Grid area background
  ctx.fillStyle = '#FAFAFA'
  ctx.fillRect(GRID_MARGIN_LEFT, GRID_TOP, W - GRID_MARGIN_LEFT - GRID_MARGIN_RIGHT, GRID_ROWS * GRID_ROW_HEIGHT)

  // Row dividers and labels
  for (let r = 0; r <= GRID_ROWS; r++) {
    const y = GRID_TOP + r * GRID_ROW_HEIGHT
    ctx.strokeStyle = r === 0 || r === GRID_ROWS ? '#333' : '#ccc'
    ctx.lineWidth = r === 0 || r === GRID_ROWS ? 1.5 : 0.5
    ctx.beginPath()
    ctx.moveTo(GRID_MARGIN_LEFT, y)
    ctx.lineTo(W - GRID_MARGIN_RIGHT, y)
    ctx.stroke()

    // Row label
    if (r < GRID_ROWS) {
      const label = ROW_LABELS[r]
      const lines = label.split('\n')
      ctx.fillStyle = '#333'
      ctx.font = 'bold 12px Inter, sans-serif'
      ctx.textAlign = 'right'
      const midY = GRID_TOP + r * GRID_ROW_HEIGHT + GRID_ROW_HEIGHT / 2
      if (lines.length === 1) {
        ctx.fillText(lines[0], GRID_MARGIN_LEFT - 8, midY + 4)
      } else {
        ctx.fillText(lines[0], GRID_MARGIN_LEFT - 8, midY - 2)
        ctx.font = '11px Inter, sans-serif'
        ctx.fillText(lines[1], GRID_MARGIN_LEFT - 8, midY + 10)
      }
    }
  }

  // Left/right borders of grid
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(GRID_MARGIN_LEFT, GRID_TOP)
  ctx.lineTo(GRID_MARGIN_LEFT, GRID_TOP + GRID_ROWS * GRID_ROW_HEIGHT)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(W - GRID_MARGIN_RIGHT, GRID_TOP)
  ctx.lineTo(W - GRID_MARGIN_RIGHT, GRID_TOP + GRID_ROWS * GRID_ROW_HEIGHT)
  ctx.stroke()

  // Hour tick marks and labels
  for (let h = 0; h <= 24; h++) {
    const x = hourToX(h)

    // Major tick at each hour
    const isMajor = h % 6 === 0 || h === 12
    ctx.strokeStyle = isMajor ? '#555' : '#bbb'
    ctx.lineWidth = isMajor ? 1 : 0.5

    // Vertical grid lines (minor)
    if (h > 0 && h < 24) {
      ctx.beginPath()
      ctx.moveTo(x, GRID_TOP)
      ctx.lineTo(x, GRID_TOP + GRID_ROWS * GRID_ROW_HEIGHT)
      ctx.stroke()
    }

    // Top labels
    const topLabelY = GRID_TOP - 10
    ctx.fillStyle = '#444'
    ctx.textAlign = 'center'
    if (h === 0) {
      ctx.font = 'bold 10px Inter, sans-serif'
      ctx.fillText('Mid', x, topLabelY)
    } else if (h === 12) {
      ctx.font = 'bold 10px Inter, sans-serif'
      ctx.fillText('Noon', x, topLabelY)
    } else if (h % 2 === 0) {
      ctx.font = '10px Inter, sans-serif'
      ctx.fillText(h.toString(), x, topLabelY)
    }
  }

  // Half-hour ticks inside rows
  ctx.strokeStyle = '#ddd'
  ctx.lineWidth = 0.3
  for (let h = 0; h < 24; h++) {
    const x = hourToX(h + 0.5)
    ctx.beginPath()
    ctx.moveTo(x, GRID_TOP)
    ctx.lineTo(x, GRID_TOP + GRID_ROWS * GRID_ROW_HEIGHT)
    ctx.stroke()
  }

  // Totals area (right side)
  ctx.fillStyle = '#f0f0f0'
  ctx.fillRect(W - GRID_MARGIN_RIGHT, GRID_TOP, GRID_MARGIN_RIGHT, GRID_ROWS * GRID_ROW_HEIGHT)
  // Keep side column clean; totals values are rendered per-row below.

  // Remarks area
  const remarksY = GRID_TOP + GRID_ROWS * GRID_ROW_HEIGHT + GRID_BOTTOM_LABEL
  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 0.5
  ctx.strokeRect(GRID_MARGIN_LEFT, remarksY, W - GRID_MARGIN_LEFT - GRID_MARGIN_RIGHT, REMARKS_HEIGHT)
  ctx.fillStyle = '#888'
  ctx.font = 'bold 10px Inter, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('REMARKS:', GRID_MARGIN_LEFT - 145, remarksY + 18)

  // Bottom time axis (mirror of top)
  for (let h = 0; h <= 24; h += 6) {
    const x = hourToX(h)
    ctx.fillStyle = '#888'
    ctx.font = '10px Inter, sans-serif'
    ctx.textAlign = 'center'
    const label = h === 0 ? 'Mid' : h === 12 ? 'Noon' : h.toString()
    ctx.fillText(label, x, GRID_TOP + GRID_ROWS * GRID_ROW_HEIGHT + 24)
  }
}

function drawSegments(ctx, segments, progress) {
  if (!segments) return
  const renderedHour = 24 * Math.max(0, Math.min(1, progress))
  let previous = null

  for (const seg of segments) {
    const row = STATUS_ROW[seg.status]
    if (row === undefined) continue
    if (seg.start_hour >= renderedHour) break

    const drawEnd = Math.min(seg.end_hour, renderedHour)
    const x1 = hourToX(seg.start_hour)
    const x2 = hourToX(drawEnd)
    const y = rowToY(row)

    if (previous && previous.status !== seg.status && seg.start_hour <= renderedHour) {
      ctx.strokeStyle = '#444'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(hourToX(seg.start_hour), rowToY(STATUS_ROW[previous.status]))
      ctx.lineTo(hourToX(seg.start_hour), y)
      ctx.stroke()
    }

    if (x2 > x1) {
      ctx.strokeStyle = STATUS_COLORS[seg.status] || '#888'
      ctx.lineWidth = 4
      ctx.lineCap = 'butt'
      ctx.beginPath()
      ctx.moveTo(x1, y)
      ctx.lineTo(x2, y)
      ctx.stroke()
    }
    previous = seg
  }
}

function drawTotals(ctx, totals) {
  const W = CANVAS_WIDTH
  const labels = ['off_duty', 'sleeper_berth', 'driving', 'on_duty_not_driving']
  labels.forEach((key, r) => {
    const val = totals[key] || 0
    const y = GRID_TOP + r * GRID_ROW_HEIGHT + GRID_ROW_HEIGHT / 2 + 5
    ctx.fillStyle = STATUS_COLORS[key] || '#333'
    ctx.font = 'bold 15px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(val.toFixed(2), W - GRID_MARGIN_RIGHT / 2, y)
  })

  // Total row
  const total = Object.values(totals).reduce((a, b) => a + b, 0)
  // Show final computed total in top metadata row.
  drawInlineField(ctx, 'Total Hours', total.toFixed(2), W - GRID_MARGIN_RIGHT + 8, 77, GRID_MARGIN_RIGHT - 14)
  ctx.fillStyle = '#333'
  ctx.font = 'bold 14px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`= ${total.toFixed(2)}`, W - GRID_MARGIN_RIGHT / 2, GRID_TOP + GRID_ROWS * GRID_ROW_HEIGHT + 28)
}

function drawRemarks(ctx, remarks) {
  const remarksY = GRID_TOP + GRID_ROWS * GRID_ROW_HEIGHT + GRID_BOTTOM_LABEL
  ctx.fillStyle = '#444'
  ctx.font = '11px Inter, sans-serif'
  ctx.textAlign = 'left'
  const maxWidth = CANVAS_WIDTH - GRID_MARGIN_LEFT - GRID_MARGIN_RIGHT - 10

  remarks.slice(0, 6).forEach((remark, i) => {
    ctx.fillText(`• ${remark}`, GRID_MARGIN_LEFT + 8, remarksY + 20 + i * 16, maxWidth)
  })
}

export default function ELDLogCanvas({ log, driverInfo, animated = true, canvasRef: externalRef }) {
  const internalRef = useRef(null)
  const canvasRef = externalRef || internalRef
  const animRef = useRef(null)
  const [progress, setProgress] = useState(animated ? 0 : 1)
  const [done, setDone] = useState(!animated)

  useEffect(() => {
    if (!animated) {
      setProgress(1)
      setDone(true)
      return
    }
    setProgress(0)
    setDone(false)

    let start = null
    const duration = 2200 // ms for full animation

    const animate = (timestamp) => {
      if (!start) start = timestamp
      const elapsed = timestamp - start
      const p = Math.min(elapsed / duration, 1)
      setProgress(p)
      if (p < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        setDone(true)
      }
    }

    animRef.current = requestAnimationFrame(animate)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [log, animated])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !log) return
    const ctx = canvas.getContext('2d')
    const prepared = prepareLogForRender(log)

    drawBlankGrid(ctx, driverInfo, log)
    drawSegments(ctx, prepared.segments, progress)
    if (progress >= 1) {
      drawTotals(ctx, prepared.totals)
      drawRemarks(ctx, log.remarks || [])
    }
  }, [log, driverInfo, progress])

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          width: '100%',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'white',
          display: 'block',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}
      />
      {!done && (
        <div style={{
          position: 'absolute', bottom: 12, right: 16,
          background: 'rgba(0,0,0,0.7)', borderRadius: 20,
          padding: '4px 14px', fontSize: 12, color: '#FFB347', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', background: '#FF6B35',
            display: 'inline-block',
            animation: 'pulse-glow 1s infinite',
          }} />
          Drawing log...
        </div>
      )}
    </div>
  )
}

// Export function for PDF generation
export function canvasToDataURL(canvasRef) {
  if (!canvasRef.current) return null
  return canvasRef.current.toDataURL('image/png')
}

export { CANVAS_WIDTH, CANVAS_HEIGHT }
export { drawBlankGrid, drawSegments, drawTotals, drawRemarks }
