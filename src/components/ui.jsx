import { nf } from '../lib/format.js'

export const AXIS = { stroke: 'var(--axis)', tick: { fill: 'var(--ink2)', fontSize: 12 }, tickLine: false }
export const GRID = { stroke: 'var(--grid)', vertical: false }

export function Card({ title, sub, right, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <header className="card-h">
        <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
        {right}
      </header>
      {children}
    </section>
  )
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.label}><i style={{ background: i.color }} />{i.label}</span>
      ))}
    </div>
  )
}

/** Delta pill: arrow + sign + label, never colour alone. */
export function Delta({ pct, goodWhenUp = true, label }) {
  if (pct == null) return <span className="delta flat">no comparison</span>
  const up = pct >= 0
  const good = Math.abs(pct) < 0.05 ? null : up === goodWhenUp
  return (
    <span className={`delta ${good == null ? 'flat' : good ? 'good' : 'bad'}`}>
      {up ? '▲' : '▼'} {nf(Math.abs(pct), 1)}%{label && <em> {label}</em>}
    </span>
  )
}

export function Kpi({ label, value, unit, pct, goodWhenUp, cmpLabel, icon, series }) {
  return (
    <div className="kpi" style={{ '--kc': `var(--s${series || 1})` }}>
      <div className="kpi-top"><span className="kpi-ic">{icon}</span><span>{label}</span></div>
      <div className="kpi-v">{value}<small>{unit}</small></div>
      <Delta pct={pct} goodWhenUp={goodWhenUp} label={pct == null ? null : cmpLabel} />
    </div>
  )
}

/** Recharts tooltip content. rows: [{name,color,value}] built by `fmt(entry)` */
export function Tip({ active, payload, label, labelFmt, fmt }) {
  if (!active || !payload?.length) return null
  return (
    <div className="tip">
      <div className="tip-h">{labelFmt ? labelFmt(label, payload) : label}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey + p.name} className="tip-r">
          <i style={{ background: p.color || p.stroke || p.fill }} />
          <span>{p.name}</span>
          <b>{fmt ? fmt(p) : nf(p.value, 2)}</b>
        </div>
      ))}
    </div>
  )
}

export const Empty = ({ children = 'No data for this selection.' }) => <div className="empty">{children}</div>
