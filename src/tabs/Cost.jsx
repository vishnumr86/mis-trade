import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS, GRID, Card, Legend, Tip, Empty } from '../components/ui.jsx'
import { monthShort, nf } from '../lib/format.js'

const L = 1e5
const gap = { stroke: 'var(--surface)', strokeWidth: 2 }

export default function Cost({ monthsInFy, month }) {
  const rows = useMemo(() => monthsInFy.map((m) => ({
    name: monthShort(m.month), month: m.month,
    energy: (m.energyCharge || 0) / L,
    corridor: (m.corridorCharges || 0) / L,
    fees: ((m.exchangeFee || 0) + (m.tradingMargin || 0) + (m.annualFee || 0)) / L,
    base: m.perUnitAfterLoss, css: m.css,
    rest: (m.interest || 0) + (m.additionalSurcharge || 0) + (m.wheeling || 0),
    discom: m.discomCost,
  })), [monthsInFy])

  if (!rows.length) return <Empty />

  const scoped = month === 'all' ? rows : rows.filter((r) => r.month === month)
  const tot = scoped.reduce((a, r) => ({ e: a.e + r.energy, c: a.c + r.corridor, f: a.f + r.fees }), { e: 0, c: 0, f: 0 })
  const all = tot.e + tot.c + tot.f || 1

  const share = [
    { label: 'Energy charges', v: tot.e, color: 'var(--s1)' },
    { label: 'Corridor charges', v: tot.c, color: 'var(--s2)' },
    { label: 'Fees and trading margin', v: tot.f, color: 'var(--s3)' },
  ]

  return (
    <>
      <div className="page-h"><h2>Cost &amp; savings</h2><p>What is paid to NVVN and how the landed cost per unit is built up.</p></div>

      <Card title="Where the money goes" sub={`₹${nf(all, 1)} Lacs paid in the selected period`}>
        <div className="share">
          {share.map((s) => <div key={s.label} style={{ flex: s.v, background: s.color }} title={`${s.label}: ${nf((s.v / all) * 100, 1)}%`} />)}
        </div>
        <div className="share-l">
          {share.map((s) => (
            <div key={s.label}><i style={{ background: s.color }} /><span>{s.label}</span><b>{nf((s.v / all) * 100, 1)}%</b><em>₹{nf(s.v, 1)} L</em></div>
          ))}
        </div>
      </Card>

      <div className="grid2">
        <Card title="Monthly cost components" sub="₹ Lacs" right={<Legend items={share.map(({ label, color }) => ({ label, color }))} />}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} />
              <YAxis {...AXIS} axisLine={false} />
              <Tooltip cursor={{ fill: 'var(--wash)' }} content={<Tip fmt={(p) => `₹${nf(p.value, 1)} L`} />} />
              <Bar dataKey="energy" name="Energy charges" stackId="a" fill="var(--s1)" {...gap} />
              <Bar dataKey="corridor" name="Corridor charges" stackId="a" fill="var(--s2)" {...gap} />
              <Bar dataKey="fees" name="Fees and margin" stackId="a" fill="var(--s3)" radius={[4, 4, 0, 0]} {...gap} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Landed cost build-up" sub="₹/kWh, compared with discom variable cost" right={<Legend items={[{ label: 'Cost after losses', color: 'var(--s1)' }, { label: 'Cross subsidy surcharge', color: 'var(--s2)' }, { label: 'Interest and other', color: 'var(--s3)' }, { label: 'Discom variable cost', color: 'var(--ink)' }]} />}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={rows} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" {...AXIS} />
              <YAxis {...AXIS} axisLine={false} domain={[0, 'auto']} />
              <Tooltip cursor={{ fill: 'var(--wash)' }} content={<Tip fmt={(p) => `₹${nf(p.value, 2)}/kWh`} />} />
              <Bar dataKey="base" name="Cost after losses" stackId="u" fill="var(--s1)" {...gap} />
              <Bar dataKey="css" name="Cross subsidy surcharge" stackId="u" fill="var(--s2)" {...gap} />
              <Bar dataKey="rest" name="Interest and other" stackId="u" fill="var(--s3)" radius={[4, 4, 0, 0]} {...gap} />
              <Line dataKey="discom" name="Discom variable cost" stroke="var(--ink)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 4, fill: 'var(--ink)', ...gap }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>
  )
}
