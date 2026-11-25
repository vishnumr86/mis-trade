import { useEffect, useMemo, useRef, useState } from 'react'
import { login, USERS } from '../lib/auth.js'
import { nf, monthShort, fmtDate } from '../lib/format.js'

function useCountUp(target, ms = 1400) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

function Stat({ label, value, digits = 0, prefix = '', suffix = '' }) {
  const v = useCountUp(value)
  return (
    <div className="l-stat">
      <div className="l-stat-v">{prefix}{nf(v, digits)}<small>{suffix}</small></div>
      <div className="l-stat-l">{label}</div>
    </div>
  )
}

function Eye({ off }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.9M6.1 6.1A17 17 0 002 12s4 7 10 7a9.9 9.9 0 004.1-.9" /></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
  )
}

export default function Login({ data, onLogin, theme, onTheme }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)
  const [hover, setHover] = useState(null)
  const pwRef = useRef(null)

  const has = !!data?.monthly?.length
  const stats = useMemo(() => {
    if (!has) return { mwh: 0, lacs: 0, spu: 0, months: 0 }
    const mwh = data.monthly.reduce((s, m) => s + (m.mwh || 0), 0)
    const lacs = data.monthly.reduce((s, m) => s + (m.savingLacs || 0), 0)
    const rated = data.monthly.filter((m) => m.savingPerUnit != null)
    const w = rated.reduce((s, m) => s + (m.mwhNet || 0), 0)
    const spu = w ? rated.reduce((s, m) => s + m.savingPerUnit * (m.mwhNet || 0), 0) / w : 0
    return { mwh, lacs, spu, months: data.monthly.length }
  }, [data, has])

  const bars = has ? data.monthly : []
  const maxBar = Math.max(...bars.map((m) => m.savingLacs || 0), 1)
  const ticker = useMemo(() => (has ? data.daily.filter((d) => d.traded).slice(-14) : []), [data, has])
  const latest = has ? data.monthly.at(-1) : null

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const s = await login(username, password)
      if (!remember) window.addEventListener('beforeunload', () => localStorage.removeItem('mis.session.v1'), { once: true })
      onLogin(s)
    } catch (err) {
      setError(err.message)
      setShake((n) => n + 1)
      setBusy(false)
    }
  }

  const fill = (u) => {
    setUsername(u.username)
    setPassword(u.password)
    setError('')
    pwRef.current?.focus()
  }

  return (
    <div className="login">
      <section className="login-hero" aria-hidden={false}>
        <div className="orb o1" /><div className="orb o2" />
        <div className="brand"><span className="logo">⚡</span> MIS Trade Desk</div>

        <div className="hero-copy">
          <h1>Open access power trading,<br /><span>measured to the unit.</span></h1>
          <p>Daily bids, IEX clearing, landed cost and realised savings in one place{has ? `, from ${monthShort(data.monthly[0].month)} to ${monthShort(latest.month)}.` : '. Sign in as an administrator to upload your first MIS workbook.'}</p>
        </div>

        {!has && <div className="l-empty"><b>No trading data yet</b><span>Figures and charts appear here once an administrator uploads the MIS Excel file.</span></div>}
        {has && <>
        <div className="l-stats">
          <Stat label="Energy cleared" value={stats.mwh / 1000} digits={1} suffix=" GWh" />
          <Stat label="Realised savings" value={stats.lacs} digits={0} prefix="₹" suffix=" Lacs" />
          <Stat label="Avg saving / unit" value={stats.spu} digits={2} prefix="₹" suffix="/kWh" />
        </div>

        <div className="l-chart">
          <div className="l-chart-h">
            <span>Monthly savings (₹ Lacs)</span>
            <b>{hover ? `${hover.label}: ₹${nf(hover.savingLacs, 1)} L` : `${stats.months} months tracked`}</b>
          </div>
          <div className="l-bars">
            {bars.map((m, i) => (
              <div key={m.month} className="l-bar-wrap" onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover(null)}>
                <div className="l-bar" style={{ height: `${((m.savingLacs || 0) / maxBar) * 100}%`, animationDelay: `${i * 70}ms` }} />
                <span>{monthShort(m.month).slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>

        </>}
        {has && <div className="ticker" title="Recent day-ahead market clearing prices">
          <div className="ticker-track">
            {[...ticker, ...ticker].map((d, i) => (
              <span key={i}>
                <i>{fmtDate(d.date).slice(0, -5)}</i> MCP <b>₹{nf(d.mcp, 2)}</b> · {nf(d.clearedMW, 0)} MW
              </span>
            ))}
          </div>
        </div>}
      </section>

      <section className="login-panel">
        <button className="theme-btn floating" onClick={onTheme} aria-label="Toggle theme">{theme === 'dark' ? '☀' : '☾'}</button>
        <form className="login-card" onSubmit={submit} key={shake} data-shake={shake > 0 || undefined}>
          <div className="brand mobile-only"><span className="logo">⚡</span> MIS Trade Desk</div>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to view the trading dashboard.</p>

          <div className="role-chips">
            {USERS.map((u) => (
              <button type="button" key={u.role} className="role-chip" onClick={() => fill(u)}>
                <span className={`dot ${u.role}`} />
                <span><b>{u.role === 'admin' ? 'Admin' : 'Viewer'}</b><small>{u.role === 'admin' ? 'Can upload data' : 'Read-only'}</small></span>
              </button>
            ))}
          </div>

          <label className="field">
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="admin or viewer" required autoFocus />
          </label>
          <label className="field">
            <span>Password</span>
            <div className="pw">
              <input ref={pwRef} type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter password" required />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}><Eye off={show} /></button>
            </div>
          </label>

          <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in</label>

          {error && <div className="error" role="alert">⚠ {error}</div>}

          <button className="primary" disabled={busy}>{busy ? <><span className="spin" /> Signing in…</> : 'Sign in'}</button>

          <div className="demo-box">
            <b>Demo accounts</b>
            <div><code>admin</code> / <code>Admin@123</code></div>
            <div><code>viewer</code> / <code>Viewer@123</code></div>
          </div>
        </form>
      </section>
    </div>
  )
}
