import { useMemo, useState } from 'react'
import { Area, AreaChart, Brush, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS, GRID, Card, Delta, Legend, Tip } from '../components/ui.jsx'
import { FISCAL_ORDER } from '../lib/agg.js'
import { fyShort, monthName, monthShort, nf, pctDelta } from '../lib/format.js'

const METRICS = [
  { k: 'mwh', label: 'Energy cleared (MWh)', d: 0, up: true },
  { k: 'mwhNet', label: 'After loss (MWh)', d: 0, up: true },
  { k: 'savingLacs', label: 'Savings (₹ Lacs)', d: 1, up: true },
  { k: 'savingPerUnit', label: 'Saving per unit (₹/kWh)', d: 2, up: true },
  { k: 'avgMcp', label: 'Avg IEX MCP (₹/kWh)', d: 2, up: false },
  { k: 'landedCost', label: 'Landed cost (₹/kWh)', d: 2, up: false },
  { k: 'discomCost', label: 'Discom variable cost (₹/kWh)', d: 2, up: false },
  { k: 'finalAmount', label: 'Paid to NVVN (₹)', d: 0, up: false },
]

export default function Trends({ data, fys }) {
  const [mk, setMk] = useState('savingLacs')
  const metric = METRICS.find((m) => m.k === mk)

  // year-over-year: one row per fiscal month, one series per FY
  const yoy = useMemo(() => FISCAL_ORDER.map((mm) => {
    const row = { name: monthName(`2000-${mm}`) }
    for (const f of fys) row[f] = data.monthly.find((m) => m.fy === f && m.month.slice(5) === mm)?.[mk] ?? null
    return row
  }), [data, fys, mk])

  const line = useMemo(() => data.monthly.map((m) => ({ ...m, name: monthShort(m.month) })), [data])
  const colors = fys.map((_, i) => `var(--s${(i % 3) + 1})`)

  return (
    <>
      <div className="page-h row">
        <div><h2>History &amp; trends</h2><p>Compare any metric across financial years and months.</p></div>
        <label className="select"><span>Metric</span>
          <select value={mk} onChange={(e) => setMk(e.target.value)}>
            {METRICS.map((m) => <option key={m.k} value={m.k}>{m.label}</option>)}
          </select>
        </label>
      </div>

      <div className="grid2">
        <Card title="Year over year" sub="Same fiscal month across years (April to March)" right={<Legend items={fys.map((f, i) => ({ label: fyShort(f), color: colors[i] }))} />}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={yoy} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} />
              <YAxis {...AXIS} axisLine={false} tickFormatter={(v) => nf(v, metric.d > 1 ? 1 : 0)} />
              <Tooltip content={<Tip fmt={(p) => nf(p.value, metric.d)} />} />
              {fys.map((f, i) => (
                <Line key={f} dataKey={f} name={fyShort(f)} stroke={colors[i]} strokeWidth={2} connectNulls dot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Full timeline" sub="Drag the handles to zoom into any range of months">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={line} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
              <defs>
                <linearGradient id="tl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--s1)" stopOpacity=".35" /><stop offset="100%" stopColor="var(--s1)" stopOpacity="0" /></linearGradient>
              </defs>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} />
              <YAxis {...AXIS} axisLine={false} tickFormatter={(v) => nf(v, metric.d > 1 ? 1 : 0)} />
              <Tooltip content={<Tip fmt={(p) => nf(p.value, metric.d)} />} />
              <Area dataKey={mk} name={metric.label} stroke="var(--s1)" strokeWidth={2} fill="url(#tl)" dot={{ r: 3, stroke: 'var(--surface)', strokeWidth: 2 }} />
              <Brush dataKey="name" height={22} stroke="var(--axis)" fill="var(--surface)" travellerWidth={8} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Month by month" sub={metric.label}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Month</th><th>Financial year</th><th className="r">Value</th><th className="r">Change vs previous month</th><th className="r">Change vs same month last year</th></tr></thead>
            <tbody>
              {[...data.monthly].reverse().map((m) => {
                const i = data.monthly.findIndex((x) => x.month === m.month)
                const prev = data.monthly[i - 1]
                const ly = data.monthly.find((x) => x.month === `${Number(m.month.slice(0, 4)) - 1}${m.month.slice(4)}`)
                return (
                  <tr key={m.month}>
                    <td><b>{monthShort(m.month)}</b></td><td>{m.fy}</td>
                    <td className="r">{nf(m[mk], metric.d)}</td>
                    <td className="r"><Delta pct={pctDelta(m[mk], prev?.[mk])} goodWhenUp={metric.up} /></td>
                    <td className="r"><Delta pct={pctDelta(m[mk], ly?.[mk])} goodWhenUp={metric.up} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
