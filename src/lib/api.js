const SESSION_KEY = 'mis.session.v1'

const token = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY))?.token } catch { return null }
}

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Cannot reach the server. Start it with "npm run dev" or "npm run start".')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/login') window.dispatchEvent(new Event('mis:unauthorized'))
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json
}

export const api = {
  login: (username, password) => request('/api/login', { method: 'POST', body: { username, password } }),
  preview: () => request('/api/preview'),
  years: () => request('/api/years'),
  saveYears: (docs) => request('/api/years', { method: 'PUT', body: docs }),
  removeYear: (fy) => request(`/api/years/${fy}`, { method: 'DELETE' }),
  clear: () => request('/api/years', { method: 'DELETE' }),
}
