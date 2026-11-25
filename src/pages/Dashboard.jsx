import { useMemo, useState } from 'react'
import { fyShort, monthShort, monthLong } from '../lib/format.js'
import { can } from '../lib/auth.js'
import Overview from '../tabs/Overview.jsx'
import Trends from '../tabs/Trends.jsx'
import Daily from '../tabs/Daily.jsx'
import Cost from '../tabs/Cost.jsx'
import DataTab from '../tabs/DataTab.jsx'
import Upload from './Upload.jsx'

const TABS = [
  { id: 'overview', label: 'Overview', icon: '◧' },
  { id: 'trends', label: 'History & Trends', icon: '↗' },
  { id: 'daily', label: 'Daily Analysis', icon: '▦' },
  { id: 'cost', label: 'Cost & Savings', icon: '₹' },
  { id: 'data', label: 'Data Explorer', icon: '☰' },
  { id: 'upload', label: 'Upload Data', icon: '⇪', admin: true },
]

function NoData({ isAdmin, onUpload }) {
  return (
    <div className="nodata">
      <div className="nodata-ic">▦</div>
      <h2>No data to show yet</h2>
      {isAdmin ? (
        <>
          <p>Upload the MIS Excel workbook. It is converted to JSON, split by financial year, and the dashboard fills in straight away.</p>
          <button className="primary inline" onClick={onUpload}>Upload Excel file</button>
        </>
      ) : (
        <p>No trading data has been uploaded. Please ask an administrator to upload the MIS Excel file, then refresh this page.</p>
      )}
    </div>
  )
}

export default function Dashboard({ session, data, docs, actions, theme, onTheme, onLogout }) {
  const hasData = !!data && (data.monthly.length > 0 || data.daily.length > 0)
  const isAdmin = can(session, 'upload')
  const [fyPick, setFyPick] = useState('latest')
  const [month, setMonth] = useState('all')
  const [tab, setTab] = useState(isAdmin && !hasData ? 'upload' : 'overview')

  const fys = hasData ? data.meta.fiscalYears : []
  const latestFy = hasData ? (data.monthly.at(-1)?.fy ?? fys.at(-1)) : null
  // a stale pick (e.g. a year that was removed) falls back to the latest year
  const fy = fyPick === 'all' || fys.includes(fyPick) ? fyPick : latestFy
  const monthsInFy = useMemo(() => (hasData ? data.monthly.filter((m) => fy === 'all' || m.fy === fy) : []), [data, fy, hasData])
  const effMonth = month === 'all' || monthsInFy.some((m) => m.month === month) ? month : 'all'

  const changeFy = (v) => { setFyPick(v); setMonth('all') }
  const published = () => { setFyPick('latest'); setMonth('all'); setTab('overview') }

  const tabs = hasData ? TABS.filter((t) => !t.admin || isAdmin) : TABS.filter((t) => t.admin && isAdmin)
  const active = hasData || (isAdmin && tab === 'upload') ? tab : hasData ? tab : isAdmin ? 'upload' : 'nodata'

  const ctx = { data, fy, month: effMonth, setMonth, setFy: changeFy, monthsInFy, fys }
  const latest = hasData ? data.monthly.at(-1) : null

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">⚡</span> MIS Trade Desk</div>
        <nav className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={active === t.id} className={active === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              <span aria-hidden>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
        <div className="top-right">
          <button className="theme-btn" onClick={onTheme} aria-label="Toggle theme">{theme === 'dark' ? '☀' : '☾'}</button>
          <div className="user">
            <div className="avatar">{session.name.split(' ').map((p) => p[0]).join('')}</div>
            <div className="user-t"><b>{session.name}</b><span className={`badge ${session.role}`}>{session.role}</span></div>
          </div>
          <button className="ghost" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      {hasData && active !== 'upload' && (
        <div className="filters">
          <div className="f-group">
            <label>Financial year</label>
            <div className="seg">
              {fys.map((f) => (
                <button key={f} className={fy === f ? 'on' : ''} onClick={() => changeFy(f)}>{fyShort(f)}</button>
              ))}
              {fys.length > 1 && <button className={fy === 'all' ? 'on' : ''} onClick={() => changeFy('all')}>All years</button>}
            </div>
          </div>
          {active !== 'trends' && (
            <div className="f-group grow">
              <label>Month</label>
              <div className="chips">
                <button className={effMonth === 'all' ? 'on' : ''} onClick={() => setMonth('all')}>Full period</button>
                {monthsInFy.map((m) => (
                  <button key={m.month} className={effMonth === m.month ? 'on' : ''} onClick={() => setMonth(m.month)} title={monthLong(m.month)}>
                    {monthShort(m.month)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="f-meta">
            Data to <b>{latest ? monthLong(latest.month) : 'n/a'}</b>
            <span className="src uploaded">{fys.length} {fys.length === 1 ? 'year' : 'years'} loaded</span>
          </div>
        </div>
      )}

      <main className="content" key={active}>
        {active === 'nodata' && <NoData isAdmin={false} />}
        {active === 'upload' && <Upload session={session} data={hasData ? data : null} docs={docs} actions={actions} onPublished={published} />}
        {hasData && active === 'overview' && <Overview {...ctx} />}
        {hasData && active === 'trends' && <Trends {...ctx} />}
        {hasData && active === 'daily' && <Daily {...ctx} />}
        {hasData && active === 'cost' && <Cost {...ctx} />}
        {hasData && active === 'data' && <DataTab {...ctx} />}
      </main>
    </div>
  )
}
