import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS, GRID, Card, Kpi, Legend, Tip, Empty } from '../components/ui.jsx'
import { aggregate } from '../lib/agg.js'
import { fmtLacs, fyShort, monthLong, monthShort, nf, pctDelta } from '../lib/format.js'

export default function Overview({ data, fy, month, monthsInFy, setMonth }) {
  const { cur, prev, cmpLabel } = useMemo(() => {
    const all = data.monthly
    if (month !== 'all') {
      const i = all.findIndex((m) => m.month === month)
      return { cur: aggregate([all[i]]), prev: i > 0 ? aggregate([all[i - 1]]) : null, cmpLabel: i > 0 ? `vs ${monthShort(all[i - 1].month)}` : '' }
    }
    const cur = aggregate(monthsInFy)
    if (fy === 'all') return { cur, prev: null, cmpLabel: '' }
    const fys = data.meta.fiscalYears
    const pf = fys[fys.indexOf(fy) - 1]
    const pm = pf ? data.monthly.filter((m) => m.fy === pf) : []
    // like-for-like: monthly averages, because FYs can cover different numbers of months
    const norm = (a) => a && { ...a, mwh: a.mwh / a.n, mwhNet: a.mwhNet / a.n, savingLacs: a.savingLacs / a.n }
    return { cur: norm(cur), prev: norm(aggregate(pm)), cmpLabel: pf ? `avg/mo vs ${fyShort(pf)}` : '', rawCur: cur }
  }, [data, fy, month, monthsInFy])

  const totals = useMemo(() => (month !== 'all' ? aggregate(data.monthly.filter((m) => m.month === month)) : aggregate(monthsInFy)), [data, month, monthsInFy])

  if (!totals) return <Empty />

  const d = (k) => pctDelta(cur?.[k], prev?.[k])
  const series = monthsInFy.map((m) => ({ ...m, name: monthShort(m.month), sel: month === 'all' || month === m.month }))
  const scopeLabel = month !== 'all' ? monthLong(month) : fy === 'all' ? 'All years' : fyShort(fy)
  const click = (e) => e?.activePayload?.[0] && setMonth((s) => (s === e.activePayload[0].payload.month ? 'all' : e.activePayload[0].payload.month))

  return (
    <>
      <div className="page-h">
        <h2>{scopeLabel}</h2>
        <p>{month !== 'all' ? 'Single month view. Click the highlighted bar again to return to the full period.' : 'Click any bar to drill into a month.'}</p>
      </div>

      <div className="kpis">
        <Kpi series={1} icon="⚡" label="Energy cleared" value={nf(totals.mwh, 0)} unit=" MWh" pct={d('mwh')} cmpLabel={cmpLabel} goodWhenUp />
        <Kpi series={3} icon="⇣" label="After loss adjustment" value={nf(totals.mwhNet, 0)} unit=" MWh" pct={d('mwhNet')} cmpLabel={cmpLabel} goodWhenUp />
        <Kpi series={6} icon="₹" label="Realised savings" value={nf(totals.savingLacs, 1)} unit=" Lacs" pct={d('savingLacs')} cmpLabel={cmpLabel} goodWhenUp />
        <Kpi series={2} icon="◔" label="Avg IEX MCP" value={`₹${nf(totals.avgMcp, 2)}`} unit="/kWh" pct={d('avgMcp')} cmpLabel={cmpLabel} goodWhenUp={false} />
        <Kpi series={4} icon="⌂" label="Avg landed cost" value={`₹${nf(totals.landedCost, 2)}`} unit="/kWh" pct={d('landedCost')} cmpLabel={cmpLabel} goodWhenUp={false} />
        <Kpi series={6} icon="✓" label="Saving per unit" value={`₹${nf(totals.savingPerUnit, 2)}`} unit="/kWh" pct={d('savingPerUnit')} cmpLabel={cmpLabel} goodWhenUp />
      </div>

      <div className="grid2">
        <Card title="Energy cleared on IEX" sub="MWh per month, 24 hour clearing">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={series} onClick={click} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} />
              <YAxis {...AXIS} axisLine={false} tickFormatter={(v) => nf(v / 1000, 0) + 'k'} />
              <Tooltip cursor={{ fill: 'var(--wash)' }} content={<Tip fmt={(p) => `${nf(p.value, 1)} MWh`} />} />
              <Bar dataKey="mwh" name="Cleared" radius={[4, 4, 0, 0]} cursor="pointer">
                {series.map((s) => <Cell key={s.month} fill="var(--s1)" fillOpacity={s.sel ? 1 : 0.28} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Realised savings" sub="₹ Lacs per month versus discom variable cost">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={series} onClick={click} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} />
              <YAxis {...AXIS} axisLine={false} />
              <Tooltip cursor={{ fill: 'var(--wash)' }} content={<Tip fmt={(p) => fmtLacs(p.value)} />} />
              <Bar dataKey="savingLacs" name="Savings" radius={[4, 4, 0, 0]} cursor="pointer">
                {series.map((s) => <Cell key={s.month} fill="var(--s3)" fillOpacity={s.sel ? 1 : 0.28} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid2">
        <Card title="Per unit economics" sub="₹/kWh: the gap between the lines is the saving" right={<Legend items={[{ label: 'Discom variable cost', color: 'var(--s2)' }, { label: 'Landed cost via open access', color: 'var(--s1)' }, { label: 'IEX MCP', color: 'var(--s3)' }]} />}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={series} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} />
              <YAxis {...AXIS} axisLine={false} domain={[0, 'auto']} tickFormatter={(v) => nf(v, 0)} />
              <Tooltip content={<Tip fmt={(p) => `₹${nf(p.value, 2)}/kWh`} />} />
              <Line dataKey="discomCost" name="Discom variable cost" stroke="var(--s2)" strokeWidth={2} dot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} />
              <Line dataKey="landedCost" name="Landed cost" stroke="var(--s1)" strokeWidth={2} dot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} />
              <Line dataKey="avgMcp" name="IEX MCP" stroke="var(--s3)" strokeWidth={2} dot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Financial year summary" sub="Select a year in the filter to switch the dashboard">
          <table className="tbl compact">
            <thead><tr><th>Year</th><th className="r">MWh</th><th className="r">Savings (L)</th><th className="r">₹/kWh saved</th></tr></thead>
            <tbody>
              {data.yearly.map((y) => (
                <tr key={y.fy} className={y.fy === fy ? 'sel' : ''}>
                  <td><b>{y.fy}</b><small>{y.remarks}</small></td>
                  <td className="r">{nf(y.mwh, 0)}</td>
                  <td className="r">{nf(y.savingsLacs, 1)}</td>
                  <td className="r">{nf(y.savingPerUnit, 2)}</td>
                </tr>
              ))}
              <tr className="total"><td>Total</td><td className="r">{nf(data.yearly.reduce((s, y) => s + (y.mwh || 0), 0), 0)}</td><td className="r">{nf(data.yearly.reduce((s, y) => s + (y.savingsLacs || 0), 0), 1)}</td><td /></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </>
  )
}
