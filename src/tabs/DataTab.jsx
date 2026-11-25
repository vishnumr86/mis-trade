import { useMemo, useState } from 'react'
import { Card, Empty } from '../components/ui.jsx'
import { downloadFile, fmtDate, monthShort, nf, toCSV } from '../lib/format.js'

const MONTHLY = [
  { key: 'label', label: 'Month' }, { key: 'fy', label: 'FY' }, { key: 'mwh', label: 'Cleared MWh', d: 1 },
  { key: 'mwhNet', label: 'After loss MWh', d: 1 }, { key: 'avgMcp', label: 'Avg MCP', d: 2 },
  { key: 'energyCharge', label: 'Energy charge', d: 0 }, { key: 'corridorCharges', label: 'Corridor charges', d: 0 },
  { key: 'finalAmount', label: 'Paid to NVVN', d: 0 }, { key: 'landedCost', label: 'Landed cost', d: 2 },
  { key: 'discomCost', label: 'Discom cost', d: 2 }, { key: 'savingPerUnit', label: 'Saving/unit', d: 2 },
  { key: 'savingLacs', label: 'Saving (Lacs)', d: 2 },
]
const DAILY = [
  { key: 'date', label: 'Date' }, { key: 'bidPrice', label: 'Bid price', d: 2 }, { key: 'clearedMW', label: 'Cleared MW', d: 2 },
  { key: 'kwhNet', label: 'kWh after loss', d: 0 }, { key: 'mcp', label: 'MCP', d: 2 }, { key: 'energyCharge', label: 'Energy charge', d: 0 },
  { key: 'corridorCharges', label: 'Corridor charges', d: 0 }, { key: 'finalAmount', label: 'Paid to NVVN', d: 0 },
  { key: 'landedCost', label: 'Landed cost', d: 2 }, { key: 'discomCost', label: 'Discom cost', d: 2 },
  { key: 'savingPerUnit', label: 'Saving/unit', d: 2 }, { key: 'savingRs', label: 'Saving (₹)', d: 0 },
]

export default function DataTab({ data, fy, month, monthsInFy }) {
  const [kind, setKind] = useState('monthly')
  const cols = kind === 'monthly' ? MONTHLY : DAILY

  const rows = useMemo(() => {
    if (kind === 'monthly') return monthsInFy.filter((m) => month === 'all' || m.month === month)
    return data.daily.filter((d) => (fy === 'all' || d.fy === fy) && (month === 'all' || d.month === month))
  }, [kind, data, fy, month, monthsInFy])

  const show = (r, c) => {
    const v = r[c.key]
    if (c.key === 'date') return fmtDate(v)
    return c.d == null ? v : nf(v, c.d)
  }

  return (
    <>
      <div className="page-h row">
        <div><h2>Data explorer</h2><p>{rows.length} {kind} rows for the current filters.</p></div>
        <div className="row-gap">
          <div className="seg">
            <button className={kind === 'monthly' ? 'on' : ''} onClick={() => setKind('monthly')}>Monthly</button>
            <button className={kind === 'daily' ? 'on' : ''} onClick={() => setKind('daily')}>Daily</button>
          </div>
          <button className="ghost" onClick={() => downloadFile(`mis-${kind}.csv`, toCSV(rows, cols), 'text/csv')}>Export CSV</button>
          <button className="ghost" onClick={() => downloadFile('mis.json', JSON.stringify(data, null, 1), 'application/json')}>Download JSON</button>
        </div>
      </div>
      <Card title={kind === 'monthly' ? 'Monthly summary' : 'Daily MIS'} sub="Currency values are in rupees unless stated">
        {rows.length ? (
          <div className="tbl-wrap tall">
            <table className="tbl">
              <thead><tr>{cols.map((c) => <th key={c.key} className={c.d != null ? 'r' : ''}>{c.label}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.date || r.month} className={kind === 'daily' && !r.traded ? 'dim' : ''}>
                    {cols.map((c) => <td key={c.key} className={c.d != null ? 'r' : ''}>{c.key === 'label' ? <b>{monthShort(r.month)}</b> : show(r, c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty />}
      </Card>
    </>
  )
}
