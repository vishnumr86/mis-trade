import fs from 'node:fs'
import path from 'node:path'
import { handleApi } from './core.mjs'

/**
 * Node adapter: yearly flat files live in `dataDir` as mis-<FY>.json (e.g. mis-2026-2027.json).
 * Used by `npm run dev` (Vite middleware) and `npm run start` (server/index.mjs).
 * On Cloudflare the same core runs from functions/api/[[path]].js with KV storage instead.
 */
const MAX_BODY = 60 * 1024 * 1024
const FY = /^\d{4}-\d{4}$/

function readBody(req) {
  return () => new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) { reject(Object.assign(new Error('Payload too large'), { code: 413 })); req.destroy() } else chunks.push(c)
    })
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null) } catch { reject(Object.assign(new Error('Invalid JSON'), { code: 400 })) }
    })
    req.on('error', reject)
  })
}

export function createApi({ dataDir, secret = process.env.MIS_SECRET || 'mis-dev-secret-change-me' }) {
  fs.mkdirSync(dataDir, { recursive: true })
  const file = (fy) => path.join(dataDir, `mis-${fy}.json`)

  const list = () =>
    fs.readdirSync(dataDir)
      .filter((f) => /^mis-\d{4}-\d{4}\.json$/.test(f))
      .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')) } catch { return null } })
      .filter((d) => d && FY.test(d.fy) && Array.isArray(d.monthly) && Array.isArray(d.daily))
      .sort((a, b) => a.fy.localeCompare(b.fy))

  const storage = {
    async list() { return list() },
    async put(d) {
      const tmp = `${file(d.fy)}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(d, null, 1))
      fs.renameSync(tmp, file(d.fy))
    },
    async remove(fy) { fs.rmSync(file(fy), { force: true }) },
    async clear() { list().forEach((d) => fs.rmSync(file(d.fy), { force: true })) },
  }

  /** Returns true when the request was an API request and has been answered. */
  return async function handle(req, res) {
    const out = await handleApi(
      { method: req.method, route: new URL(req.url, 'http://x').pathname, authorization: req.headers.authorization, readBody: readBody(req) },
      storage,
      { secret },
    )
    if (!out) return false
    res.statusCode = out.status
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(out.json))
    return true
  }
}
