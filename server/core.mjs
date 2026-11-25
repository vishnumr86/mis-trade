import { USERS } from './users.js'

/**
 * Platform-neutral API logic (Web APIs only, so it runs in Node and in Cloudflare Workers).
 *   POST   /api/login          {username,password} -> {token,user}
 *   GET    /api/preview        public aggregates for the login page
 *   GET    /api/years          any signed-in user  -> yearly docs[]
 *   PUT    /api/years          admin only          body: yearly docs[]
 *   DELETE /api/years/:fy      admin only
 *   DELETE /api/years          admin only
 *
 * `storage` must provide: list() -> docs[], put(doc), remove(fy), clear()
 */
const FY = /^\d{4}-\d{4}$/
const enc = new TextEncoder()
const dec = new TextDecoder()

const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function sign(secret, payload) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64u(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload))))
}

const safeEqual = (a, b) => {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

async function makeToken(secret, u) {
  const p = b64u(enc.encode(JSON.stringify({ u: u.username, role: u.role, exp: Date.now() + 12 * 3600e3 })))
  return `${p}.${await sign(secret, p)}`
}

async function verify(secret, authorization) {
  const [p, s] = String(authorization || '').replace(/^Bearer /, '').split('.')
  if (!p || !s || !safeEqual(await sign(secret, p), s)) return null
  try {
    const d = JSON.parse(dec.decode(unb64u(p)))
    return d.exp > Date.now() ? d : null
  } catch { return null }
}

const valid = (d) => d && FY.test(d.fy) && Array.isArray(d.monthly) && Array.isArray(d.daily) && d.meta && typeof d.meta === 'object'

/** Returns null when the route is not an API route, otherwise { status, json }. */
export async function handleApi({ method, route, authorization, readBody }, storage, { secret }) {
  if (!route.startsWith('/api/')) return null
  const reply = (status, json) => ({ status, json })
  if (!secret) return reply(500, { error: 'Server is missing the MIS_SECRET setting' })

  try {
    if (route === '/api/login' && method === 'POST') {
      const { username = '', password = '' } = (await readBody()) || {}
      const u = USERS.find((x) => x.username === String(username).trim().toLowerCase() && x.password === password)
      await new Promise((r) => setTimeout(r, 400))
      if (!u) return reply(401, { error: 'Invalid username or password' })
      return reply(200, { token: await makeToken(secret, u), user: { username: u.username, role: u.role, name: u.name, title: u.title } })
    }

    if (route === '/api/preview' && method === 'GET') {
      const docs = await storage.list()
      const monthly = docs.flatMap((d) => d.monthly).map(({ month, label, mwh, mwhNet, savingLacs, savingPerUnit }) => ({ month, label, mwh, mwhNet, savingLacs, savingPerUnit }))
      const daily = docs.flatMap((d) => d.daily).filter((d) => d.traded).slice(-14).map(({ date, mcp, clearedMW }) => ({ date, mcp, clearedMW, traded: true }))
      return reply(200, { monthly, daily })
    }

    const user = await verify(secret, authorization)
    if (!user) return reply(401, { error: 'Please sign in again' })

    if (route === '/api/years' && method === 'GET') return reply(200, await storage.list())

    if (route.startsWith('/api/years')) {
      if (user.role !== 'admin') return reply(403, { error: 'Admin access required' })

      if (route === '/api/years' && method === 'PUT') {
        const docs = await readBody()
        if (!Array.isArray(docs) || !docs.length || !docs.every(valid)) return reply(400, { error: 'Expected a non-empty array of yearly documents' })
        for (const d of docs) await storage.put(d)
        return reply(200, { saved: docs.map((d) => d.fy) })
      }

      if (method === 'DELETE') {
        const fy = route.slice('/api/years/'.length)
        if (route === '/api/years') await storage.clear()
        else if (FY.test(fy)) await storage.remove(fy)
        else return reply(400, { error: 'Bad financial year' })
        return reply(200, { ok: true })
      }
    }
    return reply(404, { error: 'Not found' })
  } catch (e) {
    return reply(e.code === 413 || e.code === 400 ? e.code : 500, { error: e.message || 'Server error' })
  }
}
