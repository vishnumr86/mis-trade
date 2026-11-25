// Cloudflare Pages "advanced mode" worker. `npm run build` bundles this into dist/_worker.js,
// so uploading the dist/ folder alone is enough. It serves /api/* using Workers KV as the yearly
// flat-file store (key "mis:2026-2027" holds the same JSON as data/mis-2026-2027.json).
// Everything else is served as static files from the build.
import { handleApi } from '../server/core.mjs'

const PREFIX = 'mis:'
const MAX_BODY = 20 * 1024 * 1024

function kvStorage(kv) {
  const list = async () => {
    const keys = []
    let cursor
    do {
      const page = await kv.list({ prefix: PREFIX, cursor })
      keys.push(...page.keys.map((k) => k.name))
      cursor = page.list_complete ? undefined : page.cursor
    } while (cursor)
    const docs = await Promise.all(keys.map((k) => kv.get(k, 'json')))
    return docs.filter((d) => d && Array.isArray(d.monthly) && Array.isArray(d.daily)).sort((a, b) => a.fy.localeCompare(b.fy))
  }
  return {
    list,
    put: (d) => kv.put(PREFIX + d.fy, JSON.stringify(d)),
    remove: (fy) => kv.delete(PREFIX + fy),
    clear: async () => { for (const d of await list()) await kv.delete(PREFIX + d.fy) },
  }
}

export default {
  async fetch(request, env) {
    const route = new URL(request.url).pathname
    if (!route.startsWith('/api/')) return env.ASSETS.fetch(request)

    if (!env.MIS_DATA) return Response.json({ error: 'KV binding MIS_DATA is not configured' }, { status: 500 })

    const readBody = async () => {
      const text = await request.text()
      if (text.length > MAX_BODY) throw Object.assign(new Error('Payload too large'), { code: 413 })
      try { return text ? JSON.parse(text) : null } catch { throw Object.assign(new Error('Invalid JSON'), { code: 400 }) }
    }
    const out = await handleApi(
      { method: request.method, route, authorization: request.headers.get('authorization'), readBody },
      kvStorage(env.MIS_DATA),
      { secret: env.MIS_SECRET }, // no fallback: production must set a real secret
    )
    return out ? Response.json(out.json, { status: out.status }) : new Response('Not found', { status: 404 })
  },
}
