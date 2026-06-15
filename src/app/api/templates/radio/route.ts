import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

const RADIO_STATIONS = [
  'Cool FM Lagos', 'Beat FM Lagos', 'Rhythm FM Lagos', 'Smooth FM Lagos',
  'Classic FM Lagos', 'Traffic Radio Lagos', 'Radio Continental Lagos',
  'Nigeria Info Lagos', 'Wazobia FM Lagos', 'Lagos Talks',
  'Cool FM Abuja', 'Wazobia FM Abuja', 'Nigeria Info Abuja',
  'Radio Nigeria 1 Abuja', 'Naija FM Abuja',
  'Cool FM Port Harcourt', 'Wazobia FM Port Harcourt', 'Rhythm FM Port Harcourt',
  'Nigeria Info PH',
  'Fresh FM Ibadan', 'Diamond FM Ibadan', 'Splash FM Ibadan',
  'Freedom FM Kano', 'Rahama FM Kano', 'Rarara FM Kano',
  'Bond FM Enugu', 'Coal City FM Enugu',
  'Arewa FM Kaduna', 'Invicta FM Kaduna',
  'Brilla FM Benin', 'Nigeria Info Benin',
  'Orange FM Owerri',
  'FRCN Network', 'Voice of Nigeria', 'Radio Nigeria 2',
  'Maximum FM Warri', 'Ogun State Broadcasting',
  'Pebbles FM Jos', 'Calabar FM', 'Flo FM Uyo',
]

const DAYPARTS = [
  'Early Morning (5-7am)',
  'Morning Drive (7-10am)',
  'Daytime (10am-3pm)',
  'Afternoon Drive (3-7pm)',
  'Evening (7-10pm)',
  'Late Night (10pm-5am)',
]

const STATUSES = ['Scheduled', 'Aired', 'Missed', 'Make-good']
const DURATIONS = ['10', '15', '30', '45', '60']

export async function GET() {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'BrandPulse AI'
  wb.created = new Date()

  // ── Hidden lists sheet ──────────────────────────────────────────────────
  const lists = wb.addWorksheet('Lists')
  lists.state = 'veryHidden'
  RADIO_STATIONS.forEach((s, i) => {
    lists.getCell(i + 1, 1).value = s
  })

  // ── Radio Buy Plan sheet ────────────────────────────────────────────────
  const ws = wb.addWorksheet('Radio Buy Plan')

  // Title row
  ws.mergeCells('A1:M1')
  const titleCell = ws.getCell('A1')
  titleCell.value = 'BrandPulse Radio Buy Template'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF3FF' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  // Header row
  const headers = [
    'Station', 'Daypart', 'Spot Date', 'Spot Time', 'Duration (sec)',
    'Spots Planned', 'Spots Aired', 'Material Name', 'Rate Card (₦)',
    'Discount %', 'Net Cost (₦)', 'Status', 'Notes',
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
    { width: 28 }, // Station
    { width: 24 }, // Daypart
    { width: 15 }, // Spot Date
    { width: 12 }, // Spot Time
    { width: 14 }, // Duration
    { width: 14 }, // Spots Planned
    { width: 12 }, // Spots Aired
    { width: 20 }, // Material Name
    { width: 16 }, // Rate Card
    { width: 12 }, // Discount %
    { width: 16 }, // Net Cost
    { width: 12 }, // Status
    { width: 30 }, // Notes
  ]

  // Data rows (3-102)
  for (let row = 3; row <= 102; row++) {
    // Spot Date format
    ws.getCell(row, 3).numFmt = 'DD-MMM-YYYY'
    // Net Cost formula: Rate Card * (1 - Discount%/100) * Spots Planned
    ws.getCell(row, 11).value = { formula: `=IF(I${row}="","",I${row}*(1-J${row}/100)*F${row})` }
    ws.getCell(row, 11).numFmt = '#,##0.00'
    ws.getCell(row, 9).numFmt = '#,##0.00'
  }

  // Data validations — dataValidations exists at runtime but is missing from ExcelJS TS types
  type WsWithValidations = typeof ws & { dataValidations: { add(ref: string, rule: object): void } }
  const wsv = ws as WsWithValidations

  // Station (col A) — reference Lists sheet
  wsv.dataValidations.add(`A3:A102`, {
    type: 'list',
    allowBlank: true,
    formulae: [`Lists!$A$1:$A$${RADIO_STATIONS.length}`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Unknown station',
    error: 'Select from the list or type the exact station name.',
  })

  // Daypart (col B)
  wsv.dataValidations.add('B3:B102', {
    type: 'list',
    allowBlank: true,
    formulae: [`"${DAYPARTS.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Invalid daypart',
    error: 'Please select a valid daypart.',
  })

  // Duration (col E)
  wsv.dataValidations.add('E3:E102', {
    type: 'list',
    allowBlank: true,
    formulae: [`"${DURATIONS.join(',')}"`],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'Invalid duration',
    error: 'Duration must be 10, 15, 30, 45, or 60 seconds.',
  })

  // Status (col L)
  wsv.dataValidations.add('L3:L102', {
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
    ['BrandPulse Radio Buy Template — Instructions', ''],
    ['', ''],
    ['HOW TO USE THIS TEMPLATE', ''],
    ['', ''],
    ['1.', 'Fill in one row per radio spot booking. Each row represents a single spot (or a block of identical spots on the same station/date/time).'],
    ['2.', 'Use the dropdown menus in columns A (Station), B (Daypart), E (Duration), and L (Status) to ensure consistent data.'],
    ['3.', 'The Net Cost (column K) calculates automatically: Rate Card × (1 - Discount%) × Spots Planned.'],
    ['4.', 'Upload this file to BrandPulse via the Radio Intelligence page → Upload Media Plan button.'],
    ['', ''],
    ['COLUMN GUIDE', ''],
    ['', ''],
    ['Station',         'Select the radio station from the dropdown. Type the exact name if your station is not listed.'],
    ['Daypart',         'The broadcast time window. Matches Nigeria media industry standard dayparts.'],
    ['Spot Date',       'The broadcast date in DD-MMM-YYYY format (e.g. 15-Jun-2026).'],
    ['Spot Time',       'Approximate broadcast time in HH:MM 24-hour format (e.g. 08:30).'],
    ['Duration (sec)',  'Spot length: 10, 15, 30, 45, or 60 seconds.'],
    ['Spots Planned',   'Number of spots booked on this station/date/daypart combination.'],
    ['Spots Aired',     'Fill in after broadcast confirmation from the station. Leave blank until confirmed.'],
    ['Material Name',   'The name/code of the creative/TVC material being aired.'],
    ['Rate Card (₦)',   'The published rate card cost per spot in Naira.'],
    ['Discount %',      'Any agency or volume discount applied (e.g. enter 15 for 15%). Enter 0 if none.'],
    ['Net Cost (₦)',    'Auto-calculated: Rate Card × (1 - Discount%) × Spots Planned.'],
    ['Status',          'Scheduled = booked but not yet aired; Aired = confirmed on air; Missed = spot did not air; Make-good = replacement spot arranged.'],
    ['Notes',           'Any additional notes (e.g. programme context, special positioning instructions).'],
    ['', ''],
    ['TIPS', ''],
    ['', ''],
    ['•', 'Keep station names consistent — BrandPulse matches them to the reference database for reach estimates.'],
    ['•', 'Upload weekly after confirmation reports arrive from your media buying agency.'],
    ['•', 'The system will auto-match your stations to reach data and compute estimated CPT.'],
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
      'Content-Disposition': 'attachment; filename="brandpulse-radio-buy-template.xlsx"',
    },
  })
}
