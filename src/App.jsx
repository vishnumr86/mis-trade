import { useState, useMemo, useEffect, useCallback } from 'react'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import { getSession, logout } from './lib/auth.js'
import { api } from './lib/api.js'
import { mergeYears, splitByYear } from './lib/parseMis.js'

export default function App() {
  const [session, setSession] = useState(getSession)
  const [preview, setPreview] = useState(null) // public aggregates for the login page
  const [store, setStore] = useState({ status: 'idle', data: null, docs: [], error: '' })
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('mis.theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') } catch { return 'light' }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('mis.theme', theme) } catch { /* ignore */ }
  }, [theme])

  const signOut = useCallback(() => { logout(); setSession(null); setStore({ status: 'idle', data: null, docs: [], error: '' }) }, [])

  // Yearly flat files (data/mis-<FY>.json) are fetched from the server.
  const reload = useCallback(async () => {
    setStore((s) => ({ ...s, status: 'loading', error: '' }))
    try {
      const docs = await api.years()
      setStore({ status: 'ready', docs, data: mergeYears(docs), error: '' })
    } catch (e) {
      setStore({ status: 'error', docs: [], data: null, error: e.message })
    }
  }, [])

  useEffect(() => {
    if (session) reload()
    else api.preview().then(setPreview).catch(() => setPreview(null))
  }, [session, reload])

  useEffect(() => {
    window.addEventListener('mis:unauthorized', signOut)
    return () => window.removeEventListener('mis:unauthorized', signOut)
  }, [signOut])

  const actions = useMemo(() => ({
    /** parsed workbook -> one flat JSON file per financial year, written to data/ on the server */
    async publish(parsed) {
      await api.saveYears(splitByYear(parsed))
      await reload()
    },
    async removeYear(fy) { await api.removeYear(fy); await reload() },
    async reset() { await api.clear(); await reload() },
  }), [reload])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  if (!session) return <Login data={preview} onLogin={setSession} theme={theme} onTheme={toggleTheme} />

  if (store.status === 'idle' || store.status === 'loading') {
    return <div className="boot"><span className="spin big" /><p>Loading data…</p></div>
  }
  if (store.status === 'error') {
    return (
      <div className="boot">
        <h2>Could not load data</h2>
        <p className="muted">{store.error}</p>
        <div className="row-gap"><button className="primary inline" onClick={reload}>Retry</button><button className="ghost" onClick={signOut}>Sign out</button></div>
      </div>
    )
  }

  return (
    <Dashboard
      session={session}
      data={store.data}
      docs={store.docs}
      actions={actions}
      theme={theme}
      onTheme={toggleTheme}
      onLogout={signOut}
    />
  )
}
