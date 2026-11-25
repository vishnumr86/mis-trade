const sum = (a, k) => a.reduce((s, x) => s + (x[k] || 0), 0)
const wavg = (a, k, w) => {
  const rows = a.filter((x) => x[k] != null && x[w])
  const tw = sum(rows, w)
  return tw ? rows.reduce((s, x) => s + x[k] * x[w], 0) / tw : null
}

export function aggregate(ms) {
  if (!ms.length) return null
  return {
    n: ms.length,
    mwh: sum(ms, 'mwh'),
    mwhNet: sum(ms, 'mwhNet'),
    savingLacs: sum(ms, 'savingLacs'),
    avgMcp: wavg(ms, 'avgMcp', 'mwh'),
    landedCost: wavg(ms, 'landedCost', 'mwhNet'),
    discomCost: wavg(ms, 'discomCost', 'mwhNet'),
    savingPerUnit: wavg(ms, 'savingPerUnit', 'mwhNet'),
    finalAmount: sum(ms, 'finalAmount'),
  }
}

export const FISCAL_ORDER = ['04', '05', '06', '07', '08', '09', '10', '11', '12', '01', '02', '03']
