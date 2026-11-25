import * as XLSX from 'xlsx'

/**
 * Converts the MIS workbook into a dashboard-friendly JSON document.
 *
 * Output shape:
 * {
 *   meta:    { sourceFile, generatedAt, version, fiscalYears[], sheets{} },
 *   yearly:  [{ fy, mwh, mwhNet, savingsLacs, remarks }],
 *   monthly: [{ fy, month:'2026-04', label, period, mwh, mwhNet, avgMcp, ... savingLacs }],
 *   daily:   [{ date:'2026-11-01', month, fy, traded, bidQty, ... savingRs }]
 * }
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const r = (v, d = 4) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)

export const fyOf = (year, monthIdx) => {
  const start = monthIdx >= 3 ? year : year - 1
  return `${start}-${start + 1}`
}

// Excel serial date -> 'YYYY-MM-DD' (UTC, no timezone drift)
const serialToISO = (n) => new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10)

// "Apr'26" | "June'26" | "July'26" -> { month:'2026-04', monthIdx:3, year:2026 }
function parseMonthLabel(label) {
  const m = String(label || '').trim().match(/^([A-Za-z]+)\s*'?\s*(\d{2})$/)
  if (!m) return null
  const idx = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase())
  if (idx < 0) return null
  const year = 2000 + Number(m[2])
  return { month: `${year}-${String(idx + 1).padStart(2, '0')}`, monthIdx: idx, year }
}

const rows = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

// Monthly summary columns (same order on every "OA summary" sheet)
const MONTHLY_COLS = [
  'mwh', 'mwhNet', 'avgMcp', 'energyCharge', 'corridorCharges', 'exchangeFee', 'netObligation',
  'tradingMargin', 'annualFee', 'finalAmount', 'perUnitNvvn', 'perUnitAfterLoss', 'css',
  'additionalSurcharge', 'wheeling', 'interest', 'landedCost', 'discomCost', 'savingPerUnit', 'savingLacs',
]

// Daily sheet columns (index -> key)
const DAILY_COLS = {
  1: 'bidQty', 2: 'bidPrice', 4: 'clearedMW', 5: 'clearedKWH', 6: 'mwAfterCtu', 7: 'mwAfterStu',
  8: 'kwhNet', 9: 'mcp', 10: 'energyCharge', 11: 'corridorCharges', 12: 'exchangeFee',
  13: 'netObligation', 14: 'tradingMargin', 15: 'annualFee', 16: 'finalAmount', 17: 'perUnitNvvn',
  18: 'perUnitAfterLoss', 19: 'css', 20: 'additionalSurcharge', 21: 'wheeling', 22: 'interest',
  23: 'landedCost', 24: 'discomCost', 25: 'savingPerUnit', 26: 'savingRs',
}

function parseMonthlySheet(name, data, warnings) {
  const fy = name.match(/(\d{4})\s*-\s*(\d{4})/)?.[0].replace(/\s/g, '')
  const out = []
  let total = null
  for (const row of data.slice(2)) {
    const label = row[0]
    if (label == null) continue
    const ml = parseMonthLabel(label)
    if (ml) {
      if (num(row[1]) == null) continue // future month, no data yet
      const rec = { fy: fyOf(ml.year, ml.monthIdx), month: ml.month, label: String(label).trim(), period: row[21] ?? null }
      MONTHLY_COLS.forEach((k, i) => { rec[k] = r(num(row[i + 1])) })
      out.push(rec)
    } else if (String(label).trim() === fy) {
      total = {
        fy, mwh: r(num(row[1])), mwhNet: r(num(row[2])), avgMcp: r(num(row[3])),
        savingPerUnit: r(num(row[19])), savingsLacs: r(num(row[20])),
      }
    }
  }
  if (!out.length) warnings.push(`Sheet "${name}": no monthly rows found`)
  return { fy, months: out, total }
}

function parseDailySheet(name, data, warnings) {
  const header = (data[1] || []).map((h) => String(h || ''))
  const ctu = header[6]?.match(/([\d.]+)\s*%/)?.[1]
  const stu = header[7]?.match(/([\d.]+)\s*%/)?.[1]
  if (!/saving\/day/i.test(header[26] || '') || !/MCP/i.test(header[9] || '')) {
    warnings.push(`Sheet "${name}": column layout differs from expected, values may be misaligned`)
  }
  // Rows belong to the month named on the sheet (e.g. "Nov-26 MIS"): the first row is the
  // previous day's bidding date, so deriving the month from the date would split the sheet.
  const sm = name.match(/^\s*([A-Za-z]+)\s*-\s*(\d{2})/)
  const sheetMonth = sm ? parseMonthLabel(`${sm[1]}'${sm[2]}`) : null
  const out = []
  for (const row of data.slice(2)) {
    if (typeof row[0] !== 'number') {
      if (String(row[0]).trim().toLowerCase() === 'total') break
      continue
    }
    const date = serialToISO(row[0])
    const [y, m] = date.split('-').map(Number)
    const rec = {
      date,
      month: sheetMonth?.month ?? date.slice(0, 7),
      fy: sheetMonth ? fyOf(sheetMonth.year, sheetMonth.monthIdx) : fyOf(y, m - 1),
      segment: row[3] ?? null,
      ctuLossPct: ctu ? Number(ctu) : null, stuLossPct: stu ? Number(stu) : null,
    }
    for (const [i, k] of Object.entries(DAILY_COLS)) rec[k] = r(num(row[i]))
    rec.traded = (rec.clearedKWH || 0) > 0
    out.push(rec)
  }
  if (!out.length) warnings.push(`Sheet "${name}": no daily rows found`)
  return out
}

export function parseWorkbook(wb, sourceFile = 'upload.xlsx') {
  const warnings = []
  const sheets = { monthly: [], daily: [], yearly: null, ignored: [] }
  const monthly = []
  const daily = []
  const totals = {}

  for (const name of wb.SheetNames) {
    const data = rows(wb.Sheets[name])
    if (/^yearly$/i.test(name.trim())) {
      sheets.yearly = name
    } else if (/OA summary/i.test(name)) {
      const res = parseMonthlySheet(name, data, warnings)
      monthly.push(...res.months)
      if (res.total) totals[res.fy] = res.total
      sheets.monthly.push(name)
    } else if (/MIS/i.test(name)) {
      daily.push(...parseDailySheet(name, data, warnings))
      sheets.daily.push(name)
    } else {
      sheets.ignored.push(name)
    }
  }

  // Yearly remarks (if the sheet exists)
  const remarks = {}
  if (sheets.yearly) {
    for (const row of rows(wb.Sheets[sheets.yearly])) {
      if (/^\d{4}-\d{4}$/.test(String(row[0] || '').trim())) remarks[String(row[0]).trim()] = row[4] ?? null
    }
  }

  monthly.sort((a, b) => a.month.localeCompare(b.month))
  daily.sort((a, b) => a.date.localeCompare(b.date))

  const fiscalYears = [...new Set([...monthly.map((m) => m.fy), ...daily.map((d) => d.fy)])].sort()
  const yearly = fiscalYears.map((fy) => {
    const t = totals[fy]
    const ms = monthly.filter((m) => m.fy === fy)
    return {
      fy,
      mwh: t?.mwh ?? r(ms.reduce((s, m) => s + (m.mwh || 0), 0)),
      mwhNet: t?.mwhNet ?? r(ms.reduce((s, m) => s + (m.mwhNet || 0), 0)),
      avgMcp: t?.avgMcp ?? null,
      savingPerUnit: t?.savingPerUnit ?? null,
      savingsLacs: t?.savingsLacs ?? r(ms.reduce((s, m) => s + (m.savingLacs || 0), 0)),
      remarks: remarks[fy] ?? null,
      months: ms.length,
    }
  })

  if (!monthly.length && !daily.length) {
    throw new Error('No MIS data found. Expected sheets like "OA summary 2026-2027" and "Nov-26 MIS".')
  }

  return {
    meta: {
      sourceFile, generatedAt: new Date().toISOString(), version: 1, fiscalYears,
      latestMonth: monthly.at(-1)?.month ?? null,
      counts: { monthly: monthly.length, daily: daily.length },
      sheets, warnings,
    },
    yearly, monthly, daily,
  }
}

export function parseBuffer(buffer, sourceFile) {
  return parseWorkbook(XLSX.read(buffer, { type: 'array' }), sourceFile)
}

/**
 * Splits a parsed workbook into one self-contained JSON document per financial year.
 * Each document: { fy, meta:{sourceFile,generatedAt,version}, summary, monthly[], daily[] }
 */
export function splitByYear(parsed) {
  return parsed.meta.fiscalYears.map((fy) => ({
    fy,
    meta: { sourceFile: parsed.meta.sourceFile, generatedAt: parsed.meta.generatedAt, version: 1 },
    summary: parsed.yearly.find((y) => y.fy === fy) ?? null,
    monthly: parsed.monthly.filter((m) => m.fy === fy),
    daily: parsed.daily.filter((d) => d.fy === fy),
  }))
}

/** Rebuilds the dashboard dataset from yearly documents. Returns null when there are none. */
export function mergeYears(docs) {
  const ds = [...docs].filter(Boolean).sort((a, b) => a.fy.localeCompare(b.fy))
  if (!ds.length) return null
  const monthly = ds.flatMap((d) => d.monthly)
  const daily = ds.flatMap((d) => d.daily)
  const newest = [...ds].sort((a, b) => b.meta.generatedAt.localeCompare(a.meta.generatedAt))[0]
  return {
    meta: {
      sourceFile: newest.meta.sourceFile,
      generatedAt: newest.meta.generatedAt,
      version: 1,
      fiscalYears: ds.map((d) => d.fy),
      latestMonth: monthly.at(-1)?.month ?? null,
      counts: { monthly: monthly.length, daily: daily.length },
      years: ds.map((d) => ({ fy: d.fy, sourceFile: d.meta.sourceFile, generatedAt: d.meta.generatedAt, months: d.monthly.length, days: d.daily.length })),
    },
    yearly: ds.map((d) => ({ ...(d.summary ?? { fy: d.fy }), fy: d.fy })),
    monthly,
    daily,
  }
}
