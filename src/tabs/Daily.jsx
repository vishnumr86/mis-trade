import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS, GRID, Card, Legend, Tip, Empty } from '../components/ui.jsx'
import { fmtDate, monthLong, nf } from '../lib/format.js'

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const dow = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7

function Heat({ days }) {
  const [hov, setHov] = useState(null)
  const max = Math.max(...days.map((d) => d.clearedMW || 0), 1)
  const cells = [...Array(dow(days[0].date)).fill(null), ...days]
  // sequential blue ramp: lightest = near zero, darkest = peak
  const shade = (v) => (v <= 0 ? 'var(--wash)' : `color-mix(in srgb, var(--s1) ${15 + (v / max) * 85}%, var(--surface))`)
  return (
    <div className="heat">
      <div className="heat-grid">
        {WD.map((w) => <span key={w} className="heat-wd">{w}</span>)}
        {cells.map((d, i) => d ? (
          <div key={d.date} className="heat-c" style={{ background: shade(d.clearedMW) }} onMouseEnter={() => setHov(d)} onMouseLeave={() => setHov(null)} tabIndex={0} onFocus={() => setHov(d)} onBlur={() => setHov(null)}>
            <span style={{ color: (d.clearedMW || 0) / max > 0.55 ? '#fff' : 'var(--ink2)' }}>{Number(d.date.slice(8))}</span>
          </div>
        ) : <div key={`e${i}`} />)}
      </div>
      <div className="heat-info">
        {hov ? <><b>{fmtDate(hov.date)}</b> · {nf(hov.clearedMW, 1)} MW cleared · MCP ₹{nf(hov.mcp, 2)} · saved ₹{nf(hov.savingRs, 0)}</> : 'Hover a day for details. Darker means more power cleared.'}
      </div>
      <div className="heat-scale"><span>0</span><i /><span>{nf(max, 0)} MW</span></div>
    </div>
  )
}

export default function Daily({ data, month, monthsInFy }) {
  const [pick, setPick] = useState(null)
  const sel = month !== 'all' ? month : monthsInFy.some((m) => m.month === pick) ? pick : monthsInFy.at(-1)?.month

  const days = useMemo(() => data.daily.filter((d) => d.month === sel), [data, sel])
  const traded = days.filter((d) => d.traded)
  const rows = useMemo(() => days.map((d) => ({ ...d, name: Number(d.date.slice(8)) })), [days])

  if (!sel || !days.length) return <Empty />

  const peak = traded.reduce((a, d) => (d.clearedMW > (a?.clearedMW ?? -1) ? d : a), null)
  const best = traded.reduce((a, d) => (d.savingRs > (a?.savingRs ?? -1) ? d : a), null)
  const lowMcp = traded.reduce((a, d) => (d.mcp < (a?.mcp ?? Infinity) ? d : a), null)
  const label = (_, p) => fmtDate(p[0].payload.date)

  return (
    <>
      <div className="page-h row">
        <div><h2>Daily analysis: {monthLong(sel)}</h2><p>{traded.length} trading days, {days.length - traded.length} with no clearing. Dates are bidding dates as in the source sheet.</p></div>
        {month === 'all' && (
          <label className="select"><span>Month</span>
            <select value={sel} onChange={(e) => setPick(e.target.value)}>
              {monthsInFy.map((m) => <option key={m.month} value={m.month}>{monthLong(m.month)}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="facts">
        <div><span>Peak day</span><b>{peak ? `${fmtDate(peak.date)}` : 'n/a'}</b><em>{peak ? `${nf(peak.clearedMW, 1)} MW` : ''}</em></div>
        <div><span>Best saving day</span><b>{best ? fmtDate(best.date) : 'n/a'}</b><em>{best ? `₹${nf(best.savingRs / 1e5, 2)} Lacs` : ''}</em></div>
        <div><span>Lowest MCP</span><b>{lowMcp ? fmtDate(lowMcp.date) : 'n/a'}</b><em>{lowMcp ? `₹${nf(lowMcp.mcp, 2)}/kWh` : ''}</em></div>
        <div><span>Avg cleared / trading day</span><b>{nf(traded.reduce((s, d) => s + d.clearedMW, 0) / (traded.length || 1), 1)} MW</b><em>{nf(traded.reduce((s, d) => s + d.savingRs, 0) / 1e5, 1)} Lacs saved</em></div>
      </div>

      <div className="grid2">
        <Card title="Power cleared per day" sub="MW cleared on IEX (24 hours)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} interval={1} />
              <YAxis {...AXIS} axisLine={false} />
              <Tooltip cursor={{ fill: 'var(--wash)' }} content={<Tip labelFmt={label} fmt={(p) => `${nf(p.value, 1)} MW`} />} />
              <Bar dataKey="clearedMW" name="Cleared" fill="var(--s1)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Bid price vs market price" sub="₹/kWh" right={<Legend items={[{ label: 'Bid price', color: 'var(--s2)' }, { label: 'IEX MCP', color: 'var(--s1)' }]} />}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} interval={1} />
              <YAxis {...AXIS} axisLine={false} domain={[0, 'auto']} />
              <Tooltip content={<Tip labelFmt={label} fmt={(p) => `₹${nf(p.value, 2)}`} />} />
              <Line dataKey="bidPrice" name="Bid price" stroke="var(--s2)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              <Line dataKey="mcp" name="IEX MCP" stroke="var(--s1)" strokeWidth={2} dot={{ r: 3, stroke: 'var(--surface)', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid2">
        <Card title="Estimated saving per day" sub="₹ Lacs">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={rows.map((r) => ({ ...r, lacs: (r.savingRs || 0) / 1e5 }))} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <defs><linearGradient id="sv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--s3)" stopOpacity=".4" /><stop offset="100%" stopColor="var(--s3)" stopOpacity="0" /></linearGradient></defs>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} interval={1} />
              <YAxis {...AXIS} axisLine={false} />
              <Tooltip content={<Tip labelFmt={label} fmt={(p) => `₹${nf(p.value, 2)} L`} />} />
              <Area dataKey="lacs" name="Saving" stroke="var(--s3)" strokeWidth={2} fill="url(#sv)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Calendar view" sub="Daily clearing intensity"><Heat days={days} /></Card>
      </div>
    </>
  )
}
