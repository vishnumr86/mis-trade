import { useRef, useState } from 'react'
import { parseBuffer, splitByYear } from '../lib/parseMis.js'
import { can } from '../lib/auth.js'
import { Card } from '../components/ui.jsx'
import { downloadFile, monthLong, nf } from '../lib/format.js'

const dl = (doc) => downloadFile(`mis-${doc.fy}.json`, JSON.stringify(doc, null, 1), 'application/json')

function YearRows({ docs, children }) {
  return (
    <table className="tbl compact">
      <thead><tr><th>Financial year</th><th className="r">Months</th><th className="r">Days</th><th className="r">Savings (L)</th><th /></tr></thead>
      <tbody>
        {docs.map((d) => (
          <tr key={d.fy}>
            <td><b>{d.fy}</b><small>mis-{d.fy}.json</small></td>
            <td className="r">{d.monthly.length}</td>
            <td className="r">{d.daily.length}</td>
            <td className="r">{nf(d.summary?.savingsLacs, 1)}</td>
            <td className="r"><div className="row-gap end">{children(d)}</div></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Upload({ session, data, docs, actions, onPublished }) {
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)
  const input = useRef(null)

  if (!can(session, 'upload')) {
    return <Card title="Access denied" sub="Your role is read-only. Ask an administrator to upload data." />
  }

  const handle = async (file) => {
    setError(''); setDraft(null)
    if (!file) return
    if (!/\.(xlsx|xlsm|xls)$/i.test(file.name)) return setError('Please choose an Excel file (.xlsx, .xlsm or .xls).')
    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      await new Promise((r) => setTimeout(r, 400)) // let the spinner paint on big files
      setDraft(parseBuffer(buf, file.name))
    } catch (e) {
      setError(e.message || 'Could not read this file.')
    } finally { setBusy(false) }
  }

  const publish = async () => {
    setError('')
    setBusy(true)
    try {
      await actions.publish(draft)
      setDraft(null)
      onPublished?.()
    } catch (e) {
      setError(e.message || 'Could not save the yearly files.')
    } finally { setBusy(false) }
  }

  const m = draft?.meta
  const split = draft ? splitByYear(draft) : []
  const existing = new Set((docs || []).map((d) => d.fy))
  const empty = !data

  return (
    <>
      <div className="page-h">
        <h2>Upload MIS data</h2>
        <p>{empty ? 'No data has been loaded yet. Upload the MIS workbook to populate the dashboard.' : 'Upload a workbook to add or replace financial years. Years not in the file are kept.'}</p>
      </div>

      <div className="grid2">
        <Card title="1. Choose Excel file" sub="Expected sheets: Yearly, OA summary YYYY-YYYY, and Mon-YY MIS">
          <div
            className={`drop ${drag ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
            onClick={() => input.current?.click()}
            role="button" tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          >
            <input ref={input} type="file" accept=".xlsx,.xlsm,.xls" hidden onChange={(e) => { handle(e.target.files[0]); e.target.value = '' }} />
            {busy ? <><span className="spin big" /><p>Converting to JSON…</p></> : <><div className="drop-ic">⇪</div><p><b>Drop the workbook here</b><br />or click to browse</p></>}
          </div>
          {error && <div className="error" role="alert">⚠ {error}</div>}
        </Card>

        <Card title="Saved yearly files" sub={empty ? 'Nothing saved yet' : `${docs.length} flat ${docs.length === 1 ? 'file' : 'files'} in the data/ folder`}>
          {empty ? (
            <div className="empty">Yearly files (data/mis-YYYY-YYYY.json) will be listed here after the first upload.</div>
          ) : (
            <>
              <YearRows docs={docs}>
                {(d) => (
                  <>
                    <button className="ghost sm" onClick={() => dl(d)}>JSON</button>
                    <button className="ghost sm danger" onClick={() => window.confirm(`Delete data/mis-${d.fy}.json?`) && actions.removeYear(d.fy).catch((e) => setError(e.message))}>Remove</button>
                  </>
                )}
              </YearRows>
              <div className="row-gap">
                <button className="ghost danger" onClick={() => window.confirm('Delete all yearly files in data/?') && actions.reset().catch((e) => setError(e.message))}>Clear all data</button>
              </div>
            </>
          )}
        </Card>
      </div>

      {draft && (
        <Card title="2. Review and publish" sub={`${m.sourceFile}: nothing is saved until you publish`}>
          <p className="split-note">
            {split.length > 1
              ? <>This file covers <b>{split.length} financial years</b> and will be split into <b>{split.length} separate yearly JSON files</b>.</>
              : <>This file covers <b>1 financial year</b> and will be saved as one yearly JSON file.</>}
          </p>
          <YearRows docs={split}>
            {(d) => (
              <>
                <span className={`pill ${existing.has(d.fy) ? 'replace' : 'new'}`}>{existing.has(d.fy) ? 'Replaces saved year' : 'New'}</span>
                <button className="ghost sm" onClick={() => dl(d)}>JSON</button>
              </>
            )}
          </YearRows>
          <div className="facts mt">
            <div><span>Monthly records</span><b>{m.counts.monthly}</b><em>{m.sheets.monthly.length} summary sheets</em></div>
            <div><span>Daily records</span><b>{nf(m.counts.daily)}</b><em>{m.sheets.daily.length} daily sheets</em></div>
            <div><span>Latest month</span><b>{m.latestMonth ? monthLong(m.latestMonth) : 'n/a'}</b></div>
          </div>
          {m.warnings.map((w) => <div className="warn" key={w}>⚠ {w}</div>)}
          {m.sheets.ignored.length > 0 && <p className="muted">Ignored sheets: {m.sheets.ignored.join(', ')}</p>}
          <details className="json-prev">
            <summary>Preview JSON structure</summary>
            <pre>{JSON.stringify(split.map((d) => ({ ...d, monthly: d.monthly.slice(0, 1), daily: d.daily.slice(0, 1) })), null, 2)}</pre>
          </details>
          <div className="row-gap">
            <button className="primary inline" onClick={publish} disabled={busy}>{busy ? 'Saving…' : 'Save yearly files and open dashboard'}</button>
            <button className="ghost" onClick={() => setDraft(null)}>Discard</button>
          </div>
        </Card>
      )}
    </>
  )
}
