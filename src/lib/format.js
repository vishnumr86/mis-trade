const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const monthShort = (m) => `${MON[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`
export const monthLong = (m) => `${MON[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
export const monthName = (m) => MON[Number(m.slice(5, 7)) - 1]
export const fyShort = (fy) => `FY ${fy.slice(2, 4)}-${fy.slice(7)}`

export const nf = (v, d = 0) =>
  v == null || Number.isNaN(v) ? 'n/a' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })

export const fmtMwh = (v) => (v == null ? 'n/a' : `${nf(v, v >= 1000 ? 0 : 1)} MWh`)
export const fmtLacs = (v) => (v == null ? 'n/a' : `₹${nf(v, 1)} L`)
export const fmtRate = (v) => (v == null ? 'n/a' : `₹${nf(v, 2)}`)
export const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MON[m - 1]} ${y}`
}

export function pctDelta(cur, prev) {
  if (cur == null || prev == null || prev === 0) return null
  return ((cur - prev) / Math.abs(prev)) * 100
}

export function downloadFile(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const toCSV = (rows, cols) =>
  [cols.map((c) => c.label).join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c.key] ?? '')).join(','))].join('\n')
