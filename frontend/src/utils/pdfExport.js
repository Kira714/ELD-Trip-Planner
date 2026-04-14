import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  drawBlankGrid, drawSegments, drawTotals, drawRemarks, prepareLogForRender
} from '../components/ELDLogCanvas'

/**
 * Exports all ELD daily logs to a single PDF file.
 * Draws each day's log on an offscreen canvas then adds to PDF.
 */
export async function exportLogsToPDF(canvasRefs, dailyLogs, driverInfo) {
  const { jsPDF } = await import('jspdf')

  // A3 landscape gives more room and avoids text collisions.
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
  })

  const pageW = 420
  const pageH = 297
  const margin = 10

  const logsToExport = dailyLogs.filter(l => l.totals.driving > 0 || l.totals.on_duty_not_driving > 0)

  for (let i = 0; i < logsToExport.length; i++) {
    const log = logsToExport[i]
    if (i > 0) pdf.addPage()

    // Draw on an offscreen canvas
    const offscreen = document.createElement('canvas')
    // Draw at 2x resolution for sharper PDF text/lines.
    offscreen.width = CANVAS_WIDTH * 2
    offscreen.height = CANVAS_HEIGHT * 2
    const ctx = offscreen.getContext('2d')
    ctx.scale(2, 2)
    const prepared = prepareLogForRender(log)

    drawBlankGrid(ctx, driverInfo, log)
    drawSegments(ctx, prepared.segments, 1)
    drawTotals(ctx, prepared.totals)
    drawRemarks(ctx, log.remarks || [])

    const imgData = offscreen.toDataURL('image/png', 1.0)

    const canvasAR = CANVAS_WIDTH / CANVAS_HEIGHT
    const maxW = pageW - margin * 2
    const maxH = pageH - margin * 2 - 8
    let drawW = maxW
    let drawH = drawW / canvasAR
    if (drawH > maxH) {
      drawH = maxH
      drawW = drawH * canvasAR
    }

    const x = (pageW - drawW) / 2
    const y = margin

    pdf.addImage(imgData, 'PNG', x, y, drawW, drawH)

    pdf.setFontSize(9)
    pdf.setTextColor(150)
    pdf.text(
      `Driver: ${driverInfo.name} | Carrier: ${driverInfo.carrier} | Truck: ${driverInfo.truck_number} | Day ${i + 1} of ${logsToExport.length} | ${log.date || ''}`,
      pageW / 2,
      pageH - 4,
      { align: 'center' }
    )
    pdf.text(
      'ORIGINAL — Submit to carrier within 13 days | DUPLICATE — Driver retains for 8 days',
      pageW / 2,
      pageH - 1,
      { align: 'center' }
    )
  }

  const fileName = `ELD-Log-${driverInfo.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
  pdf.save(fileName)
  return fileName
}
