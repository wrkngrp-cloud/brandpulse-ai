import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

const PUBLICATIONS = [
  'The Punch', 'Vanguard', 'The Guardian', 'This Day', 'Daily Trust',
  'Tribune', 'The Nation', 'BusinessDay', 'New Telegraph', 'Daily Sun',
  'Premium Times', 'Sahara Reporters', 'Channels TV Online', 'Leadership',
  'Daily Independent',
  'Genevieve', 'TheNEWS', 'TW Magazine', 'Encomium', 'City People',
  'TechCabal', 'Nairametrics', 'Techpoint.africa', 'Stears Business',
  'Business Insider Africa', 'Zikoko', 'Pulse Nigeria',
]

const POSITIONS = [
  'Front Page', 'Back Page', 'Page 3', 'ROP Interior', 'Centrespread',
]

const SIZES = [
  'Full Page', 'Half Page', 'Quarter Page', 'Strip', 'Jacket',
]

const COLOURS = ['Full Colour', 'Black & White']
const STATUSES = ['Scheduled', 'Published', 'Cancelled']

export async function GET() {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'BrandGauge'
  wb.created = new Date()

  // ── Hidden lists sheet ──────────────────────────────────────────────────
  const lists = wb.addWorksheet('Lists')
  lists.state = 'veryHidden'
  PUBLICATIONS.forEach((p, i) => {
    lists.getCell(i + 1, 1).value = p
  })

  // ── Print Placement Plan sheet ──────────────────────────────────────────
  const ws = wb.addWorksheet('Print Placement Plan')

  // Title row
  ws.mergeCells('A1:L1')
  const titleCell = ws.getCell('A1')
  titleCell.value = 'BrandGauge Print Placement Template'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF3FF' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  // Header row
  const headers = [
    'Publication', 'Edition Date', 'Position', 'Size', 'Colour',
    'Insertions', 'Rate Card (₦)', 'Discount %', 'Net Cost (₦)',
    'Attribution URL', 'Status', 'Notes',
  ]
  const headerRow = ws.getRow(2)
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  headerRow.height = 22

  // Column widths
  ws.columns = [
    { width: 26 }, // Publication
    { width: 15 }, // Edition Date
    { width: 16 }, // Position
    { width: 14 }, // Size
    { width: 14 }, // Colour
    { width: 12 }, // Insertions
    { width: 16 }, // Rate Card
    { width: 12 }, // Discount %
    { width: 16 }, // Net Cost
    { width: 36 }, // Attribution URL
    { width: 12 }, // Status
    { width: 30 }, // Notes
  ]

  // Data rows (3-102)
  for (let row = 3; row <= 102; row++) {
    ws.getCell(row, 2).numFmt = 'DD-MMM-YYYY'
    // Net Cost: Rate Card * (1 - Discount%/100) * Insertions
    ws.getCell(row, 9).value = { formula: `=IF(G${row}="","",G${row}*(1-H${row}/100)*F${row})` }
    ws.getCell(row, 9).numFmt = '#,##0.00'
    ws.getCell(row, 7).numFmt = '#,##0.00'
  }

  // Data validations — dataValidations exists at runtime but is missing from ExcelJS TS types
  type WsWithValidations = typeof ws & { dataValidations: { add(ref: string, rule: object): void } }
  const wsv = ws as WsWithValidations

  wsv.dataValidations.add(`A3:A102`, {
    type: 'list',
    allowBlank: true,
    formulae: [`Lists!$A$1:$A$${PUBLICATIONS.length}`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Unknown publication',
    error: 'Select from the list or type the exact publication name.',
  })

  wsv.dataValidations.add('C3:C102', {
    type: 'list',
    allowBlank: true,
    formulae: [`"${POSITIONS.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Invalid position',
    error: 'Please select a valid ad position.',
  })

  wsv.dataValidations.add('D3:D102', {
    type: 'list',
    allowBlank: true,
    formulae: [`"${SIZES.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Invalid size',
    error: 'Please select a valid ad size.',
  })

  wsv.dataValidations.add('E3:E102', {
    type: 'list',
    allowBlank: true,
    formulae: [`"${COLOURS.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Invalid colour',
    error: 'Please select Full Colour or Black & White.',
  })

  wsv.dataValidations.add('K3:K102', {
    type: 'list',
    allowBlank: true,
    formulae: [`"${STATUSES.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Invalid status',
    error: 'Please select a valid status.',
  })

  // Freeze top 2 rows
  ws.views = [{ state: 'frozen', ySplit: 2, xSplit: 0, topLeftCell: 'A3', activeCell: 'A3' }]

  // ── Instructions sheet ──────────────────────────────────────────────────
  const inst = wb.addWorksheet('Instructions')

  const instData = [
    ['BrandGauge Print Placement Template — Instructions', ''],
    ['', ''],
    ['HOW TO USE THIS TEMPLATE', ''],
    ['', ''],
    ['1.', 'Fill in one row per print ad placement. Each row represents one edition of one publication.'],
    ['2.', 'Use dropdowns in columns A (Publication), C (Position), D (Size), E (Colour), and K (Status).'],
    ['3.', 'Net Cost (column I) auto-calculates: Rate Card × (1 - Discount%) × Insertions.'],
    ['4.', 'If you have a landing page URL for QR attribution, enter it in the Attribution URL column. BrandGauge will generate a vanity link automatically.'],
    ['5.', 'Upload to BrandGauge via the Print Intelligence page → Upload Media Plan.'],
    ['', ''],
    ['COLUMN GUIDE', ''],
    ['', ''],
    ['Publication',      'Select the newspaper, magazine, or online publication.'],
    ['Edition Date',     'The cover date / publication date in DD-MMM-YYYY format.'],
    ['Position',         'Where in the publication the ad appears.'],
    ['Size',             'The physical size of the advertisement.'],
    ['Colour',           'Full Colour or Black & White.'],
    ['Insertions',       'Number of times this ad runs in this edition (usually 1).'],
    ['Rate Card (₦)',    'Published rate card cost per insertion in Naira.'],
    ['Discount %',       'Agency or direct advertiser discount percentage.'],
    ['Net Cost (₦)',     'Auto-calculated total net cost across all insertions.'],
    ['Attribution URL',  'The landing page you want QR code readers to reach. BrandGauge generates a trackable vanity URL automatically.'],
    ['Status',           'Scheduled = booked; Published = confirmed on paper; Cancelled = dropped.'],
    ['Notes',            'Any additional notes (e.g. special instructions, creative reference).'],
    ['', ''],
    ['QR ATTRIBUTION', ''],
    ['', ''],
    ['•', 'When you provide an Attribution URL, BrandGauge creates a short QR-friendly link (e.g. brandgauge.app/go/punch-20260615).'],
    ['•', 'Every QR scan is logged and counted in the Print Intelligence dashboard.'],
    ['•', 'This lets you measure real-world engagement from print placements.'],
  ]

  instData.forEach((row, idx) => {
    const r = inst.getRow(idx + 1)
    r.getCell(1).value = row[0]
    r.getCell(2).value = row[1]
    if (idx === 0) {
      r.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } }
    } else if (row[1] === '' && row[0] !== '' && !row[0].startsWith('•') && !row[0].match(/^\d\./)) {
      r.getCell(1).font = { bold: true, color: { argb: 'FF1E3A5F' } }
    }
  })

  inst.columns = [{ width: 20 }, { width: 80 }]

  // ── Serialize ────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="brandgauge-print-placement-template.xlsx"',
    },
  })
}
